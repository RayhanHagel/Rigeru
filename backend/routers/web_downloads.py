import os
import uuid
import asyncio
import json
import concurrent.futures
from typing import Dict, Any, List, Optional, Tuple, AsyncGenerator
from io import BytesIO
from urllib.parse import urlparse

from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse
from pydantic import BaseModel, Field
from PIL import Image, UnidentifiedImageError

from utilities.web.util_yt import search_youtube, download_youtube, parse_youtube_takeout_csv
from utilities.web.util_crawler import stream_crawl
from utilities.core.util_network import better_get
from utilities.web.util_spotify_download import download_playlist_cli
from utilities.web.util_rss import (
    load_subscriptions, save_subscriptions, fetch_all_feeds,
    preview_rss_feed, load_disk_cache, save_disk_cache
)
from utilities.web.util_yt_rss import (
    load_tracked_channels, add_channel, delete_channel,
    fetch_latest_videos, search_youtube_channel, bulk_add_channels,
    load_feed_cache, save_feed_cache
)
from utilities.web.util_scraper import get_page_preview_image, run_headless_scraper

router = APIRouter(
    prefix="/api/web-downloads",
    tags=["Web & Downloads"]
)

# In-memory store for background task statuses
download_tasks: Dict[str, Dict[str, Any]] = {}

@router.get("/sitemap/stream")
async def sitemap_stream(
    url: str = Query(..., min_length=4, description="Target website root URL to crawl"),
    max_pages: int = Query(100, ge=1, le=1000, description="Maximum count of pages to index"),
    max_depth: int = Query(3, ge=1, le=10, description="Maximum link crawl traversal depth")
) -> StreamingResponse:
    """
    Stream live crawling progress and discovered site links via Server-Sent Events.

    Args:
        url (str): Starting URL to crawl.
        max_pages (int, optional): Maximum page limit. Defaults to 100.
        max_depth (int, optional): Maximum directory traversal depth. Defaults to 3.

    Returns:
        StreamingResponse: Text/event-stream delivering discovery events.
    """
    clean_url = url.strip()
    return StreamingResponse(stream_crawl(clean_url, max_pages, max_depth), media_type="text/event-stream")

async def _download_searx_images(query: str, count: int, output_dir: str) -> AsyncGenerator[str, None]:
    """
    Execute background image search via SearxNG and stream downloads concurrently.

    Args:
        query (str): Search query string.
        count (int): Maximum number of images to download.
        output_dir (str): Local filesystem directory where images will be saved.

    Yields:
        str: Server-sent event data strings with download progress.

    Returns:
        AsyncGenerator[str, None]: Asynchronous generator yielding SSE event strings.
    """
    from utilities.productivity_lifestyle.util_ai_tools import ensure_searxng_running
    
    yield f"data: {json.dumps({'type': 'status', 'message': 'Starting SearxNG...'})}\n\n"
    ensure_searxng_running()
    
    yield f"data: {json.dumps({'type': 'status', 'message': f'Searching for {query}...'})}\n\n"
    try:
        from utilities.core.util_config import load_all_config
        config = load_all_config()
        searxng_url = config.get("searxng_url", "http://127.0.0.1:8080/search")
        
        res = better_get(searxng_url, params={"q": query, "format": "json", "categories": "images"}, timeout=15)
        if res is None:
            raise Exception("Request to SearxNG failed.")
        res.raise_for_status()
        data = res.json()
        results = data.get("results", [])
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': f'Search failed: {str(e)}'})}\n\n"
        return
        
    image_urls = [r.get("img_src", "") for r in results if r.get("img_src")]
    image_urls = image_urls[:count]
    
    if not image_urls:
        yield f"data: {json.dumps({'type': 'error', 'message': 'No images found.'})}\n\n"
        return
        
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
        
    yield f"data: {json.dumps({'type': 'status', 'message': f'Found {len(image_urls)} images. Starting download...'})}\n\n"
    
    completed = 0
    failed = 0
    
    def download_img(url: str, index: int) -> Tuple[bool, Optional[str]]:
        nonlocal completed, failed
        try:
            resp = better_get(url)
            if resp and resp.status_code == 200:
                content = resp.content
                ext = ".jpg"
                ctype = resp.headers.get("Content-Type", "")
                if "png" in ctype:
                    ext = ".png"
                elif "webp" in ctype:
                    ext = ".webp"
                elif "gif" in ctype:
                    ext = ".gif"

                try:
                    img = Image.open(BytesIO(content))
                    img.verify()
                except (UnidentifiedImageError, OSError, Exception):
                    return False, None

                fname = f"{query.replace(' ', '_')}_{uuid.uuid4().hex[:6]}{ext}"
                filepath = os.path.join(output_dir, fname)
                with open(filepath, "wb") as f:
                    f.write(content)
                return True, filepath
        except Exception:
            pass
        return False, None

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        loop = asyncio.get_running_loop()
        futures = [loop.run_in_executor(executor, download_img, url, i) for i, url in enumerate(image_urls)]

        for f in asyncio.as_completed(futures):
            success, filepath = await f
            if success:
                completed += 1
                yield f"data: {json.dumps({'type': 'image', 'path': filepath})}\n\n"
            else:
                failed += 1

            yield f"data: {json.dumps({'type': 'progress', 'completed': completed, 'failed': failed, 'total': len(image_urls)})}\n\n"

    yield f"data: {json.dumps({'type': 'done', 'message': f'Downloaded {completed}/{len(image_urls)} images to {output_dir}'})}\n\n"

@router.get("/bulk-images/stream")
async def bulk_images_stream(
    q: str = Query(..., min_length=1, description="Search query keyword"),
    count: int = Query(10, ge=1, le=100, description="Image count limit"),
    dir: str = Query("", description="Destination download directory path")
) -> StreamingResponse:
    """
    Search and stream bulk image downloads from the web directly to local disk.

    Args:
        q (str): Image search query.
        count (int, optional): Image download count. Defaults to 10.
        dir (str, optional): Target directory. Defaults to '~/Downloads/images'.

    Returns:
        StreamingResponse: Text/event-stream for download progress.
    """
    out_dir = dir.strip() if dir.strip() else os.path.join(os.path.expanduser('~'), 'Downloads', 'images')
    return StreamingResponse(_download_searx_images(q.strip(), count, out_dir), media_type="text/event-stream")

@router.get("/bulk-images/preview")
async def bulk_images_preview(path: str = Query(..., min_length=1, description="Absolute image file path")) -> FileResponse:
    """
    Serve a locally saved bulk image file to the web browser.

    Args:
        path (str): Filesystem path to the image file.

    Returns:
        FileResponse: Binary image stream.

    Raises:
        HTTPException: 404 if file does not exist.
    """
    clean_path = path.strip()
    if not os.path.isfile(clean_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(clean_path)

class DeleteImagesRequest(BaseModel):
    paths: List[str] = Field(..., description="Array of absolute image file paths to remove.")

@router.post("/bulk-images/delete")
def delete_bulk_images(req: DeleteImagesRequest) -> Dict[str, List[str]]:
    """
    Permanently delete multiple image files from disk.

    Args:
        req (DeleteImagesRequest): List of absolute paths to remove.

    Returns:
        Dict[str, List[str]]: Successfully removed and failed file paths.
    """
    deleted: List[str] = []
    failed: List[str] = []
    for path in req.paths:
        clean_path = path.strip()
        try:
            if os.path.isfile(clean_path):
                os.remove(clean_path)
                deleted.append(clean_path)
            else:
                failed.append(clean_path)
        except Exception:
            failed.append(clean_path)
    return {"deleted": deleted, "failed": failed}

# --- YouTube Download ---

class DownloadRequest(BaseModel):
    url: str = Field(..., min_length=5, description="Media URL (YouTube/video).")
    is_audio: bool = Field(False, description="Extract audio-only track.")
    resolution: str = Field("Best", description="Video quality target ('Best', '1080p', etc.).")
    output_dir: str = Field("", description="Destination folder on disk.")

@router.get("/youtube/search")
def search_yt(
    q: str = Query(..., min_length=1, description="Search query terms"),
    max_results: int = Query(5, ge=1, le=50, description="Result limit")
) -> List[Dict[str, Any]]:
    """
    Search YouTube videos by query keywords.

    Args:
        q (str): Search keyword query.
        max_results (int, optional): Max videos to return. Defaults to 5.

    Returns:
        List[Dict[str, Any]]: Search results with title, URL, duration, and thumbnail.

    Raises:
        HTTPException: 500 if search fails.
    """
    clean_q = q.strip()
    try:
        success, results = search_youtube(clean_q, limit=max_results)
        if not success:
            raise HTTPException(status_code=500, detail=str(results))
        return results
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _run_yt_download(task_id: str, req: DownloadRequest) -> None:
    """
    Execute background YouTube video/audio download worker.

    Args:
        task_id (str): Unique task identifier in download_tasks dictionary.
        req (DownloadRequest): Download parameters.

    Returns:
        None
    """
    download_tasks[task_id] = {"status": "downloading", "message": "Download started"}
    try:
        output_dir = req.output_dir.strip() if req.output_dir.strip() else os.path.join(os.path.expanduser('~'), 'Downloads')
        success, msg, final_path = download_youtube(
            url=req.url.strip(),
            output_dir=output_dir,
            is_audio=req.is_audio,
            resolution=req.resolution
        )
        if success:
            download_tasks[task_id] = {"status": "completed", "message": msg, "path": final_path}
        else:
            download_tasks[task_id] = {"status": "failed", "message": msg}
    except Exception as e:
        download_tasks[task_id] = {"status": "failed", "message": str(e)}

@router.post("/youtube/download")
def start_yt_download(req: DownloadRequest, background_tasks: BackgroundTasks) -> Dict[str, str]:
    """
    Kick off a YouTube video/audio download in the background.

    Args:
        req (DownloadRequest): URL, format, and destination directory.
        background_tasks (BackgroundTasks): Task worker queue.

    Returns:
        Dict[str, str]: Created task identifier (`{"task_id": str}`).
    """
    task_id = str(uuid.uuid4())
    download_tasks[task_id] = {"status": "pending", "message": "Queued"}
    background_tasks.add_task(_run_yt_download, task_id, req)
    return {"task_id": task_id}

@router.get("/youtube/download/{task_id}")
def check_yt_download(task_id: str) -> Dict[str, Any]:
    """
    Query the progress or completion status of an active YouTube download task.

    Args:
        task_id (str): Task UUID returned from start_yt_download.

    Returns:
        Dict[str, Any]: Status dictionary (`status`, `message`, `path`).

    Raises:
        HTTPException: 404 if task_id does not exist.
    """
    clean_id = task_id.strip()
    if clean_id not in download_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return download_tasks[clean_id]

# --- Spotify Download ---

class SpotifyDownloadRequest(BaseModel):
    url: str = Field(..., min_length=5, description="Spotify track, album, or playlist URL.")
    output_dir: str = Field("", description="Destination music folder.")
    audio_format: str = Field("mp3", description="Audio format ('mp3', 'flac', 'm4a').")
    bitrate: str = Field("320k", description="Audio bitrate encoding.")

def _run_spotify_download(task_id: str, req: SpotifyDownloadRequest) -> None:
    """
    Execute background spotdl download worker for Spotify playlist or track.

    Args:
        task_id (str): Task UUID.
        req (SpotifyDownloadRequest): Download specifications.

    Returns:
        None
    """
    download_tasks[task_id] = {"status": "downloading", "message": "Spotify download started"}
    try:
        output_dir = req.output_dir.strip() if req.output_dir.strip() else os.path.join(os.path.expanduser('~'), 'Music')
        success = download_playlist_cli(
            playlist_url=req.url.strip(),
            output_dir=output_dir,
            audio_format=req.audio_format,
            bitrate=req.bitrate
        )
        if success:
            download_tasks[task_id] = {"status": "completed", "message": "Download finished successfully", "path": output_dir}
        else:
            download_tasks[task_id] = {"status": "failed", "message": "Download process failed"}
    except Exception as e:
        download_tasks[task_id] = {"status": "failed", "message": str(e)}

@router.post("/spotify/download")
def start_spotify_download(req: SpotifyDownloadRequest, background_tasks: BackgroundTasks) -> Dict[str, str]:
    """
    Initiate background download of a Spotify track, album, or playlist.

    Args:
        req (SpotifyDownloadRequest): URL, format, and bitrate options.
        background_tasks (BackgroundTasks): Background worker queue.

    Returns:
        Dict[str, str]: Created task identifier (`{"task_id": str}`).
    """
    task_id = str(uuid.uuid4())
    download_tasks[task_id] = {"status": "pending", "message": "Queued"}
    background_tasks.add_task(_run_spotify_download, task_id, req)
    return {"task_id": task_id}

@router.get("/spotify/download/{task_id}")
def check_spotify_download(task_id: str) -> Dict[str, Any]:
    """
    Check the status and logs of an active Spotify download task.

    Args:
        task_id (str): Task UUID.

    Returns:
        Dict[str, Any]: Status dictionary (`status`, `message`, `path`).

    Raises:
        HTTPException: 404 if task_id does not exist.
    """
    clean_id = task_id.strip()
    if clean_id not in download_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return download_tasks[clean_id]

# --- RSS Feed Reader ---

@router.get("/rss/subscriptions")
def get_rss_subscriptions() -> Dict[str, List[Dict[str, str]]]:
    """
    Retrieve all saved RSS feed subscriptions.

    Returns:
        Dict[str, List[Dict[str, str]]]: List of subscribed feeds with title and URL.

    Raises:
        HTTPException: 500 if reading subscriptions fails.
    """
    try:
        subs = load_subscriptions()
        sub_list = [{"title": title, "url": url} for url, title in subs.items()]
        return {"subscriptions": sub_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RssSubscriptionRequest(BaseModel):
    title: str = Field(..., min_length=1, description="Subscription feed title.")
    url: str = Field(..., min_length=5, description="RSS / Atom XML feed URL.")

@router.post("/rss/subscriptions")
def add_rss_subscription(req: RssSubscriptionRequest) -> Dict[str, Any]:
    """
    Add a new RSS or Atom feed subscription URL to the reader.

    Args:
        req (RssSubscriptionRequest): Feed display title and URL.

    Returns:
        Dict[str, Any]: Confirmation message and updated subscription list.

    Raises:
        HTTPException: 500 if saving subscription fails.
    """
    try:
        subs = load_subscriptions()
        subs[req.url.strip()] = req.title.strip()
        save_subscriptions(subs)
        sub_list = [{"title": title, "url": url} for url, title in subs.items()]
        return {"message": "Subscription added successfully", "subscriptions": sub_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rss/subscriptions/remove")
def remove_rss_subscription(req: RssSubscriptionRequest) -> Dict[str, Any]:
    """
    Remove an existing RSS feed subscription by URL.

    Args:
        req (RssSubscriptionRequest): Feed subscription to remove.

    Returns:
        Dict[str, Any]: Confirmation message and updated subscription list.

    Raises:
        HTTPException: 500 if removing subscription fails.
    """
    try:
        subs = load_subscriptions()
        clean_url = req.url.strip()
        if clean_url in subs:
            del subs[clean_url]
            save_subscriptions(subs)
        sub_list = [{"title": title, "url": url} for url, title in subs.items()]
        return {"message": "Subscription removed successfully", "subscriptions": sub_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rss/feeds")
def get_rss_feeds(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetch and aggregate latest articles across all subscribed RSS feeds.

    Args:
        force_refresh (bool, optional): Bypass 1-hour cache and refetch feeds. Defaults to False.

    Returns:
        Dict[str, Any]: List of parsed articles and cache status flag (`{"articles": [...], "cached": bool}`).

    Raises:
        HTTPException: 500 if feed fetching encounters an error.
    """
    import time
    try:
        articles, mtime = load_disk_cache()
        if not force_refresh and articles and (time.time() - mtime < 3600):
            return {"articles": articles, "cached": True}
            
        subs = load_subscriptions()
        urls = list(subs.keys())
        articles = fetch_all_feeds(urls)
        save_disk_cache(articles)
        return {"articles": articles, "cached": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rss/preview")
def preview_rss(url: str = Query(..., min_length=4, description="Target RSS/Atom XML feed URL")) -> Dict[str, Any]:
    """
    Preview articles from an RSS feed URL before adding it to subscriptions.

    Args:
        url (str): Target XML feed URL.

    Returns:
        Dict[str, Any]: Feed title, description, and list of preview articles.

    Raises:
        HTTPException: 400 if feed cannot be fetched or parsed.
    """
    clean_url = url.strip()
    success, data = preview_rss_feed(clean_url)
    if not success:
        raise HTTPException(status_code=400, detail=str(data))
    return data

# --- YouTube RSS Manager ---

@router.get("/youtube-rss/channels")
def get_yt_rss_channels() -> List[Dict[str, Any]]:
    """
    List all YouTube channels tracked via native RSS feeds.

    Returns:
        List[Dict[str, Any]]: Tracked channel records with name and channel ID.
    """
    return load_tracked_channels()

class YTRssSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="YouTube channel name or handle to search.")
    
class YTRssAddRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Channel display name.")
    channel_id: str = Field(..., min_length=5, description="YouTube UC... channel ID.")

@router.post("/youtube-rss/channels/search")
def search_yt_rss_channel(req: YTRssSearchRequest) -> Dict[str, str]:
    """
    Search for a YouTube channel by name, resolve its channel ID, and add it to tracked feeds.

    Args:
        req (YTRssSearchRequest): Search terms.

    Returns:
        Dict[str, str]: Confirmation message, resolved channel ID, and title.

    Raises:
        HTTPException: 404 if channel not found, 400 on error.
    """
    name, c_id = search_youtube_channel(req.query.strip())
    if c_id:
        success, msg = add_channel(name, c_id)
        if success:
            return {"message": f"Found and added: {name} ({c_id})", "channel_id": c_id, "name": name}
        raise HTTPException(status_code=400, detail=msg)
    raise HTTPException(status_code=404, detail="Could not find a channel matching that name.")

@router.post("/youtube-rss/channels")
def add_yt_rss_channel(req: YTRssAddRequest) -> Dict[str, str]:
    """
    Add a YouTube channel directly using its UC... channel identifier.

    Args:
        req (YTRssAddRequest): Channel name and ID.

    Returns:
        Dict[str, str]: Confirmation message (`{"message": str}`).

    Raises:
        HTTPException: 400 if channel already exists or invalid.
    """
    success, msg = add_channel(req.name.strip(), req.channel_id.strip())
    if success:
        return {"message": msg}
    raise HTTPException(status_code=400, detail=msg)

class YTRssBulkRequest(BaseModel):
    channels: List[Dict[str, str]] = Field(..., description="List of channel records (`{'name': str, 'id': str}`).")

@router.post("/youtube-rss/channels/bulk")
def bulk_add_yt_rss_channels(req: YTRssBulkRequest) -> Dict[str, Any]:
    """
    Import multiple YouTube channel feeds simultaneously.

    Args:
        req (YTRssBulkRequest): List of channel objects with name and ID.

    Returns:
        Dict[str, Any]: Counts of added channels and skipped duplicates.
    """
    added, skipped = bulk_add_channels(req.channels)
    return {"added": added, "skipped": skipped, "message": f"Import complete! Added {added} channels. (Skipped {skipped} duplicates)"}

class YTRssImportRequest(BaseModel):
    file_hash: str = Field(..., min_length=1, description="Uploaded Google Takeout CSV file hash.")

@router.post("/youtube-rss/channels/import-csv")
def import_yt_rss_csv(req: YTRssImportRequest) -> Dict[str, Any]:
    """
    Import YouTube subscription list from a Google Takeout subscriptions CSV file.

    Args:
        req (YTRssImportRequest): Hash key of uploaded CSV in cache.

    Returns:
        Dict[str, Any]: Import count summary and duplicate count.

    Raises:
        HTTPException: 400 if file not found or CSV format invalid.
    """
    clean_hash = req.file_hash.strip()
    tmp_path = os.path.join(".", "uploads", clean_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    with open(tmp_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
        
    success, result = parse_youtube_takeout_csv(content)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    added, skipped = bulk_add_channels(result)
    return {"added": added, "skipped": skipped, "message": f"Import complete! Added {added} channels. (Skipped {skipped} duplicates)"}

@router.delete("/youtube-rss/channels/{channel_id}")
def delete_yt_rss_channel(channel_id: str) -> Dict[str, str]:
    """
    Delete a YouTube channel from tracked RSS feeds.

    Args:
        channel_id (str): UC... channel identifier.

    Returns:
        Dict[str, str]: Confirmation status message.
    """
    clean_id = channel_id.strip()
    delete_channel(clean_id)
    return {"message": "Channel deleted"}

@router.get("/youtube-rss/feed")
def get_yt_rss_feed() -> Dict[str, Any]:
    """
    Retrieve cached aggregated video feed from all tracked YouTube channels.

    Returns:
        Dict[str, Any]: Cached dictionary with tracked IDs, channel data, and sorted videos.
    """
    return load_feed_cache()

def fetch_single_channel(channel: Dict[str, Any]) -> Tuple[Dict[str, Any], bool, List[Dict[str, Any]]]:
    """
    Worker fetching the latest video entries for a single YouTube channel RSS feed.

    Args:
        channel (Dict[str, Any]): Channel metadata with 'id' and 'name'.

    Returns:
        Tuple[Dict[str, Any], bool, List[Dict[str, Any]]]: Channel dict, success boolean, and video list.
    """
    success, videos = fetch_latest_videos(channel['id'], limit=15)
    return channel, success, videos

@router.post("/youtube-rss/feed/refresh")
async def refresh_yt_rss_feed() -> Dict[str, Any]:
    """
    Refresh and parse latest video feeds for all tracked YouTube channels concurrently.

    Returns:
        Dict[str, Any]: Updated aggregate feed cache data.
    """
    channels = load_tracked_channels()
    if not channels:
        return {"tracked_ids": [], "channel_data": {}, "all_videos": []}
        
    all_videos: List[Dict[str, Any]] = []
    channel_data: Dict[str, Any] = {}
    
    def _fetch_all() -> None:
        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
            future_to_channel = {executor.submit(fetch_single_channel, ch): ch for ch in channels}
            for future in concurrent.futures.as_completed(future_to_channel):
                channel, success, videos = future.result()
                if success and videos:
                    channel_data[channel['id']] = {
                        "name": channel['name'],
                        "videos": videos[:3] 
                    }
                    for v in videos:
                        v['channel_name'] = channel['name']
                        v['channel_id'] = channel['id']
                        all_videos.append(v)
                else:
                    channel_data[channel['id']] = {"name": channel['name'], "videos": []}
                    
    await asyncio.to_thread(_fetch_all)
    
    all_videos.sort(key=lambda x: x.get('published', ''), reverse=True)
    current_tracked_ids = [c['id'] for c in channels]
    
    cache_data = {
        "tracked_ids": current_tracked_ids,
        "channel_data": channel_data,
        "all_videos": all_videos
    }
    save_feed_cache(cache_data)
    return cache_data

# --- Web Scraper ---

class ScraperPreviewRequest(BaseModel):
    urls: List[str] = Field(..., min_items=1, description="List of URLs to generate screenshot previews for.")
    
@router.post("/scraper/preview")
async def get_scraper_preview(req: ScraperPreviewRequest) -> Dict[str, List[str]]:
    """
    Capture headless browser screenshots of target web pages for visual selector inspection.

    Args:
        req (ScraperPreviewRequest): Target web URLs.

    Returns:
        Dict[str, List[str]]: List of temp screenshot URLs (`{"image_urls": [...]}`).

    Raises:
        HTTPException: 500 if headless rendering fails.
    """
    def _run_preview() -> List[str]:
        images = []
        for idx, url in enumerate(req.urls):
            clean_url = url.strip()
            if not clean_url:
                continue
            success, result = get_page_preview_image(clean_url)
            if success:
                import shutil
                ext = os.path.splitext(result)[1]
                new_path = result.replace("preview_screenshot", f"preview_screenshot_{idx}")
                shutil.move(result, new_path)
                images.append(f"/temp/preview_screenshot_{idx}{ext}?t={uuid.uuid4().hex}")
        return images
        
    try:
        images = await asyncio.to_thread(_run_preview)
        return {"image_urls": images}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scraper/proxy")
async def scraper_proxy(url: str = Query(..., min_length=4, description="Web page URL to proxy")) -> HTMLResponse:
    """
    Fetch and proxy full rendered HTML from a JavaScript-heavy web page via Playwright.

    Args:
        url (str): Target web page URL.

    Returns:
        HTMLResponse: Rendered DOM HTML string.

    Raises:
        HTTPException: 500 if headless page fetch fails.
    """
    clean_url = url.strip()
    def _run_proxy() -> str:
        from utilities.web.util_playwright import get_proxy_html
        return get_proxy_html(clean_url)
        
    try:
        html_str = await asyncio.to_thread(_run_proxy)
        return HTMLResponse(content=html_str, status_code=200)
    except Exception as e:
        err_msg = str(e) or repr(e)
        raise HTTPException(status_code=500, detail=err_msg)

class ScraperStartRequest(BaseModel):
    links: List[str] = Field(..., min_items=1, description="List of target page URLs to scrape.")
    css_selector: str = Field(..., min_length=1, description="CSS selector targeting required elements.")
    headless: bool = Field(True, description="Run browser in headless mode.")

def _run_scraper_task(task_id: str, req: ScraperStartRequest) -> None:
    """
    Background worker executing headless browser scraping across multiple URLs.

    Args:
        task_id (str): Task identifier in download_tasks dictionary.
        req (ScraperStartRequest): Target URLs and CSS selector.

    Returns:
        None
    """
    download_tasks[task_id] = {"status": "running", "message": "Scraping in progress"}
    try:
        success, results = run_headless_scraper(req.links, req.css_selector.strip(), req.headless)
        if success:
            download_tasks[task_id] = {"status": "completed", "message": "Scraping completed!", "result": results}
        else:
            download_tasks[task_id] = {"status": "failed", "message": str(results)}
    except Exception as e:
        download_tasks[task_id] = {"status": "failed", "message": str(e)}

@router.post("/scraper/start")
def start_scraper(req: ScraperStartRequest, background_tasks: BackgroundTasks) -> Dict[str, str]:
    """
    Launch a background headless web scraping job extracting elements matching a CSS selector.

    Args:
        req (ScraperStartRequest): Links and CSS selector query.
        background_tasks (BackgroundTasks): Background worker queue.

    Returns:
        Dict[str, str]: Created task identifier (`{"task_id": str}`).
    """
    task_id = str(uuid.uuid4())
    download_tasks[task_id] = {"status": "pending", "message": "Queued"}
    background_tasks.add_task(_run_scraper_task, task_id, req)
    return {"task_id": task_id}

@router.get("/scraper/status/{task_id}")
def check_scraper_status(task_id: str) -> Dict[str, Any]:
    """
    Poll the execution status and scraped data results of a background scraper job.

    Args:
        task_id (str): Scraper task UUID.

    Returns:
        Dict[str, Any]: Job status dictionary with results payload.

    Raises:
        HTTPException: 404 if task_id does not exist.
    """
    clean_id = task_id.strip()
    if clean_id not in download_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return download_tasks[clean_id]

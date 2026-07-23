import os
import uuid
import asyncio
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from utilities.util_yt import search_youtube, download_youtube

router = APIRouter(
    prefix="/api/web-downloads",
    tags=["Web & Downloads"]
)

# In-memory store for background task statuses (For pilot purposes)
download_tasks = {}

class DownloadRequest(BaseModel):
    url: str
    is_audio: bool = False
    resolution: str = "Best"
    output_dir: str = ""

@router.get("/youtube/search")
def search_yt(q: str, max_results: int = 5):
    """Search YouTube and return results."""
    try:
        success, results = search_youtube(q, limit=max_results)
        if not success:
            raise HTTPException(status_code=500, detail=results)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _run_yt_download(task_id: str, req: DownloadRequest):
    """Background runner for youtube download"""
    download_tasks[task_id] = {"status": "downloading", "message": "Download started..."}
    try:
        # Default fallback to user downloads if none specified
        output_dir = req.output_dir if req.output_dir else os.path.join(os.path.expanduser('~'), 'Downloads')
        
        success, msg, final_path = download_youtube(
            url=req.url,
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
def start_yt_download(req: DownloadRequest, background_tasks: BackgroundTasks):
    """Starts a YouTube download in the background."""
    task_id = str(uuid.uuid4())
    download_tasks[task_id] = {"status": "pending", "message": "Queued"}
    background_tasks.add_task(_run_yt_download, task_id, req)
    return {"task_id": task_id}

@router.get("/youtube/download/{task_id}")
def check_yt_download(task_id: str):
    """Check status of a download task."""
    if task_id not in download_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return download_tasks[task_id]

from utilities.util_spotify_download import download_playlist_cli

class SpotifyDownloadRequest(BaseModel):
    url: str
    output_dir: str = ""
    audio_format: str = "mp3"
    bitrate: str = "320k"

def _run_spotify_download(task_id: str, req: SpotifyDownloadRequest):
    download_tasks[task_id] = {"status": "downloading", "message": "Spotify download started..."}
    try:
        output_dir = req.output_dir if req.output_dir else os.path.join(os.path.expanduser('~'), 'Music')
        success = download_playlist_cli(
            playlist_url=req.url,
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
def start_spotify_download(req: SpotifyDownloadRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    download_tasks[task_id] = {"status": "pending", "message": "Queued"}
    background_tasks.add_task(_run_spotify_download, task_id, req)
    return {"task_id": task_id}

@router.get("/spotify/download/{task_id}")
def check_spotify_download(task_id: str):
    if task_id not in download_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return download_tasks[task_id]
from utilities.util_rss import load_subscriptions, save_subscriptions, fetch_all_feeds, preview_rss_feed

@router.get("/rss/subscriptions")
def get_rss_subscriptions():
    try:
        subs = load_subscriptions()
        # Convert dictionary {url: title} to list of objects for the frontend
        sub_list = [{"title": title, "url": url} for url, title in subs.items()]
        return {"subscriptions": sub_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RssSubscriptionRequest(BaseModel):
    title: str
    url: str

@router.post("/rss/subscriptions")
def add_rss_subscription(req: RssSubscriptionRequest):
    try:
        subs = load_subscriptions()
        subs[req.url] = req.title # Store URL as key, Title as value
        save_subscriptions(subs)
        sub_list = [{"title": title, "url": url} for url, title in subs.items()]
        return {"message": "Subscription added successfully", "subscriptions": sub_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rss/subscriptions/remove")
def remove_rss_subscription(req: RssSubscriptionRequest):
    try:
        subs = load_subscriptions()
        if req.url in subs:
            del subs[req.url]
            save_subscriptions(subs)
        sub_list = [{"title": title, "url": url} for url, title in subs.items()]
        return {"message": "Subscription removed successfully", "subscriptions": sub_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_rss import load_subscriptions, save_subscriptions, fetch_all_feeds, preview_rss_feed, load_disk_cache, save_disk_cache
import time

@router.get("/rss/feeds")
def get_rss_feeds(force_refresh: bool = False):
    try:
        articles, mtime = load_disk_cache()
        # If cache is valid and not forced to refresh (older than 1 hour or empty)
        if not force_refresh and articles and (time.time() - mtime < 3600):
            return {"articles": articles, "cached": True}
            
        subs = load_subscriptions()
        urls = list(subs.keys()) # Keys are URLs
        articles = fetch_all_feeds(urls)
        save_disk_cache(articles)
        return {"articles": articles, "cached": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/rss/preview")
def preview_rss(url: str):
    success, data = preview_rss_feed(url)
    if not success:
        raise HTTPException(status_code=400, detail=str(data))
    return data

from utilities.util_yt_rss import (
    load_tracked_channels, add_channel, delete_channel, fetch_latest_videos, 
    search_youtube_channel, bulk_add_channels, load_feed_cache, save_feed_cache
)
import concurrent.futures

@router.get("/youtube-rss/channels")
def get_yt_rss_channels():
    return load_tracked_channels()

class YTRssSearchRequest(BaseModel):
    query: str
    
class YTRssAddRequest(BaseModel):
    name: str
    channel_id: str

@router.post("/youtube-rss/channels/search")
def search_yt_rss_channel(req: YTRssSearchRequest):
    name, c_id = search_youtube_channel(req.query)
    if c_id:
        success, msg = add_channel(name, c_id)
        if success:
            return {"message": f"Found and added: {name} ({c_id})", "channel_id": c_id, "name": name}
        raise HTTPException(status_code=400, detail=msg)
    raise HTTPException(status_code=404, detail="Could not find a channel matching that name.")

@router.post("/youtube-rss/channels")
def add_yt_rss_channel(req: YTRssAddRequest):
    success, msg = add_channel(req.name, req.channel_id)
    if success:
        return {"message": msg}
    raise HTTPException(status_code=400, detail=msg)

class YTRssBulkRequest(BaseModel):
    channels: list[dict] # list of {"name": str, "id": str}

@router.post("/youtube-rss/channels/bulk")
def bulk_add_yt_rss_channels(req: YTRssBulkRequest):
    added, skipped = bulk_add_channels(req.channels)
    return {"added": added, "skipped": skipped, "message": f"Import complete! Added {added} channels. (Skipped {skipped} duplicates)"}

@router.delete("/youtube-rss/channels/{channel_id}")
def delete_yt_rss_channel(channel_id: str):
    delete_channel(channel_id)
    return {"message": "Channel deleted"}

@router.get("/youtube-rss/feed")
def get_yt_rss_feed():
    return load_feed_cache()

def fetch_single_channel(channel):
    success, videos = fetch_latest_videos(channel['id'], limit=15)
    return channel, success, videos

@router.post("/youtube-rss/feed/refresh")
async def refresh_yt_rss_feed():
    channels = load_tracked_channels()
    if not channels:
        return {"tracked_ids": [], "channel_data": {}, "all_videos": []}
        
    all_videos = []
    channel_data = {}
    
    def _fetch_all():
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
                    
    # Run the threadpool in asyncio to not block the event loop
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

from utilities.util_scraper import get_page_preview_image, run_headless_scraper

class ScraperPreviewRequest(BaseModel):
    url: str
    
@router.post("/scraper/preview")
async def get_scraper_preview(req: ScraperPreviewRequest):
    # Run sync playwright in a thread
    def _run_preview():
        from utilities.util_scraper import get_page_preview_image
        return get_page_preview_image(req.url)
        
    success, result = await asyncio.to_thread(_run_preview)
    if success:
        return {"image_url": f"/static/temp/preview_screenshot.png?t={uuid.uuid4().hex}"} # Add cache buster
    else:
        raise HTTPException(status_code=400, detail=result)

@router.get("/scraper/proxy")
async def scraper_proxy(url: str):
    import asyncio
    
    def _run_proxy():
        from utilities.util_playwright import get_proxy_html
        return get_proxy_html(url)
        
    try:
        html_str = await asyncio.to_thread(_run_proxy)
        return HTMLResponse(content=html_str, status_code=200)
    except Exception as e:
        err_msg = str(e)
        if not err_msg:
            err_msg = repr(e)
        raise HTTPException(status_code=500, detail=err_msg)

class ScraperStartRequest(BaseModel):
    links: list[str]
    css_selector: str
    headless: bool = True

def _run_scraper_task(task_id: str, req: ScraperStartRequest):
    download_tasks[task_id] = {"status": "running", "message": "Scraping in progress..."}
    try:
        success, result_df = run_headless_scraper(req.links, req.css_selector, req.headless)
        if success:
            # result_df is a pandas DataFrame, convert to dict records
            records = result_df.to_dict(orient="records")
            download_tasks[task_id] = {"status": "completed", "message": "Scraping completed!", "result": records}
        else:
            download_tasks[task_id] = {"status": "failed", "message": str(result_df)}
    except Exception as e:
        download_tasks[task_id] = {"status": "failed", "message": str(e)}

@router.post("/scraper/start")
def start_scraper(req: ScraperStartRequest, background_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    download_tasks[task_id] = {"status": "pending", "message": "Queued"}
    background_tasks.add_task(_run_scraper_task, task_id, req)
    return {"task_id": task_id}

@router.get("/scraper/status/{task_id}")
def check_scraper_status(task_id: str):
    if task_id not in download_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return download_tasks[task_id]

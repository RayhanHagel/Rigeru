import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(
    prefix="/api/media-entertainment",
    tags=["Media & Entertainment"]
)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "cache")
MANGA_CACHE_FILE = os.path.join(CACHE_DIR, "reading_library.json")

@router.get("/manga-library")
def get_manga_library():
    """Returns the manga library cache data."""
    from utilities.util_manga import get_manga_library_data
    try:
        return get_manga_library_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SortMangaRequest(BaseModel):
    keys: list[str]

@router.post("/manga-library/sort")
def sort_manga_library(req: SortMangaRequest):
    """Reorders the manga library based on the provided list of keys."""
    from utilities.util_manga import sort_manga_library_data
    try:
        reordered = sort_manga_library_data(req.keys)
        return {"message": "Order saved successfully.", "data": reordered}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateProgressRequest(BaseModel):
    title: str
    chapter_read: int

@router.post("/manga-library/update-progress")
def update_manga_progress(req: UpdateProgressRequest):
    """Updates the chapter_read for a given manga title."""
    from utilities.util_manga import update_manga_library_progress
    try:
        new_progress = update_manga_library_progress(req.title, req.chapter_read)
        return {"message": "Progress updated.", "chapter_read": new_progress}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeleteMangaRequest(BaseModel):
    title: str

@router.post("/manga-library/delete")
def delete_manga_from_library(req: DeleteMangaRequest):
    from utilities.util_manga import delete_manga_from_library_data
    try:
        delete_manga_from_library_data(req.title)
        return {"message": "Deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/manga-library/refresh")
def refresh_manga_library():
    """Refreshes the manga library by re-fetching chapter counts from sources."""
    try:
        from utilities.util_manga import refresh_library_standalone, get_manga_library_data
        from utilities.util_json import save_json
        
        cache = get_manga_library_data()
        if not cache:
            return {"message": "No library to refresh."}
            
        updated_cache, results = refresh_library_standalone(cache)
        save_json("./cache/reading_library.json", updated_cache)
        
        success_count = sum(1 for r in results if r["success"])
        fail_count = len(results) - success_count
        
        return {
            "message": f"Refreshed {success_count} titles successfully. Failed: {fail_count}.",
            "results": results,
            "data": updated_cache
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_manga import search_titles, asura_get_chapter, mangadex_get_chapter, get_asura_images, get_mangadex_images
import asyncio

@router.get("/manga-search/query")
def query_manga_search(title: str, websites: str):
    """Searches for manga titles. `websites` should be comma separated e.g., '🌑 AsuraScans,😺 MangaDex'"""
    try:
        site_list = [s.strip() for s in websites.split(",") if s.strip()]
        results = search_titles(site_list, title)
        # util_manga sets st.session_state.search_lookup, but we need to return the mapping
        # so let's rebuild it or just return the results. Wait, search_titles just returns a list of keys.
        # But we also need the URL. Since search_titles is designed for Streamlit's session_state,
        # we can just run the underlying functions directly.
        combined = {}
        for site in site_list:
            if site == "🌑 AsuraScans":
                from utilities.util_manga import search_titles_asura
                res = search_titles_asura(title)
                if res: combined.update(res)
            elif site == "😺 MangaDex":
                from utilities.util_manga import search_titles_mangadex
                res = search_titles_mangadex(title)
                if res: combined.update(res)
        return {"results": combined}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AddMangaRequest(BaseModel):
    title: str
    url: str
    website: str # e.g., "asurascans.com/" or "mangadex.org/"

@router.post("/manga-search/add")
def add_manga_to_library(req: AddMangaRequest):
    try:
        chapter_json = None
        if req.website == "asurascans.com/":
            chapter_json = asura_get_chapter(chapter_url=req.url, website=req.website)
        elif req.website == "mangadex.org/":
            chapter_json = mangadex_get_chapter(chapter_url=req.url, website=req.website)
            
        if chapter_json is None:
            raise HTTPException(status_code=400, detail="Failed to fetch manga info.")
            
        cache = {}
        if os.path.exists(MANGA_CACHE_FILE):
            with open(MANGA_CACHE_FILE, "r") as f:
                cache = json.load(f)
                
        # The frontend title includes the emoji prefix, we can strip it or keep it
        cache[req.title] = chapter_json
        with open(MANGA_CACHE_FILE, "w") as f:
            json.dump(cache, f, indent=2)
            
        return {"message": f"Added {req.title} to library.", "data": chapter_json}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/manga-read/pages")
def get_manga_pages(chapter_url: str, website: str):
    try:
        if website == "asurascans.com/":
            # get_asura_images is synchronous now
            image_urls = get_asura_images(chapter_url)
        elif website == "mangadex.org/":
            image_urls = get_mangadex_images(chapter_url)
        else:
            raise HTTPException(status_code=400, detail="Unsupported website.")
            
        if not image_urls:
            raise HTTPException(status_code=404, detail="No images found for this chapter.")
            
        return {"images": image_urls}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DownloadChapterRequest(BaseModel):
    title: str
    chapter_url: str
    website: str

@router.post("/manga-read/download")
def api_download_chapter(req: DownloadChapterRequest):
    try:
        from utilities.util_manga import download_chapter
        # Extract chapter key
        chapter_key = req.chapter_url.split("/")[-1]
        if req.website == "mangadex.org/":
            match = __import__("re").search(r'chapter-([0-9.]+)', req.chapter_url)
            if match:
                chapter_key = match.group(1)
        elif req.website == "asurascans.com/":
            parts = req.chapter_url.split("-chapter-")
            if len(parts) > 1:
                chapter_key = parts[1].replace("/", "")

        success = download_chapter(req.title, chapter_key, req.chapter_url, req.website)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to download chapter.")
        return {"message": "Chapter downloaded successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi.responses import FileResponse
@router.get("/manga-read/pdf")
def get_manga_local_pdf(title: str, chapter_url: str, website: str):
    try:
        # Extract chapter key
        chapter_key = chapter_url.split("/")[-1]
        if website == "mangadex.org/":
            match = __import__("re").search(r'chapter-([0-9.]+)', chapter_url)
            if match:
                chapter_key = match.group(1)
        elif website == "asurascans.com/":
            parts = chapter_url.split("-chapter-")
            if len(parts) > 1:
                chapter_key = parts[1].replace("/", "")
                
        pdf_path = os.path.join(CACHE_DIR, "library", title, f"Chapter {str(chapter_key).zfill(2)}.pdf")
        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=404, detail=f"PDF file not found: {pdf_path}")
            
        return FileResponse(pdf_path, media_type='application/pdf')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import Response

@router.get("/manga-read/local-pages")
def get_manga_local_pages(title: str, chapter_url: str, website: str):
    try:
        from utilities.util_manga import get_pdf_page_count
        count = get_pdf_page_count(title, chapter_url, website)
        if count == 0:
            raise HTTPException(status_code=404, detail="Local PDF not found or empty.")
        
        import urllib.parse
        encoded_title = urllib.parse.quote(title)
        encoded_url = urllib.parse.quote(chapter_url)
        encoded_website = urllib.parse.quote(website)
        
        images = [
            f"/api/media-entertainment/manga-read/pdf-page?title={encoded_title}&chapter_url={encoded_url}&website={encoded_website}&page={i}"
            for i in range(count)
        ]
        return {"images": images}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/manga-read/pdf-page")
def get_manga_pdf_page(title: str, chapter_url: str, website: str, page: int):
    try:
        from utilities.util_manga import get_pdf_page_image
        img_bytes = get_pdf_page_image(title, chapter_url, website, page)
        if not img_bytes:
            raise HTTPException(status_code=404, detail=f"Page {page} not found.")
        
        return Response(content=img_bytes, media_type="image/jpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_twitch import read_cache, save_config as twitch_save_config, get_all_live_statuses
from typing import List, Optional

class TwitchConfigRequest(BaseModel):
    channels: List[str]

@router.get("/twitch-watch")
def get_twitch_config():
    try:
        channels = read_cache()
        return {"channels": channels}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/twitch-watch/config")
def update_twitch_config(req: TwitchConfigRequest):
    try:
        twitch_save_config(channel="", replace_data=req.channels)
        return {"message": "Config updated successfully.", "channels": req.channels}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/twitch-watch/live-status")
def get_twitch_live_status(req: TwitchConfigRequest):
    try:
        live_channels = get_all_live_statuses(tuple(req.channels))
        return {"live_channels": live_channels}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_twitch import check_streamlink_installed, install_streamlink, launch_streamlink

@router.get("/twitch-watch/streamlink/status")
def api_check_streamlink_installed():
    try:
        is_installed = check_streamlink_installed()
        return {"installed": is_installed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/twitch-watch/streamlink/install")
def api_install_streamlink():
    try:
        success = install_streamlink()
        if success:
            return {"message": "Streamlink installed successfully."}
        else:
            raise HTTPException(status_code=500, detail="Failed to install Streamlink.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TwitchLaunchRequest(BaseModel):
    channel: str

@router.post("/twitch-watch/streamlink/launch")
def api_launch_streamlink(req: TwitchLaunchRequest):
    try:
        success = launch_streamlink(req.channel)
        if success:
            return {"message": f"Launched streamlink for {req.channel}."}
        else:
            raise HTTPException(status_code=500, detail="Failed to launch Streamlink.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_spotify_listening import read_config_cache as spotify_read_config, save_config_cache as spotify_save_config, check_lastfm

class SpotifyConfigRequest(BaseModel):
    username: str
    refresh_interval: int
    timezone: str
    fetch_method: str
    api_key: str
    track_limit: int

@router.get("/spotify-scrobbler/config")
def get_spotify_config():
    try:
        return spotify_read_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/spotify-scrobbler/config")
def update_spotify_config(req: SpotifyConfigRequest):
    try:
        spotify_save_config(req.dict())
        return {"message": "Config saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/spotify-scrobbler/feed")
def get_spotify_feed(username: str, fetch_method: str = "Scraping", api_key: str = "", limit: int = 5, tz_str: str = "UTC+00:00"):
    try:
        avatar_url, scrobble_amount, scrobble_artist, recent_songs = check_lastfm(username, fetch_method, api_key, limit, tz_str)
        return {
            "avatar_url": avatar_url,
            "scrobble_amount": scrobble_amount,
            "scrobble_artist": scrobble_artist,
            "recent_songs": recent_songs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_malsync import (
    load_anime_list, update_progress, remove_from_library,
    load_manga_list, update_manga_progress, remove_from_manga_library,
    generate_auth_url, exchange_code_for_token, get_valid_token,
    sync_user_list_from_mal, load_credentials, save_credentials
)

class MalCredentialsRequest(BaseModel):
    client_id: str
    client_secret: str

class MalProgressRequest(BaseModel):
    mal_id: str
    progress: int

class MalExchangeRequest(BaseModel):
    code: str

@router.get("/malsync/credentials")
def get_mal_credentials():
    return load_credentials()

@router.post("/malsync/credentials")
def update_mal_credentials(req: MalCredentialsRequest):
    save_credentials(req.client_id, req.client_secret)
    return {"message": "Credentials saved successfully"}

@router.get("/malsync/auth/url")
def get_mal_auth_url():
    url = generate_auth_url()
    if not url:
        raise HTTPException(status_code=400, detail="Client ID not configured")
    return {"url": url}

@router.get("/malsync/auth/status")
def get_mal_auth_status():
    return {"is_logged_in": get_valid_token() is not None}

@router.post("/malsync/auth/exchange")
def exchange_mal_code(req: MalExchangeRequest):
    success, msg = exchange_code_for_token(req.code)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": "Authenticated successfully"}

@router.post("/malsync/sync")
def trigger_mal_sync():
    success, msg = sync_user_list_from_mal()
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

@router.get("/malsync/library/{media_type}")
def get_mal_library(media_type: str):
    if media_type.lower() == "anime":
        return load_anime_list()
    elif media_type.lower() == "manga":
        return load_manga_list()
    raise HTTPException(status_code=400, detail="Invalid media type")

@router.post("/malsync/progress/{media_type}")
def update_mal_progress(media_type: str, req: MalProgressRequest):
    if media_type.lower() == "anime":
        update_progress(req.mal_id, req.progress)
    elif media_type.lower() == "manga":
        update_manga_progress(req.mal_id, req.progress)
    else:
        raise HTTPException(status_code=400, detail="Invalid media type")
    return {"message": "Progress updated"}

@router.delete("/malsync/library/{media_type}/{mal_id}")
def delete_mal_item(media_type: str, mal_id: str):
    if media_type.lower() == "anime":
        remove_from_library(mal_id)
    elif media_type.lower() == "manga":
        remove_from_manga_library(mal_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid media type")
    return {"message": "Item removed"}

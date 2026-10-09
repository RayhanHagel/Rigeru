import json
import os
import re
import urllib.parse
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from utilities.entertainment.util_manga import (
    get_manga_library_data, sort_manga_library_data,
    update_manga_library_progress, delete_manga_from_library_data,
    refresh_library_standalone, search_titles_asura, search_titles_mangadex,
    asura_get_chapter, mangadex_get_chapter, get_asura_images, get_mangadex_images,
    download_chapter, get_pdf_page_count, get_pdf_page_image,
    save_manga_library_data, add_manga_to_library_data
)
from utilities.core.util_store import get_data, set_data
from utilities.entertainment.util_twitch import (
    read_cache as twitch_read_cache,
    save_config as twitch_save_config,
    get_all_live_statuses,
    check_streamlink_installed,
    install_streamlink,
    launch_streamlink
)
from utilities.entertainment.util_spotify_listening import (
    read_config_cache as spotify_read_config,
    save_config_cache as spotify_save_config,
    check_lastfm
)
from utilities.entertainment.util_malsync import (
    load_anime_list, update_progress, remove_from_library,
    load_manga_list, update_manga_progress, remove_from_manga_library,
    generate_auth_url, exchange_code_for_token, get_valid_token,
    sync_user_list_from_mal, load_credentials, save_credentials
)

router = APIRouter(
    prefix="/api/media-entertainment",
    tags=["Media & Entertainment"]
)

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "cache")

# --- Manga Library & Reader ---

@router.get("/manga-library")
def get_manga_library() -> Dict[str, Any]:
    """
    Retrieve all bookmarked manga series, chapter progress, and metadata from the local library.

    Returns:
        Dict[str, Any]: Dictionary mapping manga titles to chapter history and source information.

    Raises:
        HTTPException: 500 if reading the library cache fails.
    """
    try:
        return get_manga_library_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SortMangaRequest(BaseModel):
    keys: List[str] = Field(..., description="Ordered list of manga titles.")

@router.post("/manga-library/sort")
def sort_manga_library(req: SortMangaRequest) -> Dict[str, Any]:
    """
    Reorder the manga library collection according to user preference.

    Args:
        req (SortMangaRequest): List of title keys in the desired sequence.

    Returns:
        Dict[str, Any]: Confirmation message and newly ordered library dictionary.

    Raises:
        HTTPException: 500 if updating the library order fails.
    """
    try:
        reordered = sort_manga_library_data(req.keys)
        return {"message": "Order saved successfully.", "data": reordered}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UpdateProgressRequest(BaseModel):
    title: str = Field(..., min_length=1, description="Manga title.")
    chapter_read: int = Field(..., ge=0, description="Highest chapter index read.")

@router.post("/manga-library/update-progress")
def update_manga_progress(req: UpdateProgressRequest) -> Dict[str, Any]:
    """
    Update the user's read chapter progress for a specific manga series.

    Args:
        req (UpdateProgressRequest): Title and chapter number read.

    Returns:
        Dict[str, Any]: Confirmation message and persisted chapter read count.

    Raises:
        HTTPException: 404 if manga title not found in library, 500 on store error.
    """
    clean_title = req.title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Manga title cannot be empty.")
    try:
        new_progress = update_manga_library_progress(clean_title, req.chapter_read)
        return {"message": "Progress updated.", "chapter_read": new_progress}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeleteMangaRequest(BaseModel):
    title: str = Field(..., min_length=1, description="Manga title to remove.")

@router.post("/manga-library/delete")
def delete_manga_from_library(req: DeleteMangaRequest) -> Dict[str, str]:
    """
    Delete a manga series and its reading history from the local library.

    Args:
        req (DeleteMangaRequest): Title of the series to remove.

    Returns:
        Dict[str, str]: Confirmation message (`{"message": "Deleted successfully."}`).

    Raises:
        HTTPException: 404 if title is not in library, 500 on disk error.
    """
    clean_title = req.title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Manga title cannot be empty.")
    try:
        delete_manga_from_library_data(clean_title)
        return {"message": "Deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/manga-library/refresh")
def refresh_manga_library() -> Dict[str, Any]:
    """
    Re-fetch online chapter lists for all titles in the library and update chapter availability.

    Returns:
        Dict[str, Any]: Summary message, per-title results, and updated library cache.

    Raises:
        HTTPException: 500 if refreshing library fails.
    """
    try:
        cache = get_manga_library_data()
        if not cache:
            return {"message": "No library to refresh."}
            
        updated_cache, results = refresh_library_standalone(cache)
        save_manga_library_data(updated_cache)
        
        success_count = sum(1 for r in results if r.get("success"))
        fail_count = len(results) - success_count
        
        return {
            "message": f"Refreshed {success_count} titles successfully. Failed: {fail_count}.",
            "results": results,
            "data": updated_cache
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/manga-search/query")
def query_manga_search(title: str, websites: str) -> Dict[str, Any]:
    """
    Search online providers (AsuraScans, MangaDex) for manga matching the given title.

    Args:
        title (str): Search keyword / title query.
        websites (str): Comma-separated provider names (e.g. 'AsuraScans,MangaDex').

    Returns:
        Dict[str, Any]: Combined dictionary of discovered manga titles, URLs, and cover images.

    Raises:
        HTTPException: 400 if title query is empty, 500 on network failure.
    """
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=400, detail="Search title query cannot be empty.")
    try:
        site_list = [s.strip() for s in websites.split(",") if s.strip()]
        combined: Dict[str, Any] = {}
        for site in site_list:
            if site == "AsuraScans":
                res = search_titles_asura(clean_title)
                if res:
                    combined.update(res)
            elif site == "MangaDex":
                res = search_titles_mangadex(clean_title)
                if res:
                    combined.update(res)
        return {"results": combined}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AddMangaRequest(BaseModel):
    title: str = Field(..., min_length=1, description="Manga title.")
    url: str = Field(..., min_length=5, description="Provider series URL.")
    website: str = Field(..., description="Provider domain (e.g., 'asurascans.com/' or 'mangadex.org/').")

@router.post("/manga-search/add")
def add_manga_to_library(req: AddMangaRequest) -> Dict[str, Any]:
    """
    Scrape chapter index and bookmark a new manga series into the local library.

    Args:
        req (AddMangaRequest): Title, series URL, and website identifier.

    Returns:
        Dict[str, Any]: Confirmation message and scraped chapter metadata.

    Raises:
        HTTPException: 400 if scraping fails or provider is unsupported, 500 on disk error.
    """
    try:
        chapter_json = None
        if req.website == "asurascans.com/":
            chapter_json = asura_get_chapter(chapter_url=req.url, website=req.website)
        elif req.website == "mangadex.org/":
            chapter_json = mangadex_get_chapter(chapter_url=req.url, website=req.website)
        else:
            raise HTTPException(status_code=400, detail="Unsupported manga provider website.")
            
        if chapter_json is None:
            raise HTTPException(status_code=400, detail="Failed to fetch manga info.")
            
        clean_title = req.title.strip()
        add_manga_to_library_data(clean_title, chapter_json)
            
        return {"message": f"Added {clean_title} to library.", "data": chapter_json}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/manga-read/pages")
def get_manga_pages(chapter_url: str, website: str) -> Dict[str, List[str]]:
    """
    Scrape and extract direct high-resolution image URLs for all pages in a manga chapter.

    Args:
        chapter_url (str): Remote chapter URL.
        website (str): Provider domain identifier ('asurascans.com/' or 'mangadex.org/').

    Returns:
        Dict[str, List[str]]: List of web-accessible image URLs for the chapter (`{"images": [...]}`).

    Raises:
        HTTPException: 400 if unsupported site, 404 if no images found, 500 on scrape error.
    """
    if not chapter_url.strip():
        raise HTTPException(status_code=400, detail="Chapter URL cannot be empty.")
    try:
        if website == "asurascans.com/":
            image_urls = get_asura_images(chapter_url.strip())
        elif website == "mangadex.org/":
            image_urls = get_mangadex_images(chapter_url.strip())
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
    title: str = Field(..., min_length=1, description="Manga title.")
    chapter_url: str = Field(..., min_length=5, description="Chapter URL.")
    website: str = Field(..., description="Provider domain identifier.")

@router.post("/manga-read/download")
def api_download_chapter(req: DownloadChapterRequest) -> Dict[str, str]:
    """
    Download all chapter pages and compile them into a local offline PDF document.

    Args:
        req (DownloadChapterRequest): Manga title, chapter URL, and provider identifier.

    Returns:
        Dict[str, str]: Confirmation message (`{"message": "Chapter downloaded successfully."}`).

    Raises:
        HTTPException: 500 if download or PDF compilation fails.
    """
    try:
        chapter_key = req.chapter_url.split("/")[-1]
        if req.website == "mangadex.org/":
            match = re.search(r'chapter-([0-9.]+)', req.chapter_url)
            if match:
                chapter_key = match.group(1)
        elif req.website == "asurascans.com/":
            parts = req.chapter_url.split("-chapter-")
            if len(parts) > 1:
                chapter_key = parts[1].replace("/", "")

        success = download_chapter(req.title.strip(), chapter_key, req.chapter_url.strip(), req.website)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to download chapter.")
        return {"message": "Chapter downloaded successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/manga-read/pdf")
def get_manga_local_pdf(title: str, chapter_url: str, website: str) -> FileResponse:
    """
    Stream the compiled local PDF file for an offline manga chapter.

    Args:
        title (str): Manga series title.
        chapter_url (str): Chapter URL identifying the chapter index.
        website (str): Provider domain identifier.

    Returns:
        FileResponse: Binary PDF file response stream.

    Raises:
        HTTPException: 404 if local PDF file is not found on disk.
    """
    clean_title = title.strip()
    try:
        chapter_key = chapter_url.split("/")[-1]
        if website == "mangadex.org/":
            match = re.search(r'chapter-([0-9.]+)', chapter_url)
            if match:
                chapter_key = match.group(1)
        elif website == "asurascans.com/":
            parts = chapter_url.split("-chapter-")
            if len(parts) > 1:
                chapter_key = parts[1].replace("/", "")
                
        pdf_path = os.path.join(CACHE_DIR, "library", clean_title, f"Chapter {str(chapter_key).zfill(2)}.pdf")
        if not os.path.exists(pdf_path):
            raise HTTPException(status_code=404, detail=f"PDF file not found: {pdf_path}")
            
        return FileResponse(pdf_path, media_type='application/pdf')
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/manga-read/local-pages")
def get_manga_local_pages(title: str, chapter_url: str, website: str) -> Dict[str, List[str]]:
    """
    List rendered page endpoint URLs for a locally cached manga chapter PDF.

    Args:
        title (str): Manga title.
        chapter_url (str): Chapter URL.
        website (str): Provider domain.

    Returns:
        Dict[str, List[str]]: Array of backend proxy URLs to fetch individual rendered pages.

    Raises:
        HTTPException: 404 if local PDF does not exist or has zero pages.
    """
    clean_title = title.strip()
    try:
        count = get_pdf_page_count(clean_title, chapter_url.strip(), website)
        if count == 0:
            raise HTTPException(status_code=404, detail="Local PDF not found or empty.")
        
        encoded_title = urllib.parse.quote(clean_title)
        encoded_url = urllib.parse.quote(chapter_url.strip())
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
def get_manga_pdf_page(title: str, chapter_url: str, website: str, page: int) -> Response:
    """
    Render and return a single page from a cached manga PDF as a JPEG image.

    Args:
        title (str): Manga title.
        chapter_url (str): Chapter URL.
        website (str): Provider domain.
        page (int): 0-indexed page number.

    Returns:
        Response: Binary JPEG image response.

    Raises:
        HTTPException: 404 if page rendering fails or page is out of range.
    """
    if page < 0:
        raise HTTPException(status_code=400, detail="Page number must be non-negative.")
    try:
        img_bytes = get_pdf_page_image(title.strip(), chapter_url.strip(), website, page)
        if not img_bytes:
            raise HTTPException(status_code=404, detail=f"Page {page} not found.")
        
        return Response(content=img_bytes, media_type="image/jpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Twitch Watch ---

class TwitchConfigRequest(BaseModel):
    channels: List[str] = Field(..., description="List of Twitch streamer channel handles.")

@router.get("/twitch-watch")
def get_twitch_config() -> Dict[str, List[str]]:
    """
    Retrieve configured Twitch channels from the local tracking cache.

    Returns:
        Dict[str, List[str]]: Object containing list of monitored Twitch channel names.

    Raises:
        HTTPException: 500 if reading cache fails.
    """
    try:
        channels = twitch_read_cache()
        return {"channels": channels}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/twitch-watch/config")
def update_twitch_config(req: TwitchConfigRequest) -> Dict[str, Any]:
    """
    Save the list of tracked Twitch channels to persistent cache.

    Args:
        req (TwitchConfigRequest): Monitored channels list.

    Returns:
        Dict[str, Any]: Confirmation message and updated channels list.

    Raises:
        HTTPException: 500 if updating channels fails.
    """
    try:
        cleaned_channels = [c.strip() for c in req.channels if c.strip()]
        twitch_save_config(channel="", replace_data=cleaned_channels)
        return {"message": "Config updated successfully.", "channels": cleaned_channels}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/twitch-watch/live-status")
def get_twitch_live_status(req: TwitchConfigRequest) -> Dict[str, Any]:
    """
    Check real-time broadcasting and online stream status for the provided Twitch channels.

    Args:
        req (TwitchConfigRequest): Monitored channels list.

    Returns:
        Dict[str, Any]: Dictionary mapping channel names to their online stream metadata.

    Raises:
        HTTPException: 500 if live checking fails.
    """
    try:
        cleaned = [c.strip() for c in req.channels if c.strip()]
        live_channels = get_all_live_statuses(tuple(cleaned))
        return {"live_channels": live_channels}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/twitch-watch/streamlink/status")
def api_check_streamlink_installed() -> Dict[str, bool]:
    """
    Verify if the Streamlink CLI binary is available on the system PATH.

    Returns:
        Dict[str, bool]: Availability status (`{"installed": bool}`).

    Raises:
        HTTPException: 500 if PATH check encounters an error.
    """
    try:
        is_installed = check_streamlink_installed()
        return {"installed": is_installed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/twitch-watch/streamlink/install")
def api_install_streamlink() -> Dict[str, str]:
    """
    Install the Streamlink package via pip in the current Python environment.

    Returns:
        Dict[str, str]: Confirmation message (`{"message": "Streamlink installed successfully."}`).

    Raises:
        HTTPException: 500 if pip installation fails.
    """
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
    channel: str = Field(..., min_length=1, description="Twitch channel handle to launch in external player.")

@router.post("/twitch-watch/streamlink/launch")
def api_launch_streamlink(req: TwitchLaunchRequest) -> Dict[str, str]:
    """
    Launch a Twitch live stream in the user's default desktop media player (VLC/MPV) via Streamlink.

    Args:
        req (TwitchLaunchRequest): Target channel handle.

    Returns:
        Dict[str, str]: Status confirmation message.

    Raises:
        HTTPException: 400 if channel is empty, 500 if launcher fails.
    """
    clean_channel = req.channel.strip()
    if not clean_channel:
        raise HTTPException(status_code=400, detail="Channel handle cannot be empty.")
    try:
        success = launch_streamlink(clean_channel)
        if success:
            return {"message": f"Launched streamlink for {clean_channel}."}
        else:
            raise HTTPException(status_code=500, detail="Failed to launch Streamlink.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Spotify Scrobbler ---

class SpotifyConfigRequest(BaseModel):
    username: str = Field(..., min_length=1, description="Last.fm or Spotify user handle.")
    refresh_interval: int = Field(30, ge=5, le=3600, description="Auto-refresh polling interval in seconds.")
    timezone: str = Field("UTC+00:00", description="Display timezone string.")
    fetch_method: str = Field("Scraping", description="Fetch strategy ('Scraping' or 'API').")
    api_key: str = Field("", description="Optional Last.fm API developer key.")
    track_limit: int = Field(5, ge=1, le=50, description="Number of recent songs to display.")

@router.get("/spotify-scrobbler/config")
def get_spotify_config() -> Dict[str, Any]:
    """
    Retrieve stored Spotify/Last.fm scrobbler configuration settings.

    Returns:
        Dict[str, Any]: Scrobbler configuration dictionary.

    Raises:
        HTTPException: 500 if reading scrobbler config fails.
    """
    try:
        return spotify_read_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/spotify-scrobbler/config")
def update_spotify_config(req: SpotifyConfigRequest) -> Dict[str, str]:
    """
    Save Spotify/Last.fm scrobbler configuration settings.

    Args:
        req (SpotifyConfigRequest): User handle, API key, polling interval, and fetch preferences.

    Returns:
        Dict[str, str]: Status confirmation message.

    Raises:
        HTTPException: 500 if saving config fails.
    """
    try:
        spotify_save_config(req.dict())
        return {"message": "Config saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/spotify-scrobbler/feed")
def get_spotify_feed(
    username: str,
    fetch_method: str = "Scraping",
    api_key: str = "",
    limit: int = 5,
    tz_str: str = "UTC+00:00"
) -> Dict[str, Any]:
    """
    Fetch live listening activity, recent tracks, and user scrobble counts from Last.fm.

    Args:
        username (str): Last.fm username.
        fetch_method (str, optional): Strategy ('Scraping' or 'API'). Defaults to 'Scraping'.
        api_key (str, optional): Last.fm API key if using API method. Defaults to ''.
        limit (int, optional): Number of recent tracks to fetch. Defaults to 5.
        tz_str (str, optional): Timezone offset string. Defaults to 'UTC+00:00'.

    Returns:
        Dict[str, Any]: Avatar URL, total scrobbles, distinct artists, and recent songs list.

    Raises:
        HTTPException: 400 if username is empty, 500 if feed fetch encounters an error.
    """
    clean_user = username.strip()
    if not clean_user:
        raise HTTPException(status_code=400, detail="Username cannot be empty.")
    safe_limit = max(1, min(limit, 50))
    try:
        avatar_url, scrobble_amount, scrobble_artist, recent_songs = check_lastfm(
            clean_user, fetch_method, api_key.strip(), safe_limit, tz_str
        )
        return {
            "avatar_url": avatar_url,
            "scrobble_amount": scrobble_amount,
            "scrobble_artist": scrobble_artist,
            "recent_songs": recent_songs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- MyAnimeList (MAL) Sync ---

class MalCredentialsRequest(BaseModel):
    client_id: str = Field(..., min_length=1, description="MyAnimeList OAuth2 client ID.")
    client_secret: str = Field(..., min_length=1, description="MyAnimeList OAuth2 client secret.")

class MalProgressRequest(BaseModel):
    mal_id: str = Field(..., min_length=1, description="MAL anime or manga media ID.")
    progress: int = Field(..., ge=0, description="Updated episode or chapter count.")

class MalExchangeRequest(BaseModel):
    code: str = Field(..., min_length=1, description="OAuth2 authorization code returned from MAL.")

@router.get("/malsync/credentials")
def get_mal_credentials() -> Dict[str, str]:
    """
    Retrieve stored MyAnimeList OAuth API credentials (client_id, client_secret).

    Returns:
        Dict[str, str]: Credentials dictionary.
    """
    return load_credentials()

@router.post("/malsync/credentials")
def update_mal_credentials(req: MalCredentialsRequest) -> Dict[str, str]:
    """
    Store MyAnimeList OAuth2 client credentials to encrypted local settings.

    Args:
        req (MalCredentialsRequest): Client ID and secret.

    Returns:
        Dict[str, str]: Confirmation message (`{"message": "Credentials saved successfully"}`).
    """
    save_credentials(req.client_id.strip(), req.client_secret.strip())
    return {"message": "Credentials saved successfully"}

@router.get("/malsync/auth/url")
def get_mal_auth_url() -> Dict[str, str]:
    """
    Generate the OAuth2 authorization redirect URL for authenticating with MyAnimeList.

    Returns:
        Dict[str, str]: Authorization URL (`{"url": str}`).

    Raises:
        HTTPException: 400 if client ID is not configured.
    """
    url = generate_auth_url()
    if not url:
        raise HTTPException(status_code=400, detail="Client ID not configured")
    return {"url": url}

@router.get("/malsync/auth/status")
def get_mal_auth_status() -> Dict[str, bool]:
    """
    Check if a valid, unexpired MyAnimeList OAuth token exists in the system.

    Returns:
        Dict[str, bool]: Login status (`{"is_logged_in": bool}`).
    """
    return {"is_logged_in": get_valid_token() is not None}

@router.post("/malsync/auth/exchange")
def exchange_mal_code(req: MalExchangeRequest) -> Dict[str, str]:
    """
    Exchange the OAuth authorization code for a MAL bearer access token and refresh token.

    Args:
        req (MalExchangeRequest): Authorization code.

    Returns:
        Dict[str, str]: Confirmation message.

    Raises:
        HTTPException: 400 if token exchange fails.
    """
    clean_code = req.code.strip()
    if not clean_code:
        raise HTTPException(status_code=400, detail="Authorization code is required.")
    success, msg = exchange_code_for_token(clean_code)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": "Authenticated successfully"}

@router.post("/malsync/sync")
def trigger_mal_sync() -> Dict[str, str]:
    """
    Synchronize the user's complete anime and manga watchlists from MyAnimeList into local storage.

    Returns:
        Dict[str, str]: Synchronization status message.

    Raises:
        HTTPException: 400 if sync fails or user is unauthenticated.
    """
    success, msg = sync_user_list_from_mal()
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

@router.get("/malsync/library/{media_type}")
def get_mal_library(media_type: str) -> List[Dict[str, Any]]:
    """
    Retrieve locally synchronized MyAnimeList anime or manga collection entries.

    Args:
        media_type (str): Media category ('anime' or 'manga').

    Returns:
        List[Dict[str, Any]]: List of media items with title, status, score, and episode/chapter counts.

    Raises:
        HTTPException: 400 if media_type is not 'anime' or 'manga'.
    """
    m_type = media_type.strip().lower()
    if m_type == "anime":
        return load_anime_list()
    elif m_type == "manga":
        return load_manga_list()
    raise HTTPException(status_code=400, detail="Invalid media type: expected 'anime' or 'manga'.")

@router.post("/malsync/progress/{media_type}")
def update_mal_progress(media_type: str, req: MalProgressRequest) -> Dict[str, str]:
    """
    Update episode/chapter progress for a specific anime or manga entry on MyAnimeList.

    Args:
        media_type (str): Media category ('anime' or 'manga').
        req (MalProgressRequest): MAL item ID and updated progress count.

    Returns:
        Dict[str, str]: Confirmation message (`{"message": "Progress updated"}`).

    Raises:
        HTTPException: 400 if media_type is invalid.
    """
    m_type = media_type.strip().lower()
    clean_id = req.mal_id.strip()
    if m_type == "anime":
        update_progress(clean_id, req.progress)
    elif m_type == "manga":
        update_manga_progress(clean_id, req.progress)
    else:
        raise HTTPException(status_code=400, detail="Invalid media type: expected 'anime' or 'manga'.")
    return {"message": "Progress updated"}

@router.delete("/malsync/library/{media_type}/{mal_id}")
def delete_mal_item(media_type: str, mal_id: str) -> Dict[str, str]:
    """
    Remove an anime or manga entry from the local synced library.

    Args:
        media_type (str): Media category ('anime' or 'manga').
        mal_id (str): Unique MAL media ID.

    Returns:
        Dict[str, str]: Confirmation message (`{"message": "Item removed"}`).

    Raises:
        HTTPException: 400 if media_type is invalid.
    """
    m_type = media_type.strip().lower()
    clean_id = mal_id.strip()
    if m_type == "anime":
        remove_from_library(clean_id)
    elif m_type == "manga":
        remove_from_manga_library(clean_id)
    else:
        raise HTTPException(status_code=400, detail="Invalid media type: expected 'anime' or 'manga'.")
    return {"message": "Item removed"}

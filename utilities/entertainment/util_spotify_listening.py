import os
import json
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup
from utilities.core.util_network import better_get, get_image_cache
from utilities.core.util_store import get_data, set_data

from typing import Any

def _get_spotify_manager() -> dict:
    """Retrieves the Spotify manager state dict from store.

    Returns:
        dict: Spotify manager dictionary.
    """
    return get_data("spotify_manager") or {}

def _set_spotify_manager(data: dict) -> None:
    """Persists the Spotify manager state dict to store.

    Args:
        data (dict): State data to store.

    Returns:
        None
    """
    set_data("spotify_manager", data)

def read_config_cache() -> dict:
    """Reads the Spotify scrobbler configuration from store, setting defaults if necessary.

    Returns:
        dict: Active Spotify scrobbler configuration dictionary.
    """
    default_data = {
        "username": "", 
        "refresh_interval": 60,
        "timezone": "UTC+00:00",
        "fetch_method": "Scraping",
        "api_key": "",
        "track_limit": 5
    }
    
    data = _get_spotify_manager().get("config", {})
    if not data:
        data = default_data
        manager = _get_spotify_manager()
        manager["config"] = data
        _set_spotify_manager(manager)
        return default_data

    for key, val in default_data.items():
        if key not in data:
            data[key] = val
    return data

def save_config_cache(config_data: dict) -> None:
    """Saves the Spotify scrobbler config to disk.

    Args:
        config_data (dict): Configuration options dictionary to persist.

    Returns:
        None
    """
    manager = _get_spotify_manager()
    manager["config"] = config_data
    _set_spotify_manager(manager)

def clean_text(element: Any) -> str:
    """Cleans up text extracted from BeautifulSoup elements.

    Args:
        element (Any): BeautifulSoup tag element or navigable string.

    Returns:
        str: Normalized and stripped text string.
    """
    if not element:
        return ""
    return " ".join(element.get_text(strip=True).replace("\xa0", " ").split())

# --- NEW: API Fetch Logic ---

def check_lastfm_api(username: str, api_key: str, limit: int, tz_str: str) -> tuple[str | None, str | None, str | None, list]:
    """Fetches Last.fm recent listening data via the official API.

    Args:
        username (str): Last.fm username.
        api_key (str): Last.fm registered API key.
        limit (int): Number of recent tracks to fetch.
        tz_str (str): Target timezone string (e.g. 'UTC+09:00').

    Returns:
        tuple[str | None, str | None, str | None, list]: (avatar URL, scrobble count, scrobble artist, recent songs list).
    """
    # 1. Fetch User Info
    user_res = better_get(f"http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user={username}&api_key={api_key}&format=json")
    if not user_res: 
        return None, None, None, []
        
    try:
        user_data = user_res.json()
        if "error" in user_data: 
            return None, None, None, []
            
        scrobble_amount = str(user_data["user"]["playcount"])
        
        avatar_url = None
        for img in user_data["user"]["image"]:
            if img.get("size") == "extralarge" and img.get("#text"):
                avatar_url = img["#text"]
        if avatar_url:
            avatar_url = get_image_cache(avatar_url) or avatar_url
    except Exception:
        return None, None, None, []

    # --- SET UP TARGET TIMEZONE FOR CONVERSION ---
    try:
        tz_hours = int(tz_str.replace("UTC", "").split(":")[0])
        target_tz = timezone(timedelta(hours=tz_hours))
    except Exception:
        target_tz = timezone.utc

    # 2. Fetch Recent Tracks (Using the dynamic limit parameter!)
    tracks_res = better_get(f"http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user={username}&api_key={api_key}&limit={limit}&format=json")
    if not tracks_res: 
        return avatar_url, scrobble_amount, "None", []
        
    recent_songs = []
    try:
        tracks_data = tracks_res.json()
        tracks = tracks_data.get("recenttracks", {}).get("track", [])
        if isinstance(tracks, dict): 
            tracks = [tracks]
            
        for t in tracks:
            song_name = t.get("name", "Unknown")
            
            artist_data = t.get("artist", {})
            song_artist = artist_data.get("#text", artist_data.get("name", "Unknown"))
            
            song_link = t.get("url")
            
            img_path = None
            for img in t.get("image", []):
                if img.get("size") in ["extralarge", "large"] and img.get("#text"):
                    img_path = img["#text"]
            if img_path:
                img_path = get_image_cache(img_path)

            if t.get("@attr", {}).get("nowplaying") == "true":
                last_listened = "Scrobbling now"
            else:
                # --- UTC TO LOCAL TIMEZONE CONVERSION ---
                uts = int(t["date"]["uts"])
                # Attach UTC timezone to the raw timestamp, then convert it to the user's target timezone
                dt = datetime.fromtimestamp(uts, timezone.utc).astimezone(target_tz)
                last_listened = dt.strftime("%A %d %b %Y, %I:%M%p").replace("AM", "am").replace("PM", "pm")
                
            recent_songs.append([song_name, img_path, song_artist, last_listened, song_link])
            
    except Exception:
        pass

    return avatar_url, scrobble_amount, "None", recent_songs


# --- RENAMED: Scraping Fetch Logic ---
def check_lastfm_scraping(username: str) -> tuple[str | None, str | None, str | None, list]:
    """Fetches Last.fm recent listening data by scraping the user's profile page.

    Args:
        username (str): Last.fm username to scrape.

    Returns:
        tuple[str | None, str | None, str | None, list]: (avatar URL, scrobble count, scrobble artist, recent songs list).
    """
    lastfm_response = better_get(
        f"https://www.last.fm/user/{username}", timeout=8, use_default_headers=False)
    if lastfm_response is None:
        return None, None, None, []

    lastfm_page = BeautifulSoup(lastfm_response.content, "lxml")

    try:
        raw_avatar_url = lastfm_page.find(
            "span", class_="avatar").find("img").get("src").strip()
        raw_avatar_url = raw_avatar_url.replace("/174s/", "/300x300/")
        avatar_url = get_image_cache(raw_avatar_url) or raw_avatar_url

        scrobble_info = lastfm_page.find_all(
            "div", class_="header-metadata-display")
        scrobble_amount = clean_text(scrobble_info[0]) if len(
            scrobble_info) > 0 else "0"
        scrobble_artist = clean_text(scrobble_info[1]) if len(
            scrobble_info) > 1 else "None"
    except (AttributeError, IndexError, TypeError):
        return None, None, None, []

    recent_songs = []
    try:
        recent_listening_box = lastfm_page.find(
            "section", id="recent-tracks-section").find("tbody")
        recent_items = recent_listening_box.find_all("tr")

        for item in recent_items:
            try:
                name_cell = item.find("td", class_="chartlist-name")
                song_name = clean_text(name_cell) if name_cell else "Unknown"

                img_path = None
                song_link = None
                if name_cell and name_cell.find("a"):
                    row_link = name_cell.find("a").get("href")
                    if row_link and row_link.startswith("/music/"):
                        song_link = f"https://www.last.fm{row_link}"

                artist_cell = item.find("td", class_="chartlist-artist")
                song_artist = clean_text(
                    artist_cell) if artist_cell else "Unknown"

                time_cell = item.find("td", class_="chartlist-timestamp")
                last_listened = "Unknown"
                if time_cell:
                    span = time_cell.find("span")
                    if span and span.has_attr("title"):
                        last_listened = span["title"]
                    else:
                        last_listened = clean_text(time_cell)

                if song_name != "Unknown":
                    recent_songs.append(
                        [song_name, img_path, song_artist, last_listened, song_link])
            except Exception:
                continue

    except (AttributeError, IndexError, TypeError):
        pass

    return avatar_url, scrobble_amount, scrobble_artist, recent_songs


def check_lastfm(username: str, fetch_method: str = "Scraping", api_key: str = "", limit: int = 5, tz_str: str = "UTC+00:00") -> tuple[str | None, str | None, str | None, list]:
    """Main entry point for checking Last.fm data using the preferred method.

    Args:
        username (str): Last.fm username.
        fetch_method (str): Fetch strategy ('API' or 'Scraping'). Defaults to 'Scraping'.
        api_key (str): Last.fm API key (required if method is 'API'). Defaults to "".
        limit (int): Number of recent tracks to retrieve. Defaults to 5.
        tz_str (str): Target timezone string. Defaults to 'UTC+00:00'.

    Returns:
        tuple[str | None, str | None, str | None, list]: (avatar URL, scrobble count, scrobble artist, recent songs list).
    """
    if not username:
        return None, None, None, []
        
    if fetch_method == "API" and api_key:
        return check_lastfm_api(username, api_key, limit, tz_str)
    else:
        return check_lastfm_scraping(username)
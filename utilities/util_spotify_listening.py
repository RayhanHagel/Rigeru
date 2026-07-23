import os
import json
from datetime import datetime, timedelta, timezone
from bs4 import BeautifulSoup
from utilities.util_network import better_get, get_image_cache
from utilities.util_json import load_json

CACHE_FOLDER = os.path.join("cache", "spotify")
SPOTIFY_CONFIG = os.path.join(CACHE_FOLDER, "spotify_scrobbler.json")
SPOTIFY_DATA = os.path.join(CACHE_FOLDER, "spotify_data.json")


def get_default_cover_src():
    cassette_url = "https://miro.medium.com/v2/resize:fit:720/format:webp/0*iODIlb6_lMPaOQoR"
    cached_img_path = get_image_cache(cassette_url)
    if cached_img_path:
        return cached_img_path
    return cassette_url


def read_config_cache() -> dict:
    default_data = {
        "username": "", 
        "refresh_interval": 60,
        "timezone": "UTC+00:00",
        "fetch_method": "Scraping",
        "api_key": "",
        "track_limit": 5  # <-- New Default Key
    }
    
    data = load_json(SPOTIFY_CONFIG, lambda: {})
    if not data:
        os.makedirs(os.path.dirname(SPOTIFY_CONFIG), exist_ok=True)
        with open(SPOTIFY_CONFIG, 'w') as f:
            json.dump(default_data, f, indent=4) 
        return default_data

    for key, val in default_data.items():
        if key not in data:
            data[key] = val
    return data

def read_data_cache() -> dict:
    return load_json(SPOTIFY_DATA, lambda: {})


def save_config_cache(data: dict):
    """Saves the Spotify scrobbler config cache to disk."""
    os.makedirs(os.path.dirname(SPOTIFY_CONFIG), exist_ok=True)
    with open(SPOTIFY_CONFIG, 'w') as f:
        json.dump(data, f, indent=4)


def save_data_cache(data: dict):
    os.makedirs(os.path.dirname(SPOTIFY_DATA), exist_ok=True)
    with open(SPOTIFY_DATA, 'w') as f:
        json.dump(data, f, indent=4)


def clean_text(element) -> str:
    if not element:
        return ""
    return " ".join(element.get_text(strip=True).replace("\xa0", " ").split())

def get_album_cover(url: str) -> str | None:
    if not url:
        return None
    song_website_response = better_get(url)
    if song_website_response is None:
        return None

    song_website_page = BeautifulSoup(song_website_response.content, "lxml")
    try:
        album_cover = song_website_page.find("div", class_="source-album-art")
        img_url = album_cover.find("img").get("src")
        return get_image_cache(img_url)
    except Exception:
        return None

# --- NEW: API Fetch Logic ---


def check_lastfm_api(username: str, api_key: str, limit: int, tz_str: str) -> tuple[str | None, str | None, str | None, list]:
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
    if not username:
        return None, None, None, []
        
    if fetch_method == "API" and api_key:
        return check_lastfm_api(username, api_key, limit, tz_str)
    else:
        return check_lastfm_scraping(username)
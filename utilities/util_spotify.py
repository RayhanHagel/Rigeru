import os
import json
from bs4 import BeautifulSoup
import streamlit as st
from utilities.util_network import better_get, get_image_cache
from utilities.util_persistent import THEMES, FONTS


CACHE_FOLDER = os.path.join("cache", "spotify")
SPOTIFY_CONFIG = os.path.join(CACHE_FOLDER, "spotify_scrobbler.json")
SPOTIFY_DATA = os.path.join(CACHE_FOLDER, "spotify_data.json")


def get_current_theme():
    """Fetches the current theme and font preferences from session state."""
    current_theme_name = st.session_state.get("selected_theme", "Nebula (Default)")
    theme = THEMES.get(current_theme_name, THEMES["Nebula (Default)"])
    
    font_choice = st.session_state.get("selected_font", "Serif Mono (Default)")
    fonts = FONTS.get(font_choice, FONTS["Serif Mono (Default)"])
    
    return theme, fonts["SERIF"], fonts["MONO"]


def get_default_cover_src():
    """Fetches, caches, and returns the default cassette placeholder image via static path."""
    cassette_url = "https://miro.medium.com/v2/resize:fit:720/format:webp/0*iODIlb6_lMPaOQoR"
    cached_img_path = get_image_cache(cassette_url)
    if cached_img_path:
        return cached_img_path
    return cassette_url


def read_config_cache() -> dict:
    """Reads the saved Spotify scrobbler config cache."""
    default_data = {"username": "", "refresh_interval": 60}
    
    if os.path.exists(SPOTIFY_CONFIG):    
        try:
            with open(SPOTIFY_CONFIG, "r") as file:
                data = json.load(file)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
            
    os.makedirs(os.path.dirname(SPOTIFY_CONFIG), exist_ok=True)
    with open(SPOTIFY_CONFIG, 'w') as f:
        json.dump(default_data, f, indent=4) 
    return default_data


def read_data_cache() -> dict:
    """Reads only the last scraped listening data."""
    if os.path.exists(SPOTIFY_DATA):
        try:
            with open(SPOTIFY_DATA, "r") as file:
                return json.load(file)
        except Exception:
            pass
    return {}


def save_data_cache(data: dict):
    """Saves the scraped data to disk independently of config."""
    os.makedirs(os.path.dirname(SPOTIFY_DATA), exist_ok=True)
    with open(SPOTIFY_DATA, 'w') as f:
        json.dump(data, f)


def clean_text(element) -> str:
    """Safely extracts and cleans text from a BeautifulSoup element."""
    if not element:
        return ""
    return " ".join(element.get_text(strip=True).replace("\xa0", " ").split())


@st.cache_data(persist="disk")
def get_album_cover(url: str) -> str | None:
    """Fetches high-resolution album cover from the song page and caches it locally."""
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


def check_lastfm(username: str) -> tuple[str | None, str | None, str | None, list]:
    """Scrapes a Last.fm user profile for their currently playing and recent tracks."""
    if not username:
        return None, None, None, []
        
    lastfm_response = better_get(f"https://www.last.fm/user/{username}", timeout=8, use_default_headers=False)
    if lastfm_response is None:
        return None, None, None, []
    
    lastfm_page = BeautifulSoup(lastfm_response.content, "lxml")
    
    try:
        raw_avatar_url = lastfm_page.find("span", class_="avatar").find("img").get("src").strip()
        raw_avatar_url = raw_avatar_url.replace("/174s/", "/300x300/")
        avatar_url = get_image_cache(raw_avatar_url) or raw_avatar_url
        
        scrobble_info = lastfm_page.find_all("div", class_="header-metadata-display")
        scrobble_amount = clean_text(scrobble_info[0]) if len(scrobble_info) > 0 else "0"
        scrobble_artist = clean_text(scrobble_info[1]) if len(scrobble_info) > 1 else "None"
    except (AttributeError, IndexError, TypeError):
        return None, None, None, []
    
    recent_songs = []
    try:
        recent_listening_box = lastfm_page.find("section", id="recent-tracks-section").find("tbody")
        recent_items = recent_listening_box.find_all("tr")
        
        for item in recent_items:
            try:
                # Extract Song Name & Scrape Cover Image
                name_cell = item.find("td", class_="chartlist-name")
                song_name = clean_text(name_cell) if name_cell else "Unknown"
                
                img_path = None
                song_link = None # NEW: Store the link to fetch later
                if name_cell and name_cell.find("a"):
                    row_link = name_cell.find("a").get("href")
                    if row_link and row_link.startswith("/music/"):
                        song_link = f"https://www.last.fm{row_link}"
                        # REMOVED: We no longer call get_album_cover(song_link) here!
                
                # Extract Artist
                artist_cell = item.find("td", class_="chartlist-artist")
                song_artist = clean_text(artist_cell) if artist_cell else "Unknown"
                
                # Extract Timestamp
                time_cell = item.find("td", class_="chartlist-timestamp")
                last_listened = "Unknown"
                if time_cell:
                    span = time_cell.find("span")
                    if span and span.has_attr("title"):
                        last_listened = span["title"]
                    else:
                        last_listened = clean_text(time_cell)
                
                if song_name != "Unknown":
                    # NEW: Append song_link as the 5th element
                    recent_songs.append([song_name, img_path, song_artist, last_listened, song_link])
            except Exception:
                continue
                
    except (AttributeError, IndexError, TypeError):
        pass
    
    return avatar_url, scrobble_amount, scrobble_artist, recent_songs
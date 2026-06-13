import os
import json
from bs4 import BeautifulSoup
import streamlit as st
from utilities.util_network import better_get

def read_cache() -> list:
    """Reads the saved Spotify scrobbler cache."""
    path = "./cache/spotify_scrobbler.json"
    
    if os.path.exists(path):    
        try:
            with open(path, "r") as file:
                return json.load(file)
        except Exception:
            pass
            
    # Initialize clean cache if it doesn't exist or is corrupted
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump([], f, indent=4) 
    return []

def clean_text(element) -> str:
    """Safely extracts and cleans text from a BeautifulSoup element."""
    if not element:
        return ""
    return " ".join(element.get_text(strip=True).replace("\xa0", " ").split())

def check_lastfm(username: str) -> tuple[str | None, str | None, str | None, list]:
    """Scrapes a Last.fm user profile for their currently playing and recent tracks."""
    if not username:
        return None, None, None, []
        
    lastfm_response = better_get(f"https://www.last.fm/user/{username}", timeout=8)
    if lastfm_response is None:
        return None, None, None, []
    
    lastfm_page = BeautifulSoup(lastfm_response.content, "lxml")
    
    try:
        avatar_url = lastfm_page.find("span", class_="avatar").find("img").get("src").strip()
        # Upgrade avatar resolution from 174s to 300x300
        avatar_url = avatar_url.replace("/174s/", "/300x300/")
        
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
                # 1. Extract Image directly from the row to avoid slow secondary network calls
                img_cell = item.find("td", class_="chartlist-image")
                img_url = ""
                if img_cell and img_cell.find("img"):
                    img_url = img_cell.find("img").get("src")
                    # Trick the Last.fm CDN into giving us high-res 300x300 album covers instead of 64px thumbnails
                    img_url = img_url.replace("/64s/", "/300x300/")

                # 2. Extract Song Name
                name_cell = item.find("td", class_="chartlist-name")
                song_name = clean_text(name_cell) if name_cell else "Unknown"
                
                # 3. Extract Artist
                artist_cell = item.find("td", class_="chartlist-artist")
                song_artist = clean_text(artist_cell) if artist_cell else "Unknown"
                
                # 4. Extract Timestamp
                time_cell = item.find("td", class_="chartlist-timestamp")
                last_listened = clean_text(time_cell) if time_cell else "Unknown"
                
                if song_name != "Unknown":
                    # Format strictly matching the frontend expectations
                    recent_songs.append([song_name, img_url, song_artist, last_listened])
            except Exception:
                continue
                
    except (AttributeError, IndexError, TypeError):
        pass # Return whatever we have so far if the tracks table fails
    
    return avatar_url, scrobble_amount, scrobble_artist, recent_songs
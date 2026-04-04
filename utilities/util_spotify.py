import os
import json
from utilities.util_network import better_get
import streamlit as st
from bs4 import BeautifulSoup




def read_cache() -> dict:
    path = "./cache/spotify_scrobbler.json"
    
    if os.path.exists(path):    
        with open(path, "r") as file:
            data = json.load(file)
    else:
        with open(path, 'w') as f:
            json.dump([], f, indent=4) 
        data = []
    
    return data




def clean_text(text) -> str:
    return " ".join(text.get_text(strip=True).replace("\xa0", " ").split())





def check_lastfm(username:str) -> tuple[str, str, str, list]:
    lastfm_response = better_get(f"https://www.last.fm/user/{username}")
    if lastfm_response is None:
        return None, None, None, []
    
    class_to_check = {"chartlist-name", "chartlist-artist", "chartlist-timestamp"}
    lastfm_page = BeautifulSoup(lastfm_response.content, "lxml")
    
    try:
        avatar_url = lastfm_page.find("span", class_="avatar").find("img").get("src").strip()
        scrobble_info = lastfm_page.find_all("div", class_="header-metadata-display") 
        scrobble_amount = clean_text(scrobble_info[0])
        scrobble_artist = clean_text(scrobble_info[1])
    except (AttributeError, IndexError, TypeError):
        return None, None, None, []
    
    try:
        recent_listening_box = lastfm_page.find("section", id="recent-tracks-section").find("tbody")
        recent_items = recent_listening_box.find_all("tr")
    except (AttributeError, IndexError, TypeError):
        return avatar_url, scrobble_amount, scrobble_artist, []
    
    recent_songs = []
    for item in recent_items:
        song_details = []
        rows = item.find_all("td")
        for row in rows:
            try:
                class_name = row.get("class")[0]
                if class_name not in class_to_check:
                    continue
                song_details.append(clean_text(row))
            except (AttributeError, IndexError, TypeError):
                pass
        if song_details:
            recent_songs.append(song_details)
    
    return avatar_url, scrobble_amount, scrobble_artist, recent_songs
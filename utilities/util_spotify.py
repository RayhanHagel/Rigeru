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




def check_lastfm(username:str) -> tuple[str, str, str, list]:
    lastfm_response = better_get(f"https://www.last.fm/user/{username}")
    lastfm_page = BeautifulSoup(lastfm_response.text, "html.parser")
    
    avatar_url = lastfm_page.find("span", class_="avatar").find("img").get("src").replace("\n", "")
    scrobble_information = lastfm_page.find_all("div", class_="header-metadata-display") 
    scrobble_amount, scrobble_artist = scrobble_information[0].text.replace("\n", ""), scrobble_information[1].text.replace("\n", "")
    
    recent_listening_box = lastfm_page.find("section", id="recent-tracks-section").find("tbody")
    recent_items = recent_listening_box.find_all("tr")
    
    recent_songs = []
    for item in recent_items:
        song_details = []
        
        rows = item.find_all("td")
        for row in rows:
            try:
                class_name = row.get("class")[0]
                if class_name in ["chartlist-name", "chartlist-artist"]:
                    song_details.append(row.text.replace("\n", ""))
                elif class_name == "chartlist-timestamp":
                    song_details.append(" ".join(row.text.replace("\n", "").replace("\xa0", " ").split()))
            except:
                pass
        if song_details != []:
            recent_songs.append(song_details)
    
    return avatar_url, scrobble_amount, scrobble_artist, recent_songs
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

data = {
    "username" : "RigeruRay",
    "refresh_interval" : "30" # in seconds
}

def check_lastfm(username:str):
    lastfm_response = better_get(f"https://www.last.fm/user/{username}")
    lastfm_page = BeautifulSoup(lastfm_response.text, "html.parser")
    
    avatar_url = lastfm_page.find('img', attrs={'alt': 'Your avatar'}).get("src")
    scrobble_information = lastfm_page.find_all("div", class_="header-metadata-display") 
    scrobble_amount, scrobble_artist = scrobble_information[0].text, scrobble_information[1].text
    
    print(avatar_url)
    print(scrobble_amount)
    print(scrobble_artist)
    
    recent_listening_box = lastfm_page.find("section", id="recent-tracks-section").find("tbody")
    recent_items = recent_listening_box.find_all("tr")[1:]
    for item in recent_items:
        name_song = item.find("td", class_="chartlist-name").text
        name_artist = item.find("td", class_="charlist-artist").text
        last_played = item.find("td", class_=""""
                chartlist-timestamp
                chartlist-timestamp--lang-en
            """).text
        print(f"{name_song} - {name_artist} - {last_played}")
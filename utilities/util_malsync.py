import os
import json
import requests
import streamlit as st

# Route the DB file to the cache folder
CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)
DB_FILE = os.path.join(CACHE_DIR, "anime_tracking.json")

def load_anime_list() -> dict:
    if not os.path.exists(DB_FILE):
        return {}
    try:
        with open(DB_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {}

def save_anime_list(data: dict):
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)

@st.cache_data(ttl=3600)
def search_mal(query: str) -> tuple[bool, list | str]:
    url = f"https://api.jikan.moe/v4/anime?q={query}&sfw=true&limit=10"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json().get("data", [])
            results = []
            for item in data:
                results.append({
                    "mal_id": item.get("mal_id"),
                    "title": item.get("title"),
                    "episodes": item.get("episodes") or 0,
                    "status": item.get("status"),
                    "score": item.get("score"),
                    "image_url": item.get("images", {}).get("jpg", {}).get("image_url", ""),
                    "url": item.get("url")
                })
            return True, results
        return False, "Failed to fetch data from MyAnimeList."
    except Exception as e:
        return False, f"Network error: {str(e)}"

def add_to_library(anime_data: dict) -> tuple[bool, str]:
    library = load_anime_list()
    mal_id = str(anime_data["mal_id"])
    
    if mal_id in library:
        return False, f"{anime_data['title']} is already in your library!"
        
    library[mal_id] = {
        "title": anime_data["title"],
        "episodes_total": anime_data["episodes"],
        "episodes_watched": 0,
        "image_url": anime_data["image_url"],
        "url": anime_data["url"],
        "status": "Watching" 
    }
    
    save_anime_list(library)
    return True, f"Added {anime_data['title']} to your library."

def update_progress(mal_id: str, watched: int):
    library = load_anime_list()
    if mal_id in library:
        total = library[mal_id]["episodes_total"]
        if total > 0:
            watched = max(0, min(watched, total))
        else:
            watched = max(0, watched)
            
        library[mal_id]["episodes_watched"] = watched
        
        if total > 0 and watched == total:
            library[mal_id]["status"] = "Completed"
        elif watched > 0:
            library[mal_id]["status"] = "Watching"
            
        save_anime_list(library)

def remove_from_library(mal_id: str):
    library = load_anime_list()
    if mal_id in library:
        del library[mal_id]
        save_anime_list(library)

def import_user_list(username: str) -> tuple[bool, str]:
    """Imports 'Watching' and 'Completed' anime from a user's MAL list via Jikan API."""
    url = f"https://api.jikan.moe/v4/users/{username}/animelist?status=1" # 1 = Watching, 2 = Completed
    try:
        # Fetch Watching
        resp_watching = requests.get(f"https://api.jikan.moe/v4/users/{username}/animelist?status=1", timeout=10)
        # Fetch Completed
        resp_completed = requests.get(f"https://api.jikan.moe/v4/users/{username}/animelist?status=2", timeout=10)
        
        if resp_watching.status_code == 403 or resp_completed.status_code == 403:
            return False, "Profile is Private. Please read the Help steps above to temporarily make it Public."
            
        if resp_watching.status_code != 200:
            return False, "User not found or an API error occurred."
            
        library = load_anime_list()
        imported_count = 0
        
        all_anime = resp_watching.json().get("data", []) + resp_completed.json().get("data", [])
        
        for item in all_anime:
            anime = item.get("anime", {})
            mal_id = str(anime.get("mal_id"))
            
            # Update or Add
            library[mal_id] = {
                "title": anime.get("title"),
                "episodes_total": anime.get("episodes") or 0,
                "episodes_watched": item.get("episodes_watched") or 0,
                "image_url": anime.get("images", {}).get("jpg", {}).get("image_url", ""),
                "url": anime.get("url"),
                "status": "Completed" if item.get("watching_status") == 2 else "Watching"
            }
            imported_count += 1
            
        save_anime_list(library)
        return True, f"Successfully imported {imported_count} anime to your local tracker."
        
    except Exception as e:
        return False, str(e)
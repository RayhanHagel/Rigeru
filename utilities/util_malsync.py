import os
import secrets
import time
import urllib.parse
from utilities.util_json import load_json, save_json
from utilities.util_network import better_get, better_post

# Route the DB files to the cache folder
CACHE_DIR = os.path.join(".", "cache", "malsync")
os.makedirs(CACHE_DIR, exist_ok=True)
DB_FILE = os.path.join(CACHE_DIR, "anime_tracking.json")
MANGA_DB_FILE = os.path.join(CACHE_DIR, "manga_tracking.json") # <-- NEW
OAUTH_FILE = os.path.join(CACHE_DIR, "mal_oauth.json")
CRED_FILE = os.path.join(CACHE_DIR, "mal_credentials.json")

REDIRECT_URI = "http://localhost:3000/media-entertainment/malsync"


# ─────────────────────────────────────────────
# Credentials Management
# ─────────────────────────────────────────────
def load_credentials() -> dict:
    return load_json(CRED_FILE, default_factory=dict)


def save_credentials(client_id: str, client_secret: str):
    save_json(CRED_FILE, {"client_id": client_id,
              "client_secret": client_secret})

# ─────────────────────────────────────────────
# OAuth2 Flow (PKCE)
# ─────────────────────────────────────────────
def get_oauth_state() -> dict:
    return load_json(OAUTH_FILE, default_factory=dict)

def save_oauth_state(data: dict):
    save_json(OAUTH_FILE, data)

def generate_auth_url() -> str | None:
    """Generates the MAL authorization URL and saves the PKCE verifier locally."""
    creds = load_credentials()
    client_id = creds.get("client_id")
    
    if not client_id:
        return None

    # MAL requires a code challenge between 43 and 128 chars
    code_verifier = secrets.token_urlsafe(96)[:128] 
    
    oauth_state = get_oauth_state()
    oauth_state["code_verifier"] = code_verifier
    save_oauth_state(oauth_state)
    
    auth_url = (
        f"https://myanimelist.net/v1/oauth2/authorize"
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&code_challenge={code_verifier}"
        f"&code_challenge_method=plain"
        f"&redirect_uri={REDIRECT_URI}"
    )
    return auth_url

def exchange_code_for_token(code: str) -> tuple[bool, str]:
    """Exchanges the redirect code for an access token and returns (Success, Message)."""
    oauth_state = get_oauth_state()
    verifier = oauth_state.get("code_verifier")
    
    creds = load_credentials()
    client_id = creds.get("client_id")
    client_secret = creds.get("client_secret", "")
    
    if not verifier or not client_id:
        return False, "Missing Client ID or PKCE Verifier. Please try logging in again."

    data = {
        "client_id": client_id,
        "code": code,
        "code_verifier": verifier,
        "grant_type": "authorization_code",
        "redirect_uri": REDIRECT_URI
    }
    
    if client_secret:
        data["client_secret"] = client_secret
    
    try:
        response = better_post("https://myanimelist.net/v1/oauth2/token", payload=data)
        
        if response and response.status_code == 200:
            token_data = response.json()
            oauth_state.update({
                "access_token": token_data["access_token"],
                "refresh_token": token_data["refresh_token"],
                "expires_at": time.time() + token_data["expires_in"]
            })
            save_oauth_state(oauth_state)
            return True, "Success"
        else:
            # Safely try to get the exact error message from MAL
            try:
                error_msg = response.json().get('message', response.text)
            except:
                error_msg = response.text
            return False, f"API Error {response.status_code}: {error_msg}"
            
    except Exception as e:
        return False, f"Network error during authentication: {str(e)}"

def get_valid_token() -> str | None:
    """Returns a valid access token, or None if not logged in."""
    oauth_state = get_oauth_state()
    token = oauth_state.get("access_token")
    
    if not token:
        return None
        
    creds = load_credentials()
    client_id = creds.get("client_id")
    client_secret = creds.get("client_secret", "")
    
    if time.time() > oauth_state.get("expires_at", 0) - 60:
        if not client_id:
            return None
            
        data = {
            "client_id": client_id,
            "grant_type": "refresh_token",
            "refresh_token": oauth_state.get("refresh_token")
        }
        if client_secret:
            data["client_secret"] = client_secret
            
        response = better_post("https://myanimelist.net/v1/oauth2/token", payload=data)
        if response and response.status_code == 200:
            token_data = response.json()
            oauth_state.update({
                "access_token": token_data["access_token"],
                "refresh_token": token_data["refresh_token"],
                "expires_at": time.time() + token_data["expires_in"]
            })
            save_oauth_state(oauth_state)
            return token_data["access_token"]
        else:
            return None 
            
    return token

# ─────────────────────────────────────────────
# Local Library Management (Anime)
# ─────────────────────────────────────────────
def load_anime_list() -> dict:
    return load_json(DB_FILE, default_factory=dict)

def save_anime_list(data: dict):
    save_json(DB_FILE, data)

def update_progress(mal_id: str, watched: int):
    library = load_anime_list()
    if mal_id in library:
        total = library[mal_id].get("episodes_total", 0)
        watched = max(0, min(watched, total)) if total > 0 else max(0, watched)
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

# ─────────────────────────────────────────────
# Local Library Management (Manga) <-- NEW
# ─────────────────────────────────────────────
def load_manga_list() -> dict:
    return load_json(MANGA_DB_FILE, default_factory=dict)

def save_manga_list(data: dict):
    save_json(MANGA_DB_FILE, data)

def update_manga_progress(mal_id: str, read: int):
    library = load_manga_list()
    if mal_id in library:
        total = library[mal_id].get("chapters_total", 0)
        read = max(0, min(read, total)) if total > 0 else max(0, read)
        library[mal_id]["chapters_read"] = read
        
        if total > 0 and read == total:
            library[mal_id]["status"] = "Completed"
        elif read > 0:
            library[mal_id]["status"] = "Reading"
            
        save_manga_list(library)

def remove_from_manga_library(mal_id: str):
    library = load_manga_list()
    if mal_id in library:
        del library[mal_id]
        save_manga_list(library)

# ─────────────────────────────────────────────
# Official MAL API Interactions <-- UPDATED
# ─────────────────────────────────────────────
def sync_user_list_from_mal() -> tuple[bool, str]:
    """Fetches both Anime and Manga lists from MAL and saves to local libraries."""
    token = get_valid_token()
    if not token:
        return False, "Not authenticated."

    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # --- SYNC ANIME ---
        url_anime = "https://api.myanimelist.net/v2/users/@me/animelist?fields=list_status,num_episodes,main_picture&limit=1000"
        resp_anime = better_get(url_anime, headers=headers)
        if not resp_anime or resp_anime.status_code != 200:
            return False, f"Anime Sync Error: {resp_anime.json() if resp_anime else 'Network Error'}"
            
        anime_data = resp_anime.json().get("data", [])
        anime_library = load_anime_list()
        imported_anime = 0
        
        anime_status_map = {
            "watching": "Watching", "completed": "Completed", 
            "on_hold": "On Hold", "dropped": "Dropped", "plan_to_watch": "Plan to Watch"
        }
        
        for item in anime_data:
            node = item.get("node", {})
            status_data = item.get("list_status", {})
            mal_id = str(node.get("id"))
            
            anime_library[mal_id] = {
                "title": node.get("title"),
                "episodes_total": node.get("num_episodes") or 0,
                "episodes_watched": status_data.get("num_episodes_watched") or 0,
                "image_url": node.get("main_picture", {}).get("large") or node.get("main_picture", {}).get("medium", ""),
                "url": f"https://myanimelist.net/anime/{mal_id}",
                "status": anime_status_map.get(status_data.get("status"), "Unknown")
            }
            imported_anime += 1
            
        save_anime_list(anime_library)

        # --- SYNC MANGA ---
        url_manga = "https://api.myanimelist.net/v2/users/@me/mangalist?fields=list_status,num_chapters,main_picture&limit=1000"
        resp_manga = better_get(url_manga, headers=headers)
        if not resp_manga or resp_manga.status_code != 200:
            return False, f"Manga Sync Error: {resp_manga.json() if resp_manga else 'Network Error'}"
            
        manga_data = resp_manga.json().get("data", [])
        manga_library = load_manga_list()
        imported_manga = 0
        
        manga_status_map = {
            "reading": "Reading", "completed": "Completed", 
            "on_hold": "On Hold", "dropped": "Dropped", "plan_to_read": "Plan to Read"
        }
        
        for item in manga_data:
            node = item.get("node", {})
            status_data = item.get("list_status", {})
            mal_id = str(node.get("id"))
            
            manga_library[mal_id] = {
                "title": node.get("title"),
                "chapters_total": node.get("num_chapters") or 0,
                "chapters_read": status_data.get("num_chapters_read") or 0,
                "image_url": node.get("main_picture", {}).get("large") or node.get("main_picture", {}).get("medium", ""),
                "url": f"https://myanimelist.net/manga/{mal_id}",
                "status": manga_status_map.get(status_data.get("status"), "Unknown")
            }
            imported_manga += 1
            
        save_manga_list(manga_library)

        return True, f"Synced {imported_anime} Anime and {imported_manga} Manga/Manhwa successfully!"
        
    except Exception as e:
        return False, f"Sync error: {str(e)}"
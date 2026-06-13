import os
import tkinter as tk
from tkinter import filedialog
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
import yt_dlp

def _init_tkinter():
    """Helper to initialize a hidden, top-most tkinter root window."""
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    return root

def open_folder_dialog(current_path: str = "") -> str:
    """Opens a native OS folder selection dialog."""
    root = _init_tkinter()
    selected = filedialog.askdirectory(
        initialdir=current_path if os.path.exists(current_path) else os.path.expanduser('~'),
        title="Select Download Folder"
    )
    root.destroy()
    return selected if selected else current_path

def get_playlist_tracks(playlist_url: str, client_id: str, client_secret: str) -> tuple[bool, str | None, str | list]:
    """Authenticates with Spotify and returns a list of 'Artist - Track Name' strings."""
    if not client_id or not client_secret:
        return False, None, "Missing Spotify Client ID or Secret."
        
    try:
        auth_manager = SpotifyClientCredentials(client_id=client_id, client_secret=client_secret)
        sp = spotipy.Spotify(auth_manager=auth_manager)
        
        # Clean the URL to extract the playlist ID safely
        playlist_id = playlist_url.split('/')[-1].split('?')[0]
        
        # Get playlist metadata
        playlist_info = sp.playlist(playlist_id)
        playlist_name = playlist_info['name']
        
        # Handle pagination for playlists larger than 100 tracks
        results = sp.playlist_tracks(playlist_id)
        tracks = results['items']
        while results['next']:
            results = sp.next(results)
            tracks.extend(results['items'])
            
        track_list = []
        for item in tracks:
            track = item.get('track')
            if not track: 
                continue
            
            artist_name = track['artists'][0]['name']
            track_name = track['name']
            
            # Remove characters that might mess up YouTube search
            clean_name = f"{artist_name} - {track_name}".replace(':', '').replace('"', '')
            track_list.append(clean_name)
            
        return True, playlist_name, track_list
        
    except Exception as e:
        return False, None, f"Spotify API Error: {str(e)}"

def download_track_audio(query: str, output_dir: str) -> tuple[bool, str]:
    """Uses yt-dlp to search YouTube for the track and download it as MP3."""
    ydl_opts = {
        'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # ytsearch1: tells yt-dlp to search youtube and download ONLY the 1st result
            ydl.download([f"ytsearch1:{query} audio lyrics"])
        return True, f"✅ Downloaded: {query}"
    except Exception as e:
        return False, f"❌ Failed: {query} - {str(e)}"
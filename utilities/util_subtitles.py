import os
import struct
import requests
import io

def hash_file(file_path: str) -> str:
    """
    Calculates the OpenSubtitles hash of a video file.
    Reads only the first and last 64KB of the file to generate a 64-bit checksum.
    """
    try:
        longlongformat = '<q'  # little-endian long long
        bytesize = struct.calcsize(longlongformat)
        
        with open(file_path, "rb") as f:
            filesize = os.path.getsize(file_path)
            hash_val = filesize
            
            if filesize < 65536 * 2:
                return "SizeError"
                
            # Read first 64kb
            for x in range(65536 // bytesize):
                buffer = f.read(bytesize)
                (l_value,) = struct.unpack(longlongformat, buffer)
                hash_val += l_value
                hash_val = hash_val & 0xFFFFFFFFFFFFFFFF # to remain as 64bit number
                
            # Read last 64kb
            f.seek(max(0, filesize - 65536), 0)
            for x in range(65536 // bytesize):
                buffer = f.read(bytesize)
                (l_value,) = struct.unpack(longlongformat, buffer)
                hash_val += l_value
                hash_val = hash_val & 0xFFFFFFFFFFFFFFFF
                
        return "%016x" % hash_val
    except Exception:
        return "Error"

def search_opensubtitles(file_path: str, api_key: str, language: str = "en") -> tuple[bool, list | str]:
    """Searches OpenSubtitles for the exact video hash."""
    if not os.path.exists(file_path):
        return False, "Video file does not exist at the provided path."
        
    video_hash = hash_file(file_path)
    if video_hash in ["SizeError", "Error"]:
        return False, "Failed to generate video hash. Is the file a valid video?"
        
    url = "https://api.opensubtitles.com/api/v1/subtitles"
    headers = {
        "Api-Key": api_key,
        "User-Agent": "RigeruApp v1.0"
    }
    params = {
        "moviehash": video_hash,
        "languages": language
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            results = data.get("data", [])
            return True, results
        elif response.status_code == 401:
            return False, "Unauthorized. Please check your API key."
        else:
            return False, f"API Error: {response.status_code}"
    except Exception as e:
        return False, f"Network error: {str(e)}"

def download_subtitle(file_id: str, api_key: str) -> tuple[bool, bytes | str, str]:
    """Downloads the actual subtitle file content using its ID."""
    url = "https://api.opensubtitles.com/api/v1/download"
    headers = {
        "Api-Key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    payload = {"file_id": int(file_id)}
    
    try:
        # Step 1: Request a download link
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        if response.status_code == 200:
            download_url = response.json().get("link")
            file_name = response.json().get("file_name", "subtitle.srt")
            
            # Step 2: Download the actual file
            sub_resp = requests.get(download_url, timeout=10)
            if sub_resp.status_code == 200:
                return True, sub_resp.content, file_name
                
        return False, "Failed to request download link from OpenSubtitles.", ""
    except Exception as e:
        return False, f"Download error: {str(e)}", ""
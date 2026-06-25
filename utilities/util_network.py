import os
import time
import socket
import threading
import subprocess
import requests
import hashlib
from PIL import Image, ImageOps, UnidentifiedImageError
from io import BytesIO


STATIC_DIR = os.path.join(os.getcwd(), "static", "image_cache")
os.makedirs(STATIC_DIR, exist_ok=True)


DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
}


def is_tor_running(port: int = 9050) -> bool:
    """Checks if the Tor SOCKS proxy is currently listening on the specified port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        try:
            return s.connect_ex(('127.0.0.1', port)) == 0
        except Exception:
            return False


def start_tor_background():
    """Starts Tor in a background thread and waits for it to bootstrap."""
    def run_tor():
        try:
            # We route stdout/stderr to DEVNULL to prevent Tor logs from spamming your Streamlit console
            subprocess.run(["tor"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except FileNotFoundError:
            print("ERROR: 'tor' executable not found in system PATH.")
    
    print("Tor not detected. Booting Tor in a background thread...")
    tor_thread = threading.Thread(target=run_tor, daemon=True)
    tor_thread.start()

    # Wait up to 15 seconds for Tor to establish its connection circuit
    for _ in range(15):
        if is_tor_running():
            print("Tor successfully connected and is ready!")
            return True
        time.sleep(1)
    
    print("Tor failed to start within the timeout period.")
    return False


def better_get(url: str, params: dict = None, headers: dict = None, timeout: int = 10, retries: int = 3, use_default_headers: bool = False) -> requests.Response | None:
    """
    Robust GET request. Tries a normal connection multiple times first. 
    If blocked or failed, automatically boots Tor and retries through the proxy.
    """
    req_headers = {**DEFAULT_HEADERS, **(headers or {})} if use_default_headers else (headers or {})
    
    # Try normal request (No proxy) with retries
    for attempt in range(retries):
        try:
            response = requests.get(url, params=params, headers=req_headers, timeout=timeout)
            if response.status_code == 200:
                return response
            else:
                print(f"Normal GET failed (attempt {attempt + 1}/{retries}) with status {response.status_code}.")
                if response.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                    time.sleep(2)
                continue
        except requests.RequestException as e:
            print(f"Normal GET threw an error (attempt {attempt + 1}/{retries}): {e}.")
            if attempt < retries - 1:
                time.sleep(2)
            continue
            
    print(f"All normal GET requests failed. Failing over to Tor.\nURL: {url}")

    # Verify Tor is running, boot if necessary
    if not is_tor_running():
        success = start_tor_background()
        if not success:
            return None

    # SOCKS5h ensures that DNS resolution also happens through Tor, preventing DNS leaks
    proxies = {
        'http': 'socks5h://127.0.0.1:9050',
        'https': 'socks5h://127.0.0.1:9050'
    }

    # Retry through Tor loop
    for attempt in range(retries):
        try:
            response = requests.get(url, params=params, headers=req_headers, timeout=timeout + 5, proxies=proxies)
            if response.status_code in (429, 500, 502, 503, 504):
                if attempt < retries - 1:
                    time.sleep(2)
                continue
            return response
        except requests.RequestException:
            if attempt < retries - 1:
                time.sleep(2)
            continue
            
    return None


def better_post(url: str, payload: dict | str | bytes = None, json: dict = None, headers: dict = None, timeout: int = 10, retries: int = 3, use_default_headers: bool = True) -> requests.Response | None:
    """
    Robust POST request. Tries a normal connection multiple times first. 
    If blocked or failed, automatically boots Tor and retries through the proxy.
    """
    req_headers = {**DEFAULT_HEADERS, **(headers or {})} if use_default_headers else (headers or {})
    
    # Try normal request (No proxy) with retries
    for attempt in range(retries):
        try:
            response = requests.post(url, data=payload, json=json, headers=req_headers, timeout=timeout)
            if response.status_code == 200:
                return response
            else:
                print(f"Normal POST failed (attempt {attempt + 1}/{retries}) with status {response.status_code}.")
                if response.status_code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                    time.sleep(2)
                continue
        except requests.RequestException as e:
            print(f"Normal POST threw an error (attempt {attempt + 1}/{retries}): {e}.")
            if attempt < retries - 1:
                time.sleep(2)
            continue
            
    print(f"All normal POST requests failed. Falling over to Tor.\nURL: {url}")

    # Verify Tor is running, boot if necessary
    if not is_tor_running():
        success = start_tor_background()
        if not success:
            return None

    proxies = {
        'http': 'socks5h://127.0.0.1:9050',
        'https': 'socks5h://127.0.0.1:9050'
    }

    # Retry through Tor loop
    for attempt in range(retries):
        try:
            response = requests.post(url, data=payload, json=json, headers=req_headers, timeout=timeout + 5, proxies=proxies)
            if response.status_code in (429, 500, 502, 503, 504):
                if attempt < retries - 1:
                    time.sleep(2)
                continue
            return response
        except requests.RequestException:
            if attempt < retries - 1:
                time.sleep(2)
            continue
            
    return None


def detect_mime_type(data: bytes) -> str:
    """Fast byte-signature checking to determine image MIME types without heavy parsing."""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif data[:2] == b'\xff\xd8':
        return "image/jpeg"
    elif data[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif"
    elif data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return "image/webp"
    return "image/jpeg"


def get_image_cache(url: str, crop: bool = False, crop_size: tuple = (400, 600), max_width: int = 600, use_default_headers: bool = None) -> str | None:
    """
    Downloads an image, saves it to the static folder, and returns the web URL.
    This acts as its own cache—if the file exists, it skips downloading entirely.
    """
    # Create a unique, safe identifier based on the URL
    url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()
    
    # Check cache for both possible extensions before doing any network calls
    for ext in [".png", ".jpg"]:
        cached_filename = f"{url_hash}{ext}"
        cached_filepath = os.path.join(STATIC_DIR, cached_filename)
        if os.path.exists(cached_filepath):
            return f"/app/static/image_cache/{cached_filename}"

    # If not cached, download and process
    response = better_get(url=url, use_default_headers=use_default_headers)
    if response is None or response.status_code != 200:
        return None
    
    try:
        image = Image.open(BytesIO(response.content))
        
        # Detect if the image has transparency
        has_transparency = image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info)
        
        if has_transparency:
            save_ext = ".png"
            save_format = "PNG"
            if image.mode != "RGBA":
                image = image.convert("RGBA")
        else:
            save_ext = ".jpg"
            save_format = "JPEG"
            if image.mode in ("RGBA", "P", "LA", "CMYK"):
                image = image.convert("RGB")

        # Handle resizing and cropping
        if crop:
            image = ImageOps.fit(image, crop_size, centering=(0.5, 0.2))
        elif image.width > max_width:
            ratio = max_width / float(image.width)
            new_height = int((float(image.height) * float(ratio)))
            image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)
        
        # Save using the correct format and extension
        filename = f"{url_hash}{save_ext}"
        filepath = os.path.join(STATIC_DIR, filename)
        web_path = f"/app/static/image_cache/{filename}"

        if save_format == "JPEG":
            image.save(filepath, format="JPEG", quality=100, optimize=True)
        else:
            image.save(filepath, format="PNG", optimize=True)
        return web_path
            
    except (UnidentifiedImageError, OSError, ValueError) as e:
        print(f"Failed to process image: {e}")
        return None
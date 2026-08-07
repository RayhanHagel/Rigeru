import os
import time
import socket
import threading
import subprocess
import httpx
import hashlib
from PIL import Image, ImageOps, UnidentifiedImageError
from io import BytesIO

import json
import urllib.request
from urllib3.util import connection

STATIC_DIR = os.path.join("static", "image_cache")
os.makedirs(STATIC_DIR, exist_ok=True)

DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

# ==============================================================================
# Cloudflare DNS-over-HTTPS (DoH) Monkeypatch for urllib3 / requests
# This intercepts all socket connections made by requests and resolves
# the hostname via Cloudflare DoH, completely bypassing ISP DNS blocking.
# ==============================================================================
_orig_create_connection = connection.create_connection

def resolve_doh(hostname):
    """Resolves a hostname to an IPv4 address using Cloudflare DNS-over-HTTPS."""
    if hostname.replace('.', '').isdigit():
        return hostname
    try:
        req = urllib.request.Request(
            f'https://cloudflare-dns.com/dns-query?name={hostname}&type=A',
            headers={'Accept': 'application/dns-json'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read())
            if 'Answer' in data:
                for answer in data['Answer']:
                    if answer['type'] == 1: # A record (IPv4)
                        return answer['data']
    except Exception as e:
        print(f"DoH resolution failed for {hostname}: {e}")
    return hostname

def patched_create_connection(address, *args, **kwargs):
    """Monkey-patched create_connection that resolves hostnames via DoH before connecting."""
    host, port = address
    ip = resolve_doh(host)
    return _orig_create_connection((ip, port), *args, **kwargs)

connection.create_connection = patched_create_connection
# ==============================================================================

from utilities.util_tor import is_tor_running, start_tor_background

def better_get(url: str, params: dict = None, headers: dict = None, timeout: int = 10, retries: int = 3, use_default_headers: bool = False, force_tor: bool = False) -> httpx.Response | None:
    """
    Robust GET request. Uses Cloudflare DoH natively to bypass DNS blocking.
    Falls back to Tor if DoH fails (e.g. SNI blocking by ISP).
    """
    # Normalize protocol-relative URLs (e.g. //example.com/img.jpg)
    if url and url.startswith("//"):
        url = "https:" + url
    # Skip URLs with no valid scheme
    if not url or not url.startswith(("http://", "https://")):
        print(f"[better_get] Skipping invalid URL: {url!r}")
        return None

    req_headers = {**DEFAULT_HEADERS, **(headers or {})} if use_default_headers else (headers or {})
    
    if not force_tor:
        for attempt in range(retries):
            try:
                response = httpx.get(url, params=params, headers=req_headers, timeout=timeout, follow_redirects=True)
                if response.status_code == 200:
                    return response
                elif response.status_code == 404:
                    print(f"GET returned 404 Not Found. Skipping retries.")
                    return response
                else:
                    print(f"GET failed (attempt {attempt + 1}/{retries}) with status {response.status_code}.")
                    if response.status_code in (429, 500, 502, 503, 504, 600) and attempt < retries - 1:
                        time.sleep(2)
                    continue
            except httpx.ConnectError as e:
                print(f"GET intercepted (Connect Error) on attempt {attempt + 1}. ISP might be SNI blocking it. Failing over to Tor immediately.")
                break
            except httpx.RequestError as e:
                print(f"GET threw an error (attempt {attempt + 1}/{retries}): {e}.")
                if attempt < retries - 1:
                    time.sleep(2)
                continue
                
        print(f"All GET requests failed. Failing over to Tor.\nURL: {url}")

    if not is_tor_running():
        success = start_tor_background()
        if not success:
            return None

    proxy_url = "socks5h://127.0.0.1:9050"

    for attempt in range(retries):
        try:
            response = httpx.get(url, params=params, headers=req_headers, timeout=timeout + 5, proxy=proxy_url, follow_redirects=True)
            if response.status_code in (429, 500, 502, 503, 504, 600):
                print(f"[Tor GET] Failed with status {response.status_code} (attempt {attempt + 1}/{retries})")
                if attempt < retries - 1:
                    time.sleep(2)
                continue
            if response.status_code == 200:
                print(f"[Tor GET] Successfully fetched via Tor proxy.")
            else:
                print(f"[Tor GET] Returned status {response.status_code}")
            return response
        except httpx.RequestError as e:
            print(f"[Tor GET] Threw an error (attempt {attempt + 1}/{retries}): {e}")
            if attempt < retries - 1:
                time.sleep(2)
            continue
            
    return None


def better_post(url: str, payload: dict | str | bytes = None, json_data: dict = None, headers: dict = None, timeout: int = 10, retries: int = 3, use_default_headers: bool = True) -> httpx.Response | None:
    """
    Robust POST request. Uses Cloudflare DoH natively to bypass DNS blocking.
    Falls back to Tor if DoH fails (e.g. SNI blocking by ISP).
    """
    req_headers = {**DEFAULT_HEADERS, **(headers or {})} if use_default_headers else (headers or {})
    
    for attempt in range(retries):
        try:
            response = httpx.post(url, data=payload, json=json_data, headers=req_headers, timeout=timeout, follow_redirects=True)
            if response.status_code == 200:
                return response
            else:
                print(f"POST failed (attempt {attempt + 1}/{retries}) with status {response.status_code}.")
                if response.status_code in (429, 500, 502, 503, 504, 600) and attempt < retries - 1:
                    time.sleep(2)
                continue
        except httpx.ConnectError as e:
            print(f"POST intercepted (Connect Error) on attempt {attempt + 1}. ISP might be SNI blocking it. Failing over to Tor immediately.")
            break
        except httpx.RequestError as e:
            print(f"POST threw an error (attempt {attempt + 1}/{retries}): {e}.")
            if attempt < retries - 1:
                time.sleep(2)
            continue
            
    print(f"All POST requests failed. Failing over to Tor.\nURL: {url}")

    if not is_tor_running():
        success = start_tor_background()
        if not success:
            return None

    proxy_url = "socks5h://127.0.0.1:9050"

    for attempt in range(retries):
        try:
            response = httpx.post(url, data=payload, json=json_data, headers=req_headers, timeout=timeout + 5, proxy=proxy_url, follow_redirects=True)
            if response.status_code in (429, 500, 502, 503, 504, 600):
                print(f"[Tor POST] Failed with status {response.status_code} (attempt {attempt + 1}/{retries})")
                if attempt < retries - 1:
                    time.sleep(2)
                continue
            if response.status_code == 200:
                print(f"[Tor POST] Successfully fetched via Tor proxy.")
            else:
                print(f"[Tor POST] Returned status {response.status_code}")
            return response
        except httpx.RequestError as e:
            print(f"[Tor POST] Threw an error (attempt {attempt + 1}/{retries}): {e}")
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


def get_image_cache(url: str, crop: bool = False, crop_size: tuple = (400, 600), max_width: int = 600, use_default_headers: bool = None, force_tor: bool = False, headers: dict = None) -> str | None:
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
    response = better_get(url=url, headers=headers, use_default_headers=use_default_headers, force_tor=force_tor)
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
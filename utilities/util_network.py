import requests
from PIL import Image, ImageOps
import streamlit as st
from io import BytesIO
import base64


# Disguises our requests as a standard web browser to bypass basic bot-blockers
DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
}


def better_get(url: str, params: dict = None, headers: dict = None, timeout: int = 10, retries: int = 3, use_tor_proxies: bool = False, use_default_headers: bool = True) -> requests.Response | None:
    """Robust GET request with automatic retries, timeouts, bot-bypass headers, and proxy support."""
    if use_default_headers:
        req_headers = {**DEFAULT_HEADERS, **(headers or {})}
    else:
        req_headers = headers or {}
    
    for _ in range(retries):
        try:
            if use_tor_proxies:
                proxies = {
                    'http': 'socks5h://127.0.0.1:9050',
                    'https': 'socks5h://127.0.0.1:9050'
                }
            else:
                proxies = None

            response = requests.get(url, params=params, headers=req_headers, timeout=timeout, proxies=proxies)
            if response.status_code in (429, 500, 502, 503, 504):
                continue
            return response
        except requests.RequestException:
            continue
    return None

def better_post(url: str, payload: dict | str | bytes = None, json: dict = None, headers: dict = None, timeout: int = 10, retries: int = 3, proxies: dict = None, use_default_headers: bool = True) -> requests.Response | None:
    """Robust POST request with timeouts, payload, json support, and proxy support."""
    if use_default_headers:
        req_headers = {**DEFAULT_HEADERS, **(headers or {})}
    else:
        req_headers = headers or {}
    
    for _ in range(retries):
        try:
            response = requests.post(url, data=payload, json=json, headers=req_headers, timeout=timeout, proxies=proxies)
            if response.status_code in (429, 500, 502, 503, 504):
                continue
            return response
        except requests.RequestException:
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
    return "image/jpeg" # Fallback


@st.cache_data(persist="disk", show_spinner=False)
def get_image_cache(url: str, crop: bool = False, crop_size: tuple = (400, 600), headers: dict = None, use_tor_proxies: bool = False, use_default_headers: bool = True) -> str | None:
    """
    Fetches an image from a URL, optionally crops it, and returns a Base64 data URI string.
    Caches the resulting Base64 string to disk so Streamlit doesn't re-download it on every UI refresh.
    """
    response = better_get(url=url, headers=headers, use_tor_proxies=use_tor_proxies, use_default_headers=use_default_headers)
    if response is None or response.status_code != 200:
        return None
    
    try:
        if not crop:
            mime_type = detect_mime_type(response.content)
            # Failsafe: Ensure we are actually dealing with an image
            if not mime_type.startswith("image/"):
                return None
            encoded = base64.b64encode(response.content).decode("utf-8")
            return f"data:{mime_type};base64,{encoded}"
        else:
            # Heavy processing: Cropping and formatting
            image = Image.open(BytesIO(response.content))
            
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGBA")
                fmt = "PNG"
            else:
                image = image.convert("RGB")
                fmt = "JPEG"
            
            # Smart center-cropping
            image = ImageOps.fit(image, crop_size, centering=(0.5, 0.2))
            
            with BytesIO() as buffered:
                image.save(buffered, format=fmt, quality=85, optimize=True)
                image_string = base64.b64encode(buffered.getvalue()).decode()
                
            return f"data:image/{fmt.lower()};base64,{image_string}"
            
    except Exception:
        return None
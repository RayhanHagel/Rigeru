import requests
from PIL import Image, ImageOps
import streamlit as st
from io import BytesIO
import base64




def better_get(url:str) -> requests.Response:
    last_error = None
    for _ in range(5):
        try:
            response = requests.get(url)
            if response.status_code == 200:
                return response
            last_error = f"status {response.status_code}"
        except requests.RequestException as e:
            last_error = str(e)
    print(f"Failed to connect to {url} — {last_error}")
    return None



def better_post(url:str, payload, headers) -> requests.Response:
    try:
        response = requests.post(url, data=payload, headers=headers)
        if response.status_code == 200:
            return response
        else:
            print(f"[Error] Failed to post — status {response.status_code}")
            return None
    except requests.RequestException as e: 
        print(f"[Error] Failed to post to {url} — {e}")
        return None




def detect_mime_type(data: bytes) -> str:
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png"
    elif data[:2] == b'\xff\xd8':
        return "image/jpeg"
    elif data[:6] in (b'GIF87a', b'GIF89a'):
        return "image/gif"
    elif data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return "image/webp"
    return "image/jpeg"




@st.cache_data(persist="disk", show_spinner=True)
def get_image_cache(url:str, crop:bool=False, crop_size:tuple=(400, 600)) -> str:
    response = better_get(url)
    if response is None:
        return None
    
    try:
        if not crop:
            mime_type = detect_mime_type(response.content)
            if not mime_type.startswith("image/"):
                return None
            encoded = base64.b64encode(response.content).decode("utf-8")
            return f"data:{mime_type};base64,{encoded}"
        else:
            image = Image.open(BytesIO(response.content))
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGBA")
                format = "PNG"
            else:
                image = image.convert("RGB")
                format = "JPEG"
            
            image = ImageOps.fit(image, crop_size, centering=(0.5, 0.2))
            with BytesIO() as buffered:
                image.save(buffered, format=format, quality=85, optimize=True)
                image_string = base64.b64encode(buffered.getvalue()).decode()
            return f"data:image/{format.lower()};base64,{image_string}"
    except Exception:
        return None
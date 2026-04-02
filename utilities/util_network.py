import requests
from PIL import Image, ImageOps
import streamlit as st
from io import BytesIO
import base64




def better_get(url:str) -> requests.Response:
    for _ in range(5):
        try:
            with requests.get(url) as response:
                if response.status_code == 200:
                    return response
                else:
                    raise Exception()
        except:
            print(f"[Error] Failed to connect to the database [{response.status_code}]")
            return None




def better_post(url:str, payload, headers) -> requests.Response:
    try:
        with requests.post(url, data=payload, headers=headers) as response:
            if response.status_code == 200:
                return response
            else:
                raise Exception()
    except: 
        print(f"[Error] Failed to connect to the database [{response.status_code}]")
        return None




@st.cache_data(persist="disk", show_spinner=True)
def process_image(url:str, crop:bool) -> ImageOps:
    try:
        response = better_get(url)
        img = Image.open(BytesIO(response.content))
        if crop:
            cropped_img = ImageOps.fit(img, (400, 600), centering=(0.5, 0.2))
            return cropped_img
        else:
            return img
    except Exception:
        return None




@st.cache_data(persist="disk", show_spinner=True)
def get_image_base64(img:ImageOps):
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()




@st.cache_data(persist="disk", show_spinner=True)
def get_cached_image_base64(url):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            # Convert binary image data to a Base64 string
            encoded_body = base64.b64encode(response.content).decode("utf-8")
            return f"data:image/jpeg;base64,{encoded_body}"
    except Exception as e:
        return None # Fallback if URL is broken
    return url
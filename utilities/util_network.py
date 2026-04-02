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
    print(f"[Error] Failed to connect to {url} — {last_error}")
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
def get_image_base64(url:str, crop:bool):
    img = process_image(url, crop)
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode()




@st.cache_data(persist="disk", show_spinner=True)
def get_cached_image_base64(url):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            encoded_body = base64.b64encode(response.content).decode("utf-8")
            return f"data:image/jpeg;base64,{encoded_body}"
    except Exception as e:
        return None
    return url
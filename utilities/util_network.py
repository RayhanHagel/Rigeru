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
    st.toast(f":red[Failed to connect to {url} — {last_error}]", duration="infinite", icon=":material/apps_outage:")
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




@st.cache_data(persist="disk", show_spinner=True)
def get_image_cache(url:str, crop:bool=False) -> str:
    response = better_get(url)
    if response is None:
        return None
    
    if not crop:
        encoded_body = base64.b64encode(response.content).decode("utf-8")
        return f"data:image/png;base64,{encoded_body}"
    else:
        image = Image.open(BytesIO(response.content))
        image = ImageOps.fit(image, (400, 600), centering=(0.5, 0.2))
        buffered = BytesIO()
        image.save(buffered, format="PNG")
        return f"data:image/png;base64,{base64.b64encode(buffered.getvalue()).decode()}"
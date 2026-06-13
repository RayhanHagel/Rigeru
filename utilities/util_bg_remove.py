import io
from PIL import Image

# Import rembg and cache it to avoid reloading the model on every Streamlit rerun
import streamlit as st

@st.cache_resource(show_spinner=False)
def load_rembg_session():
    """Loads the rembg model session into cache for faster processing."""
    try:
        from rembg import new_session
        return new_session("u2net"), True # u2net is the standard high-quality model
    except ImportError:
        return None, False

def remove_image_background(image_bytes: bytes) -> tuple[bool, bytes | str]:
    """
    Removes the background from the provided image bytes.
    Returns the processed image as PNG bytes (to preserve transparency).
    """
    session, is_loaded = load_rembg_session()
    
    if not is_loaded:
        return False, "Missing dependency. Please run: `pip install rembg`"
        
    try:
        from rembg import remove
        
        # Load input image
        input_image = Image.open(io.BytesIO(image_bytes))
        
        # Process the image to remove background
        # We pass the session to reuse the loaded model
        output_image = remove(input_image, session=session)
        
        # Save output to bytes as PNG
        img_byte_arr = io.BytesIO()
        output_image.save(img_byte_arr, format='PNG')
        
        return True, img_byte_arr.getvalue()
        
    except Exception as e:
        return False, f"Failed to remove background: {str(e)}"
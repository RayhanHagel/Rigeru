import io
import os
import torch
import numpy as np
from PIL import Image
from functools import lru_cache

# Set U2NET_HOME so rembg downloads models to cache/models/
os.environ["U2NET_HOME"] = os.path.join(os.getcwd(), "cache", "models")
os.environ["HF_HOME"] = os.path.join(os.getcwd(), "cache", "models", "huggingface")

from utilities.util_config import get_model_config
from utilities.util_huggingface import load_hf_token

@lru_cache(maxsize=1)
def load_rembg_session(device_pref: str):
    """Loads the rembg model session into cache for faster processing."""
    try:
        from rembg import new_session
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider'] if device_pref != "CPU Only" else ['CPUExecutionProvider']
        return new_session("u2net", providers=providers), True
    except ImportError:
        return None, False

# Cache the BriaAI model to avoid reloading
_briaai_model_cache = {}

def load_briaai_model(model_name: str, device_pref: str):
    """Loads a BriaAI RMBG model using transformers pipeline or AutoModel."""
    if model_name in _briaai_model_cache:
        return _briaai_model_cache[model_name], True
        
    try:
        import transformers
        if not hasattr(transformers.PreTrainedModel, "all_tied_weights_keys"):
            transformers.PreTrainedModel.all_tied_weights_keys = property(lambda self: {})
            
        from transformers import pipeline
        hf_token = load_hf_token() or None
        
        device = "cpu"
        if device_pref != "CPU Only" and torch.cuda.is_available():
            device = "cuda"
        
        # BriaAI RMBG models use a custom image-segmentation pipeline
        pipe = pipeline(
            "image-segmentation", 
            model=model_name, 
            trust_remote_code=True, 
            token=hf_token,
            device=device
        )
        
        _briaai_model_cache[model_name] = pipe
        return pipe, True
    except Exception as e:
        return None, f"Failed to load {model_name}. Ensure HF_TOKEN is set in Account Settings if it's a gated model. Error: {str(e)}"

def remove_image_background(image_bytes: bytes) -> tuple[bool, bytes | str]:
    """
    Removes the background from the provided image bytes.
    Returns the processed image as PNG bytes (to preserve transparency).
    """
    model_choice = get_model_config("background_removal")
    device_pref = get_model_config("device_preference")
    
    if not model_choice:
        model_choice = "u2net"
        
    input_image = Image.open(io.BytesIO(image_bytes))
    
    if model_choice == "u2net":
        session, is_loaded = load_rembg_session(device_pref)
        if not is_loaded:
            return False, "Missing dependency. Please run: `pip install rembg`"
        try:
            from rembg import remove
            output_image = remove(input_image, session=session)
        except Exception as e:
            return False, f"Failed to remove background using u2net: {str(e)}"
            
    elif model_choice in ["briaai-rmbg-1.4", "briaai-rmbg-2.0"]:
        model_repo = "briaai/RMBG-1.4" if model_choice == "briaai-rmbg-1.4" else "briaai/RMBG-2.0"
        pipe, is_loaded = load_briaai_model(model_repo, device_pref)
        
        if not isinstance(is_loaded, bool) or not is_loaded:
            return False, str(is_loaded) # Error message from loader
            
        try:
            # The transformers image-segmentation pipeline returns a PIL Image 
            # for RMBG models with transparent background directly.
            output_image = pipe(input_image)
            if isinstance(output_image, list) and len(output_image) > 0 and 'mask' in output_image[0]:
                 # Some pipelines return [{'score':..., 'label':..., 'mask': PILImage}]
                 mask = output_image[0]['mask']
                 input_image.putalpha(mask)
                 output_image = input_image
                 
        except Exception as e:
            return False, f"Failed to remove background using {model_repo}: {str(e)}"
    else:
        return False, f"Unknown model selected: {model_choice}"

    try:
        # Save output to bytes as PNG
        img_byte_arr = io.BytesIO()
        output_image.save(img_byte_arr, format='PNG')
        return True, img_byte_arr.getvalue()
    except Exception as e:
        return False, f"Failed to save image: {str(e)}"
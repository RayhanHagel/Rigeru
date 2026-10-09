import base64
import io
import json
import httpx
from PIL import Image

def process_data_urls(data_urls: list[str]) -> list[Image.Image]:
    """Converts base64 data URLs into PIL Image instances.

    Args:
        data_urls (list[str]): List of data URL strings or raw base64 encoded strings.

    Returns:
        list[Image.Image]: Decoded RGB PIL images.
    """
    images = []
    for url in data_urls:
        if "," in url:
            base64_data = url.split(",")[1]
        else:
            base64_data = url
        image_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")
        images.append(img)
    return images

def export_whiteboard(images_data_urls: list[str], format_type: str, width: int, height: int, frame_delay: int = 33) -> tuple[bool, bytes | str]:
    """Exports a series of whiteboard frame canvases to PDF or GIF format.

    Args:
        images_data_urls (list[str]): Base64 data URLs representing whiteboard frames.
        format_type (str): Output format ('pdf' or 'gif').
        width (int): Frame width in pixels.
        height (int): Frame height in pixels.
        frame_delay (int): Duration per frame in milliseconds (for animated GIF). Defaults to 33.

    Returns:
        tuple[bool, bytes | str]: (success flag, binary bytes of exported media or error message).
    """
    if not images_data_urls:
        return False, "No images provided"
        
    try:
        images = process_data_urls(images_data_urls)
        
        out_bytes = io.BytesIO()
        if format_type.lower() == "pdf":
            if len(images) == 1:
                images[0].save(out_bytes, format="PDF", resolution=100.0)
            else:
                images[0].save(out_bytes, format="PDF", resolution=100.0, save_all=True, append_images=images[1:])
        elif format_type.lower() == "gif":
            if len(images) == 1:
                images[0].save(out_bytes, format="GIF")
            else:
                # REPLACED hardcoded 500 with the dynamic frame_delay from the frontend
                images[0].save(out_bytes, format="GIF", save_all=True, append_images=images[1:], duration=frame_delay, loop=0)
        else:
            return False, f"Unsupported format: {format_type}"
            
        return True, out_bytes.getvalue()
    except Exception as e:
        return False, str(e)

async def transcribe_whiteboard(image_data_url: str) -> tuple[bool, str]:
    """Transcribes handwritten whiteboard text using a local Ollama vision model.

    Args:
        image_data_url (str): Data URL or base64 image of the whiteboard canvas.

    Returns:
        tuple[bool, str]: (success flag, transcribed markdown text or error string).
    """
    try:
        from utilities.core.util_config import load_all_config
        config = load_all_config()
        # Default to a vision model like llava if not specified, but let's just use llava
        vision_model = config.get("obsidian_ollama_vision_model", "llava")
        
        if "," in image_data_url:
            base64_data = image_data_url.split(",")[1]
        else:
            base64_data = image_data_url
            
        payload = {
            "model": vision_model,
            "prompt": "Please transcribe any handwritten text in this image. Do not describe the image, just output the transcribed text exactly as it appears.",
            "images": [base64_data],
            "stream": False
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post("http://localhost:11434/api/generate", json=payload, timeout=120.0)
            
        if response.status_code == 200:
            data = response.json()
            return True, data.get("response", "").strip()
        else:
            return False, f"Ollama API error: {response.text}"
            
    except Exception as e:
        return False, str(e)

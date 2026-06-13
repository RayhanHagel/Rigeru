import io
from PIL import Image

def get_color_from_coords(image_bytes: bytes, x: int, y: int) -> tuple[bool, dict | str]:
    """
    Extracts the RGB and HEX color of a specific pixel (x, y) from an image.
    """
    try:
        # Load image and ensure it's in RGB format (handles PNGs with transparency)
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        
        # Validate coordinates to prevent out-of-bounds errors
        if not (0 <= x < img.width and 0 <= y < img.height):
            return False, "Selected coordinates are outside the image boundaries."
        
        # Get pixel RGB values
        r, g, b = img.getpixel((x, y))
        
        # Format as standard HEX
        hex_color = f"#{r:02x}{g:02x}{b:02x}".upper()
        
        return True, {
            "hex": hex_color,
            "rgb": f"rgb({r}, {g}, {b})",
            "r": r, 
            "g": g, 
            "b": b
        }
        
    except Exception as e:
        return False, f"Failed to extract color: {str(e)}"
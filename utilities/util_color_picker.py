import io
from PIL import Image

def get_color_from_coords(image_bytes: bytes, x: int, y: int) -> tuple[bool, dict | str]:
    """
    Extracts the RGB and HEX color of a specific pixel (x, y) from an image.
    """
    try:
        # OPTIMIZED: Wrapped in context manager to prevent PIL memory leaks
        with Image.open(io.BytesIO(image_bytes)) as raw_img:
            img = raw_img.convert("RGB")
        
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

def get_color_palette(image_bytes: bytes, num_colors: int = 5) -> tuple[bool, list | str]:
    """
    Extracts the dominant color palette from an image using quantization.
    """
    try:
        with Image.open(io.BytesIO(image_bytes)) as raw_img:
            # Resize image to speed up processing
            img = raw_img.convert("RGB")
            img.thumbnail((200, 200))
            
            # Quantize image to extract dominant colors (2 = FASTOCTREE)
            q_img = img.quantize(colors=num_colors, method=2)
            
            # Get palette (returns flat list [R, G, B, R, G, B, ...])
            palette = q_img.getpalette()
            
            colors = []
            for i in range(num_colors):
                r, g, b = palette[i*3 : i*3 + 3]
                hex_color = f"#{r:02x}{g:02x}{b:02x}".upper()
                colors.append({
                    "hex": hex_color,
                    "rgb": f"rgb({r}, {g}, {b})"
                })
            return True, colors
    except Exception as e:
        return False, f"Failed to extract palette: {str(e)}"
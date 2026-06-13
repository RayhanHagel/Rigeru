import io
from PIL import Image, ExifTags

def get_exif_data(image_bytes: bytes) -> tuple[bool, dict | str]:
    """Reads and parses the EXIF metadata from an image."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # getexif() is the modern PIL method for extracting EXIF
        exif_data = img.getexif() 
        
        if not exif_data:
            return True, {}
            
        readable_exif = {}
        for tag_id, value in exif_data.items():
            tag = ExifTags.TAGS.get(tag_id, tag_id)
            
            # Prevent binary data (like thumbnails) from breaking the UI
            if isinstance(value, bytes):
                value = "<binary data>"
                
            readable_exif[str(tag)] = str(value)
            
        return True, readable_exif
        
    except Exception as e:
        return False, f"Error reading EXIF: {str(e)}"

def strip_exif(image_bytes: bytes) -> tuple[bool, bytes | str]:
    """
    Strips EXIF data by loading the image and saving it without passing 
    the original EXIF information back into the file.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        output = io.BytesIO()
        
        # PIL's save() naturally excludes EXIF unless explicitly provided
        img_format = img.format if img.format else "JPEG"
        img.save(output, format=img_format)
        
        return True, output.getvalue()
        
    except Exception as e:
        return False, f"Failed to strip EXIF: {str(e)}"
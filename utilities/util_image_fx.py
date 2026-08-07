def make_blur_fn(blur_intensity: int, blur_type: str):
    """
    Creates a blur function (Gaussian or Pixelated/Resize) based on the provided parameters.
    """
    import cv2
    if blur_type == "Gaussian":
        k = int(blur_intensity) * 2 + 1
        return lambda roi: cv2.GaussianBlur(roi, (k, k), 30)
    else:
        ratio = max(1, 100 - blur_intensity) / 100.0

        def _blur(roi):
            h, w = roi.shape[:2]
            sw, sh = max(1, int(w * ratio)), max(1, int(h * ratio))
            return cv2.resize(
                cv2.resize(roi, (sw, sh), interpolation=cv2.INTER_LINEAR), 
                (w, h), 
                interpolation=cv2.INTER_NEAREST
            )
        return _blur


def apply_blur_fn(image, x: int, y: int, w: int, h: int, blur_fn):
    """
    Applies the provided blur function to a specific bounding box within an image.
    Modifies the image in-place and returns it.
    """
    ih, iw = image.shape[:2]
    x, y = max(0, x), max(0, y)
    x2, y2 = min(iw, x + w), min(ih, y + h)
    
    if x2 > x and y2 > y:
        image[y:y2, x:x2] = blur_fn(image[y:y2, x:x2])
        
    return image

def encode_cv2_image_to_bytes(cv2_img, format: str = ".jpg") -> bytes:
    """
    Encodes an OpenCV image (numpy array) to raw bytes.
    Returns empty bytes on failure.
    """
    import cv2
    is_success, buffer = cv2.imencode(format, cv2.cvtColor(cv2_img, cv2.COLOR_RGB2BGR))
    if is_success:
        return buffer.tobytes()
    return b""

def encode_cv2_image_to_base64(cv2_img, format: str = ".jpg") -> str:
    """
    Encodes an OpenCV image to a base64 string, formatted as a data URL.
    Returns empty string on failure.
    """
    import cv2
    import base64
    is_success, buffer = cv2.imencode(format, cv2.cvtColor(cv2_img, cv2.COLOR_RGB2BGR))
    if is_success:
        b64 = base64.b64encode(buffer).decode("utf-8")
        mime = "image/jpeg" if format.lower() in [".jpg", ".jpeg"] else "image/png"
        return f"data:{mime};base64,{b64}"
    return ""
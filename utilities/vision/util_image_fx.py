from typing import Any, Callable

def make_blur_fn(blur_intensity: int, blur_type: str) -> Callable[[Any], Any]:
    """
    Create a reusable image blurring function (Gaussian or Pixelated).

    Args:
        blur_intensity (int): Intensity magnitude (1-100).
        blur_type (str): Blur algorithm type ('Gaussian' or 'Pixelated').

    Returns:
        Callable[[Any], Any]: Callable accepting an ROI image array and returning blurred ROI.
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


def apply_blur_fn(image: Any, x: int, y: int, w: int, h: int, blur_fn: Callable[[Any], Any]) -> Any:
    """
    Apply a blur transformation callable to a specified bounding box region in an image.

    Args:
        image (Any): OpenCV/numpy image array.
        x (int): Horizontal bounding box origin.
        y (int): Vertical bounding box origin.
        w (int): Bounding box width.
        h (int): Bounding box height.
        blur_fn (Callable[[Any], Any]): Filter transformation callable.

    Returns:
        Any: In-place modified image array.
    """
    ih, iw = image.shape[:2]
    x, y = max(0, x), max(0, y)
    x2, y2 = min(iw, x + w), min(ih, y + h)
    
    if x2 > x and y2 > y:
        image[y:y2, x:x2] = blur_fn(image[y:y2, x:x2])
        
    return image


def encode_cv2_image_to_bytes(cv2_img: Any, format: str = ".jpg") -> bytes:
    """
    Encode an OpenCV RGB/BGR numpy array to encoded raw byte payload.

    Args:
        cv2_img (Any): Source image array in RGB order.
        format (str, optional): Target file extension format (e.g. '.jpg', '.png'). Defaults to ".jpg".

    Returns:
        bytes: Encoded compressed binary image bytes.
    """
    import cv2
    is_success, buffer = cv2.imencode(format, cv2.cvtColor(cv2_img, cv2.COLOR_RGB2BGR))
    if is_success:
        return buffer.tobytes()
    return b""


def encode_cv2_image_to_base64(cv2_img: Any, format: str = ".jpg") -> str:
    """
    Encode an OpenCV RGB image array to an inline Base64 data URI string.

    Args:
        cv2_img (Any): Source image array in RGB order.
        format (str, optional): Image compression format (e.g. '.jpg', '.png'). Defaults to ".jpg".

    Returns:
        str: HTML/CSS compliant data URL string.
    """
    import cv2
    import base64
    is_success, buffer = cv2.imencode(format, cv2.cvtColor(cv2_img, cv2.COLOR_RGB2BGR))
    if is_success:
        b64 = base64.b64encode(buffer).decode("utf-8")
        mime = "image/jpeg" if format.lower() in [".jpg", ".jpeg"] else "image/png"
        return f"data:{mime};base64,{b64}"
    return ""
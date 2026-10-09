import qrcode
import cv2
import numpy as np
import base64
from io import BytesIO

def generate_qr(text: str, fill_color: str = "black", back_color: str = "white") -> str:
    """Generates a QR code and returns it as a base64 encoded PNG data URL.

    Args:
        text (str): Content or URL to encode in the QR code.
        fill_color (str): QR code modules color name or hex. Defaults to "black".
        back_color (str): Background color name or hex. Defaults to "white".

    Returns:
        str: Base64 data URL representing the rendered PNG image.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(text)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color=fill_color, back_color=back_color)
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{img_str}"

def scan_qr_from_base64(b64_img: str) -> str:
    """Scans a QR code from a base64 encoded image string (e.g. data:image/png;base64,...).

    Args:
        b64_img (str): Data URL or raw base64 string containing the QR image.

    Returns:
        str: Decoded payload text from the QR code, or empty string on failure.
    """
    try:
        # Strip header if present
        if "," in b64_img:
            b64_img = b64_img.split(",")[1]
            
        img_data = base64.b64decode(b64_img)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        
        detector = cv2.QRCodeDetector()
        data, bbox, _ = detector.detectAndDecode(img)
        if data:
            return data
    except Exception as e:
        print(f"Error scanning QR from base64: {e}")
    return ""

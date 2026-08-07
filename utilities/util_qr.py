import qrcode
import cv2
import numpy as np
import base64
from io import BytesIO

def generate_qr(text: str, fill_color: str = "black", back_color: str = "white") -> str:
    """
    Generates a QR code and returns it as a base64 encoded PNG string.
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
    """
    Scans a QR code from a base64 encoded image string (e.g. data:image/png;base64,...).
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

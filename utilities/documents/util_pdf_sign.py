from typing import Any, Dict, List, Optional, Tuple
import io

def sign_pdf(pdf_bytes: bytes, sig_bytes: bytes, x: float = 10, y: float = 10, w: float = 150, h: float = 50) -> tuple[bool, bytes | str]:
    """

            Superimpose an image signature overlay at designated coordinates on the first page.

            Args:
                pdf_bytes (bytes): Source PDF binary payload.
                sig_bytes (bytes): Binary PNG or JPEG image signature payload.
                x (float, optional): Left coordinate origin in points. Defaults to 10.
                y (float, optional): Top coordinate origin in points. Defaults to 10.
                w (float, optional): Signature overlay width in points. Defaults to 150.
                h (float, optional): Signature overlay height in points. Defaults to 50.

            Returns:
                tuple[bool, bytes | str]: Success flag and signed PDF bytes or error message.
            
    """
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) == 0:
            return False, "PDF is empty."
            
        page = doc[0]
        rect = page.rect
        
        # Insert image
        sig_rect = fitz.Rect(x, y, x + w, y + h)
        page.insert_image(sig_rect, stream=sig_bytes)
        
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Sign failed: {str(e)}"

import io

def sign_pdf(pdf_bytes: bytes, sig_bytes: bytes, x: float = 10, y: float = 10, w: float = 150, h: float = 50) -> tuple[bool, bytes | str]:
    '''Adds an image signature at the specified location of the first page.'''
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

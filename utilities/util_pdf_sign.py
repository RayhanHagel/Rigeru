import io

def sign_pdf(pdf_bytes: bytes, signature_text: str) -> tuple[bool, bytes | str]:
    '''Adds a text watermark acting as a basic mock signature at the bottom right of the first page.'''
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
        
        # Bottom right
        x = rect.width - 200
        y = rect.height - 50
        
        # Insert text
        page.insert_text((x, y), f"Signed: {signature_text}", fontsize=12, color=(0, 0, 0))
        
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Sign failed: {str(e)}"

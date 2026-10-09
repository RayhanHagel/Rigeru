from typing import Any, Dict, List, Optional, Tuple
import io

def flatten_pdf(pdf_bytes: bytes) -> tuple[bool, bytes | str]:
    """

            Flatten interactive form fields and annotation overlays into static page pixels.

            Args:
                pdf_bytes (bytes): Source PDF binary payload.

            Returns:
                tuple[bool, bytes | str]: Success flag and flattened PDF bytes or error message.
            
    """
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        for page in doc:
            for annot in page.annots():
                # Setting flag 4 = no view, 8 = hidden?
                # A common way to flatten in pymupdf is to delete and draw or just use PyMuPDF's built-in.
                # Actually, there's no direct "flatten" that burns in fields easily without losing quality.
                # But we can try to just run save with garbage=3, deflate=True
                pass
                
        # To truly flatten, we convert each page to an image and re-wrap in PDF, or use gs.
        # But converting to image is lossy. Let's do a simple save trick first, which clears some interactive stuff if we strip metadata.
        # A more robust flattening converts pages to a new PDF. Let's do that.
        new_doc = fitz.open()
        for page in doc:
            pix = page.get_pixmap(dpi=150)
            new_page = new_doc.new_page(width=page.rect.width, height=page.rect.height)
            new_page.insert_image(page.rect, stream=pix.tobytes("png"))
            
        output_stream = io.BytesIO()
        new_doc.save(output_stream)
        doc.close()
        new_doc.close()
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Flatten failed: {str(e)}"

def optimize_pdf(pdf_bytes: bytes) -> tuple[bool, bytes | str]:
    """

            Optimize and compress PDF structures by purging dead objects and deflating streams.

            Args:
                pdf_bytes (bytes): Source PDF binary payload.

            Returns:
                tuple[bool, bytes | str]: Success flag and optimized PDF bytes or error message.
            
    """
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        output_stream = io.BytesIO()
        # garbage=4: remove unused objects, compress streams, clean up duplicate objects
        doc.save(output_stream, garbage=4, deflate=True, clean=True)
        doc.close()
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Optimize failed: {str(e)}"

def repair_pdf(pdf_bytes: bytes) -> tuple[bool, bytes | str]:
    """

            Attempt structural repair and object tree reconstruction of damaged PDF documents.

            Args:
                pdf_bytes (bytes): Corrupt or damaged PDF binary payload.

            Returns:
                tuple[bool, bytes | str]: Success flag and recovered PDF bytes or error message.
            
    """
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        # fitz handles corrupt pdfs fairly well on open
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        output_stream = io.BytesIO()
        doc.save(output_stream, garbage=1, clean=True)
        doc.close()
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Repair failed. File might be too damaged: {str(e)}"

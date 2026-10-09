from typing import Any, Dict, List, Optional, Tuple
import io
import os
import tempfile

def pdf_to_images(pdf_bytes: bytes, dpi: int = 150) -> tuple[bool, list | str]:
    """

            Render each page of a PDF document into a PNG image bitmap.

            Args:
                pdf_bytes (bytes): Source PDF binary payload.
                dpi (int, optional): Render rasterization DPI resolution. Defaults to 150.

            Returns:
                tuple[bool, list | str]: Success flag and list of (page_num, png_bytes) tuples or error message.
            
    """
    try:
        import fitz  # Lazy Load
    except ImportError:
        return False, "Missing dependency. Please run: `pip install pymupdf`"

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        images = []
        for i in range(len(doc)):
            page = doc[i]
            pix = page.get_pixmap(dpi=dpi)
            images.append((i + 1, pix.tobytes("png")))
        doc.close()
        return True, images
    except Exception as e:
        return False, f"Failed to convert PDF to images: {str(e)}"

def images_to_pdf(image_files: list[bytes]) -> tuple[bool, bytes | str]:
    """

            Convert a sequence of image files into a single composite PDF document.

            Args:
                image_files (list[bytes]): List of binary image payloads (PNG, JPEG, etc.).

            Returns:
                tuple[bool, bytes | str]: Success boolean flag and generated PDF bytes or error message.
            
    """
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency. Please run: `pip install pymupdf`"

    if not image_files:
        return False, "No images provided."

    try:
        doc = fitz.open()
        for img_bytes in image_files:
            pix = fitz.Pixmap(img_bytes)
            page = doc.new_page(width=pix.width, height=pix.height)
            page.insert_image(page.rect, stream=img_bytes)
            
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Failed to convert images to PDF: {str(e)}"

def make_pdf_searchable(pdf_bytes: bytes) -> tuple[bool, bytes | str]:
    """

            Apply OCR text recognition to scanned document pages to create a searchable text layer.

            Args:
                pdf_bytes (bytes): Scanned PDF document binary payload.

            Returns:
                tuple[bool, bytes | str]: Success boolean flag and OCR-enhanced PDF bytes or error message.
            
    """
    try:
        import ocrmypdf
    except ImportError:
        return False, "Dependency missing. Run: `pip install ocrmypdf`. (Requires system Tesseract/Ghostscript)"

    try:
        # ocrmypdf requires physical files, so we use secure temporary files
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f_in, \
             tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as f_out:
            f_in.write(pdf_bytes)
            f_in.flush()
            
            # Run OCR process
            ocrmypdf.ocr(f_in.name, f_out.name, force_ocr=True, progress_bar=False)
            
            with open(f_out.name, "rb") as f_result:
                searchable_bytes = f_result.read()
                
        os.unlink(f_in.name)
        os.unlink(f_out.name)
        return True, searchable_bytes
    except Exception as e:
        return False, f"OCR Processing failed: {str(e)}"

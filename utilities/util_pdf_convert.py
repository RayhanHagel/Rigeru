import io
import os
import tempfile

def pdf_to_images(pdf_bytes: bytes, dpi: int = 150) -> tuple[bool, list | str]:
    """Converts each page of a PDF into a PNG image."""
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
    """Merges a list of image bytes into a single PDF."""
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency. Please run: `pip install pymupdf`"

    if not image_files:
        return False, "No images provided."

    try:
        doc = fitz.open()
        for img_bytes in image_files:
            img_doc = fitz.open(stream=img_bytes, filetype="image")
            pdf_bytes = img_doc.convert_to_pdf()
            img_pdf = fitz.open("pdf", pdf_bytes)
            doc.insert_pdf(img_pdf)
            img_doc.close()
            img_pdf.close()
            
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Failed to convert images to PDF: {str(e)}"

def make_pdf_searchable(pdf_bytes: bytes) -> tuple[bool, bytes | str]:
    """Applies OCR to a scanned PDF to create a selectable text layer."""
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
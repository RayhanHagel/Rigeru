import io
import zipfile

def extract_pdf_images(pdf_bytes: bytes) -> tuple[bool, bytes | str]:
    '''Extracts all images and zips them.'''
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            count = 0
            for page_index in range(len(doc)):
                page = doc[page_index]
                image_list = page.get_images()
                
                for image_index, img in enumerate(image_list, start=1):
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    image_ext = base_image["ext"]
                    
                    filename = f"page_{page_index+1}_img_{image_index}.{image_ext}"
                    zip_file.writestr(filename, image_bytes)
                    count += 1
                    
        doc.close()
        
        if count == 0:
            return False, "No images found in PDF."
            
        return True, zip_buffer.getvalue()
    except Exception as e:
        return False, f"Extract images failed: {str(e)}"


def pdf_to_image(pdf_bytes: bytes, dpi: int = 150) -> tuple[bool, bytes | str]:
    '''Converts each page to a PNG and zips them. If 1 page, returns just PNG.'''
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        if len(doc) == 1:
            pix = doc[0].get_pixmap(dpi=dpi)
            doc.close()
            return True, pix.tobytes("png")
            
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for page_index in range(len(doc)):
                page = doc[page_index]
                pix = page.get_pixmap(dpi=dpi)
                filename = f"page_{page_index+1}.png"
                zip_file.writestr(filename, pix.tobytes("png"))
                
        doc.close()
        return True, zip_buffer.getvalue()
    except Exception as e:
        return False, f"PDF to image failed: {str(e)}"

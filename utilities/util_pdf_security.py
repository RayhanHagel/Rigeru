import io

def manage_pdf_password(pdf_bytes: bytes, password: str, action: str) -> tuple[bool, bytes | str]:
    """
    Encrypts or decrypts a PDF file. 
    `action` must be either "lock" or "unlock".
    """
    try:
        import fitz  # Lazy Load
    except ImportError:
        return False, "Missing dependency. Please run: `pip install pymupdf`"

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        if action == "lock":
            output_stream = io.BytesIO()
            # AES-256 encryption for maximum security
            doc.save(
                output_stream, 
                encryption=fitz.PDF_ENCRYPT_AES_256, 
                owner_pw=password, 
                user_pw=password
            )
            doc.close()
            return True, output_stream.getvalue()
            
        elif action == "unlock":
            if not doc.is_encrypted:
                return False, "This document is not encrypted."
                
            if doc.authenticate(password):
                output_stream = io.BytesIO()
                # Save with no encryption to permanently remove the password
                doc.save(output_stream, encryption=fitz.PDF_ENCRYPT_NONE)
                doc.close()
                return True, output_stream.getvalue()
            else:
                return False, "Incorrect password."
                
        else:
            return False, "Invalid action specified."

    except Exception as e:
        return False, f"Security operation failed: {str(e)}"


def add_pdf_watermark(pdf_bytes: bytes, text: str, opacity: float = 0.3) -> tuple[bool, bytes | str]:
    """
    Applies a diagonal text watermark across all pages of a PDF.
    """
    try:
        import fitz  # Lazy Load
    except ImportError:
        return False, "Missing dependency. Please run: `pip install pymupdf`"

    if not text.strip():
        return False, "Watermark text cannot be empty."

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        for page in doc:
            rect = page.rect
            # Center the watermark and rotate it diagonally (45 degrees)
            center_point = fitz.Point(rect.width / 2, rect.height / 2)
            
            # Create a shape to apply transparency
            shape = page.new_shape()
            shape.insert_text(
                center_point,
                text,
                fontsize=50,
                color=(0.5, 0.5, 0.5), # Gray
                fontname="helv",
                rotate=-45
            )
            shape.commit(fill_opacity=opacity)
            
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        return True, output_stream.getvalue()

    except Exception as e:
        return False, f"Failed to apply watermark: {str(e)}"
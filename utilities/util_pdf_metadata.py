import io

def get_pdf_metadata(pdf_bytes: bytes) -> tuple[bool, dict | str]:
    """Extracts the internal metadata dictionary from a PDF."""
    try:
        import fitz  # Lazy Load
    except ImportError:
        return False, "Missing dependency. Please run: `pip install pymupdf`"

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        metadata = doc.metadata
        doc.close()
        return True, metadata
    except Exception as e:
        return False, f"Failed to read metadata: {str(e)}"

def update_pdf_metadata(pdf_bytes: bytes, new_metadata: dict) -> tuple[bool, bytes | str]:
    """Updates the PDF metadata dictionary and saves a new copy."""
    try:
        import fitz  # Lazy Load
    except ImportError:
        return False, "Missing dependency. Please run: `pip install pymupdf`"

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        doc.set_metadata(new_metadata)
        
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Failed to update metadata: {str(e)}"

def check_pdf_authenticity(pdf_bytes: bytes) -> tuple[bool, dict | str]:
    """
    Analyzes the health and authenticity properties of the PDF.
    Checks for corruption, encryption, and digital signatures.
    """
    try:
        import fitz  # Lazy Load
    except ImportError:
        return False, "Missing dependency. Please run: `pip install pymupdf`"

    health_report = {
        "is_corrupt": False,
        "needs_password": False,
        "has_digital_signature": False,
        "page_count": 0,
        "pdf_version": ""
    }

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        health_report["needs_password"] = doc.needs_pass
        health_report["is_corrupt"] = doc.is_repaired
        
        if not doc.needs_pass:
            health_report["page_count"] = len(doc)
            # Fetch the internal PDF version (e.g., 1.4, 1.7)
            health_report["pdf_version"] = doc.pdf_version 
            
            # Check for digital signatures (sigflags indicate presence of signature fields)
            health_report["has_digital_signature"] = doc.get_sigflags() > 0

        doc.close()
        return True, health_report
    except Exception:
        # If fitz.open fails completely, the file is severely corrupted or not a PDF
        health_report["is_corrupt"] = True
        return True, health_report
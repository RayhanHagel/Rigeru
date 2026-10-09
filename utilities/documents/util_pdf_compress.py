from typing import Any, Dict, List, Optional, Tuple
import io

def compress_pdf(file_bytes: bytes) -> tuple[bool, bytes | None, int, int, float, str]:
    """

            Compress PDF streams using PyMuPDF deflation and duplicate object garbage collection.

            Args:
                file_bytes (bytes): Source PDF binary payload.

            Returns:
                tuple[bool, bytes | None, int, int, float, str]: Success flag, compressed bytes, original size, new size, savings percent, error string.
            
    """
    try:
        import fitz  # Lazy Load PyMuPDF
    except ImportError:
        return False, None, 0, 0, 0.0, "Missing dependency. Please run: `pip install pymupdf`"

    try:
        original_size = len(file_bytes)
        
        # Load PDF into memory
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        
        # Save to a new byte stream with heavy optimization
        output_stream = io.BytesIO()
        # garbage=4 (removes unused & duplicate objects), deflate=True (compresses streams)
        doc.save(output_stream, garbage=4, deflate=True, clean=True)
        doc.close()
        
        compressed_bytes = output_stream.getvalue()
        new_size = len(compressed_bytes)
        
        # If the optimizer somehow makes it larger (already heavily compressed), discard changes
        if new_size >= original_size:
            return True, file_bytes, original_size, original_size, 0.0, ""
            
        percent_saved = ((original_size - new_size) / original_size) * 100
        return True, compressed_bytes, original_size, new_size, percent_saved, ""
        
    except Exception as e:
        return False, None, 0, 0, 0.0, f"Failed to compress PDF: {str(e)}"

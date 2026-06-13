import io

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

def redact_pdf_text(pdf_bytes: bytes, words_to_redact: list[str]) -> tuple[bool, bytes | str, int]:
    """
    Searches a PDF for specific words and permanently redacts them.
    Returns: (Success, Processed PDF Bytes / Error Message, Total Redactions Made)
    """
    if not fitz:
        return False, "Missing dependency. Please run: `pip install pymupdf`", 0

    if not words_to_redact:
        return False, "No words provided for redaction.", 0

    try:
        # Load PDF from bytes
        pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_redactions = 0

        # Iterate through every page
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            
            for word in words_to_redact:
                clean_word = word.strip()
                if not clean_word:
                    continue
                    
                # Search for the exact word to get its coordinates (bounding boxes)
                text_instances = page.search_for(clean_word)
                
                for inst in text_instances:
                    # Add a redaction annotation over the coordinates (default is black fill)
                    page.add_redact_annot(inst, fill=(0, 0, 0))
                    total_redactions += 1
            
            # Apply the redactions to permanently remove the underlying text and draw the black boxes
            page.apply_redactions()

        if total_redactions == 0:
            return True, pdf_bytes, 0

        # Save the new PDF to a byte stream
        output_stream = io.BytesIO()
        # Garbage collection options help ensure the redacted text is completely stripped
        pdf_document.save(output_stream, garbage=3, deflate=True)
        pdf_document.close()

        return True, output_stream.getvalue(), total_redactions

    except Exception as e:
        return False, f"Failed to redact PDF: {str(e)}", 0
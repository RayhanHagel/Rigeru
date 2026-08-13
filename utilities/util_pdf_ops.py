import io

def merge_pdfs(pdf_bytes_list: list[bytes]) -> tuple[bool, bytes | str]:
    """Merges a sequential list of PDF bytes into a single document."""
    try:
        import fitz  # Lazy Load
    except ImportError:
        return False, "Missing dependency. Please run: `pip install pymupdf`"

    if not pdf_bytes_list:
        return False, "No PDFs provided."

    try:
        merged_doc = fitz.open()
        for pdf_bytes in pdf_bytes_list:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            merged_doc.insert_pdf(doc)
            doc.close()
            
        output_stream = io.BytesIO()
        merged_doc.save(output_stream)
        merged_doc.close()
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Merge failed: {str(e)}"


def split_pdf(pdf_bytes: bytes, start_page: int, end_page: int) -> tuple[bool, bytes | str]:
    """Extracts a specific range of pages (1-indexed)."""
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"

    try:
        src_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total = len(src_doc)
        
        if start_page < 1 or end_page > total or start_page > end_page:
            return False, f"Invalid range. Document has {total} pages."
            
        new_doc = fitz.open()
        # fitz uses 0-based indexing for internal operations
        new_doc.insert_pdf(src_doc, from_page=start_page - 1, to_page=end_page - 1)
        
        output_stream = io.BytesIO()
        new_doc.save(output_stream)
        src_doc.close()
        new_doc.close()
        
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Split failed: {str(e)}"

def split_pdf_buckets(pdf_bytes: bytes, buckets: list[list[int]]) -> tuple[bool, bytes | str]:
    """Splits a PDF into multiple PDFs based on page buckets (1-indexed). Returns a ZIP file."""
    import zipfile
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        src_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for idx, bucket in enumerate(buckets, start=1):
                if not bucket:
                    continue
                new_doc = fitz.open()
                for page_num in bucket:
                    if 1 <= page_num <= len(src_doc):
                        new_doc.insert_pdf(src_doc, from_page=page_num - 1, to_page=page_num - 1)
                
                pdf_buffer = io.BytesIO()
                new_doc.save(pdf_buffer)
                new_doc.close()
                zip_file.writestr(f"split_{idx}.pdf", pdf_buffer.getvalue())
                
        src_doc.close()
        return True, zip_buffer.getvalue()
    except Exception as e:
        return False, f"Split by buckets failed: {str(e)}"


def remove_specific_pages(pdf_bytes: bytes, pages_to_remove: list[int]) -> tuple[bool, bytes | str]:
    """Deletes specific pages (1-indexed)."""
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        # Convert to 0-indexed and sort in reverse to delete safely without shifting indices
        target_indices = sorted([p - 1 for p in pages_to_remove if 0 < p <= len(doc)], reverse=True)
        
        for idx in target_indices:
            doc.delete_page(idx)
            
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Page removal failed: {str(e)}"


def remove_blank_pages(pdf_bytes: bytes) -> tuple[bool, bytes | str, int]:
    """Detects and removes pages containing no text or vectors."""
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf", 0

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        blanks = []
        
        for i in range(len(doc)):
            page = doc[i]
            text = page.get_text().strip()
            drawings = page.get_drawings()
            images = page.get_images()
            
            # If no text, no vector lines, and no images -> it's blank
            if not text and not drawings and not images:
                blanks.append(i)
                
        if not blanks:
            doc.close()
            return True, pdf_bytes, 0
            
        for idx in reversed(blanks):
            doc.delete_page(idx)
            
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        
        return True, output_stream.getvalue(), len(blanks)
    except Exception as e:
        return False, f"Blank page cleaning failed: {str(e)}", 0


def resize_pdf_pages(pdf_bytes: bytes, target_size: str) -> tuple[bool, bytes | str]:
    """Scales all pages to a standard size (A4 or Letter)."""
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"

    sizes = {
        "A3": (842, 1191),
        "A4": (595, 842),
        "A5": (420, 595),
        "Letter": (612, 792),
        "Legal": (612, 1008),
        "Tabloid": (792, 1224)
    }
    
    if target_size in sizes:
        w, h = sizes[target_size]
    elif "x" in target_size.lower():
        try:
            pts = target_size.lower().split("x")
            w, h = float(pts[0].strip()), float(pts[1].strip())
        except:
            return False, "Invalid custom size format. Use 'Width x Height'."
    else:
        return False, "Unsupported target size."

    try:
        src_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        new_doc = fitz.open()
        target_rect = fitz.Rect(0, 0, w, h)
        
        for i in range(len(src_doc)):
            src_page = src_doc[i]
            # Create a new blank page of the target size
            new_page = new_doc.new_page(width=target_rect.width, height=target_rect.height)
            # Draw the old page onto the new page, scaling to fit
            new_page.show_pdf_page(target_rect, src_doc, src_page.number)
            
        output_stream = io.BytesIO()
        new_doc.save(output_stream)
        src_doc.close()
        new_doc.close()
        
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Resize failed: {str(e)}"

def rotate_pages(pdf_bytes: bytes, degrees: int, pages: str = "all") -> tuple[bool, bytes | str]:
    '''Rotates all or specific pages. degrees should be 90, 180, or 270.'''
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        target_pages = []
        if pages.strip().lower() == "all":
            target_pages = list(range(len(doc)))
        else:
            for p in pages.split(","):
                try:
                    p_idx = int(p.strip()) - 1
                    if 0 <= p_idx < len(doc):
                        target_pages.append(p_idx)
                except ValueError:
                    pass
                    
        if not target_pages:
            doc.close()
            return False, "No valid pages selected for rotation."
            
        for i in target_pages:
            page = doc[i]
            page.set_rotation((page.rotation + degrees) % 360)
            
        import io
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Rotate failed: {str(e)}"


def crop_pdf(pdf_bytes: bytes, margin_pt: float) -> tuple[bool, bytes | str]:
    '''Crops a margin from all sides of the PDF.'''
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        for i in range(len(doc)):
            page = doc[i]
            rect = page.rect
            new_rect = fitz.Rect(
                rect.x0 + margin_pt,
                rect.y0 + margin_pt,
                rect.x1 - margin_pt,
                rect.y1 - margin_pt
            )
            if new_rect.is_valid and not new_rect.is_empty:
                page.set_cropbox(new_rect)
                
        import io
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Crop failed: {str(e)}"


def organize_pdf(pdf_bytes: bytes, page_order: list[int]) -> tuple[bool, bytes | str]:
    '''Reorders pages according to page_order (1-indexed list).'''
    try:
        import fitz
    except ImportError:
        return False, "Missing dependency: pymupdf"
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        
        # 0-indexed and bounds checking
        valid_indices = [p - 1 for p in page_order if 0 <= p - 1 < len(doc)]
        
        if not valid_indices:
            doc.close()
            return False, "No valid pages to organize."
            
        doc.select(valid_indices)
        
        import io
        output_stream = io.BytesIO()
        doc.save(output_stream)
        doc.close()
        
        return True, output_stream.getvalue()
    except Exception as e:
        return False, f"Organize failed: {str(e)}"

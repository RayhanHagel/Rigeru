import io

def extract_text(file_bytes: bytes, filename: str) -> tuple[bool, str]:
    ext = filename.lower().split('.')[-1]
    try:
        if ext == 'txt':
            return True, file_bytes.decode('utf-8', errors='ignore')
        elif ext == 'pdf':
            try:
                import fitz  # Lazy Load PyMuPDF
            except ImportError:
                return False, "PyMuPDF not installed. Please install `pymupdf` to read PDFs."
            
            text = ""
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page in doc:
                text += page.get_text() + "\n"
            return True, text
        elif ext == 'docx':
            try:
                import docx  # Lazy Load python-docx
            except ImportError:
                return False, "python-docx not installed. Please install `python-docx` to read Word files."
            
            doc_file = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join([para.text for para in doc_file.paragraphs])
            return True, text
        else:
            return False, f"Unsupported file type: {ext}"
    except Exception as e:
        return False, f"Failed to extract text: {str(e)}"

def generate_diff_html(text1: str, text2: str) -> str:
    import difflib  # Lazy Load difflib
    
    differ = difflib.HtmlDiff(wrapcolumn=60)
    lines1 = text1.splitlines()
    lines2 = text2.splitlines()
    
    html = differ.make_file(
        lines1, 
        lines2, 
        fromdesc="Original Document", 
        todesc="Modified Document",
        context=False 
    )
    
    custom_css = """
    <style>
        body { 
            font-family: var(--font-stack, monospace); 
            font-size: 14px; 
            color: var(--text-color); 
            background-color: transparent; 
            padding: 10px; 
        }
        table.diff { width: 100%; border-collapse: collapse; }
        td.diff_header { 
            background-color: #e9ecef; 
            text-align: right; 
            padding-right: 5px; 
            width: 1%; 
            border-right: 1px solid #ced4da;
            color: #495057;
            font-weight: bold;
        }
        td.diff_next { display: none; }
        td { padding: 4px 8px; vertical-align: top;}
        
        .diff_add { background-color: #d4edda !important; color: #155724 !important; font-weight: 500; }
        .diff_chg { background-color: #fff3cd !important; color: #856404 !important; font-weight: 500; }
        .diff_sub { background-color: #f8d7da !important; color: #721c24 !important; font-weight: 500; text-decoration: line-through; }
    </style>
    """
    return html.replace("<style type=\"text/css\">", custom_css + "<style type=\"text/css\">")
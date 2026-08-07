import fitz  # PyMuPDF
import difflib

def compare_pdfs(file1_bytes: bytes, file2_bytes: bytes) -> tuple[bool, list | str]:
    """
    Compares two PDFs by extracting their text and generating a line-by-line diff.
    Returns a list of dictionaries with 'type' and 'text'.
    """
    try:
        doc1 = fitz.open(stream=file1_bytes, filetype="pdf")
        doc2 = fitz.open(stream=file2_bytes, filetype="pdf")
        
        text1 = []
        for page in doc1:
            text1.append(page.get_text())
        text1_lines = "\n".join(text1).splitlines()
        
        text2 = []
        for page in doc2:
            text2.append(page.get_text())
        text2_lines = "\n".join(text2).splitlines()
        
        diff = difflib.ndiff(text1_lines, text2_lines)
        
        result = []
        for line in diff:
            if line.startswith('? '):
                continue
            
            line_type = "unchanged"
            if line.startswith('+ '):
                line_type = "added"
            elif line.startswith('- '):
                line_type = "removed"
                
            text = line[2:] if len(line) >= 2 else line
            result.append({"type": line_type, "text": text})
            
        return True, result
    except Exception as e:
        return False, str(e)
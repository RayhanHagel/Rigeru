from typing import Any, Dict, List, Optional, Tuple
import difflib
import io
import os
import fitz  # PyMuPDF
import docx

def extract_document_text(file_bytes: bytes, filename: str) -> tuple[bool, str]:
    """
    Extract readable text from PDF, DOCX, TXT, MD, and CSV byte payloads.

    Args:
        file_bytes (bytes): Binary payload of document.
        filename (str): Name of document with extension.

    Returns:
        tuple[bool, str]: (Success flag, extracted textual content or error message).
    """
    ext = os.path.splitext(filename)[1].lower()
    try:
        if ext in ['.txt', '.md', '.csv', '.json', '.html', '.xml']:
            return True, file_bytes.decode('utf-8', errors='ignore')
        elif ext == '.pdf':
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            pages_text = [page.get_text() for page in doc]
            return True, "\n".join(pages_text)
        elif ext == '.docx':
            doc_file = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join(para.text for para in doc_file.paragraphs)
            return True, text
        else:
            return False, f"Unsupported file type: '{ext}'. Supported: .pdf, .docx, .txt, .md, .csv"
    except Exception as e:
        return False, f"Failed to extract document text: {str(e)}"

def compare_documents(
    text1: str,
    text2: str,
    title1: str = "Original Document",
    title2: str = "Modified Document"
) -> tuple[bool, Dict[str, Any]]:
    """
    Perform line-by-line and structured diff comparison between two texts or documents.

    Args:
        text1 (str): Baseline/Original text content.
        text2 (str): Modified/Comparison text content.
        title1 (str, optional): Title for first document. Defaults to "Original Document".
        title2 (str, optional): Title for second document. Defaults to "Modified Document".

    Returns:
        tuple[bool, Dict[str, Any]]: Success flag and comparison statistics and line diffs.
    """
    try:
        lines1 = text1.splitlines()
        lines2 = text2.splitlines()

        diff = difflib.ndiff(lines1, lines2)
        line_diffs = []
        added_count = 0
        removed_count = 0
        unchanged_count = 0

        for line in diff:
            if line.startswith('? '):
                continue
            line_type = "unchanged"
            if line.startswith('+ '):
                line_type = "added"
                added_count += 1
            elif line.startswith('- '):
                line_type = "removed"
                removed_count += 1
            else:
                unchanged_count += 1

            text = line[2:] if len(line) >= 2 else line
            line_diffs.append({"type": line_type, "text": text})

        differ = difflib.HtmlDiff(wrapcolumn=80)
        table_html = differ.make_table(
            lines1,
            lines2,
            fromdesc=title1,
            todesc=title2,
            context=False
        )

        return True, {
            "stats": {
                "added": added_count,
                "removed": removed_count,
                "unchanged": unchanged_count,
                "total_lines_doc1": len(lines1),
                "total_lines_doc2": len(lines2),
            },
            "line_diffs": line_diffs,
            "table_html": table_html
        }
    except Exception as e:
        return False, {"error": str(e)}

# Re-export compare_pdfs for backward compatibility
def compare_pdfs(file1_bytes: bytes, file2_bytes: bytes) -> tuple[bool, list | str]:
    """Legacy helper for PDF comparison."""
    doc1 = fitz.open(stream=file1_bytes, filetype="pdf")
    doc2 = fitz.open(stream=file2_bytes, filetype="pdf")
    text1 = "\n".join(page.get_text() for page in doc1)
    text2 = "\n".join(page.get_text() for page in doc2)
    success, result = compare_documents(text1, text2)
    if success:
        return True, result["line_diffs"]
    return False, result.get("error", "Failed to compare PDFs")

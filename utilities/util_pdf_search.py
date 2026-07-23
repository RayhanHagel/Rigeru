import os
import fitz  # PyMuPDF
import docx
from whoosh.index import create_in, open_dir, exists_in
from whoosh.fields import Schema, TEXT, ID
from whoosh.qparser import QueryParser
from whoosh.highlight import Formatter

class MarkdownFormatter(Formatter):
    def format_token(self, text, token, replace=False):
        return f"**:violet[{text[token.startchar:token.endchar]}]**"

def extract_text(file_path: str) -> str:
    """Safely extracts raw text from PDF, DOCX, or TXT files."""
    ext = os.path.splitext(file_path)[1].lower()
    
    def yield_pdf_pages(document):
        for page in document:
            yield page.get_text()
            
    try:
        if ext == '.pdf':
            with fitz.open(file_path) as doc:
                # Streams text directly to the join method
                return "\n".join(yield_pdf_pages(doc)).strip()
        elif ext == '.docx':
            doc = docx.Document(file_path)
            # OPTIMIZED: Used generator expression
            return "\n".join(para.text for para in doc.paragraphs).strip() 
        elif ext in ['.txt', '.md', '.csv']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read().strip()
    except Exception:
        pass 
        
    return ""

def _scan_files(path: str):
    """Recursive generator yielding DirEntry objects to prevent double stat() system calls."""
    try:
        with os.scandir(path) as it:
            for entry in it:
                if entry.is_dir(follow_symlinks=False):
                    yield from _scan_files(entry.path)
                else:
                    yield entry
    except PermissionError:
        pass

def build_index(target_dir: str, index_dir: str = "./cache/doc_index") -> tuple[int, int]:
    """Crawls the target directory and builds/updates a Whoosh text index."""
    os.makedirs(index_dir, exist_ok=True)
    schema = Schema(path=ID(stored=True, unique=True), mtime=ID(stored=True), title=TEXT(stored=True), content=TEXT(stored=True))
    
    ix = create_in(index_dir, schema) if not exists_in(index_dir) else open_dir(index_dir)
    writer = ix.writer()
    valid_exts = {'.pdf', '.docx', '.txt', '.md', '.csv'}
    files_indexed, files_skipped = 0, 0
    
    with ix.searcher() as searcher:
        for entry in _scan_files(target_dir):
            ext = os.path.splitext(entry.name)[1].lower()
            if ext in valid_exts:
                try:
                    # Native dirent stat bypasses secondary disk I/O requests
                    current_mtime = str(entry.stat().st_mtime)
                except Exception:
                    continue 
                
                document = searcher.document(path=entry.path)
                if document and document.get("mtime") == current_mtime:
                    files_skipped += 1
                    continue 
                
                content = extract_text(entry.path)
                if content:
                    writer.update_document(path=entry.path, mtime=current_mtime, title=entry.name, content=content)
                    files_indexed += 1
                    
                    # Prevent RAM blowouts by forcing batch commits
                    if files_indexed > 0 and files_indexed % 500 == 0:
                        writer.commit()
                        writer = ix.writer()
                        
    writer.commit()
    return files_indexed, files_skipped

def search_documents(query_str: str, index_dir: str = "./cache/doc_index") -> tuple[bool, str, list]:
    """Searches the index for the query and returns results with highlighted snippets."""
    if not exists_in(index_dir):
        return False, "Index not found. Please build the index first.", []
        
    ix = open_dir(index_dir)
    results_list = []
    
    try:
        with ix.searcher() as searcher:
            query = QueryParser("content", ix.schema).parse(query_str)
            results = searcher.search(query, limit=20) 
            results.fragmenter.maxchars = 300
            results.formatter = MarkdownFormatter()
            
            for hit in results:
                results_list.append({
                    "title": hit["title"],
                    "path": hit["path"],
                    "snippet": hit.highlights("content")
                })
        return True, f"Found {len(results_list)} results.", results_list
    except Exception as e:
        return False, f"Search error: {str(e)}", []

def delete_index(index_dir: str = "./cache/doc_index") -> bool:
    """Deletes the entire search index directory."""
    import shutil
    if os.path.exists(index_dir):
        shutil.rmtree(index_dir)
        return True
    return False

def delete_document(file_path: str, index_dir: str = "./cache/doc_index") -> bool:
    """Deletes a specific document from the search index."""
    if not exists_in(index_dir):
        return False
    try:
        ix = open_dir(index_dir)
        writer = ix.writer()
        writer.delete_by_term('path', file_path)
        writer.commit()
        return True
    except Exception as e:
        print(f"Failed to delete document from index: {e}")
        return False

def get_index_info(index_dir: str = "./cache/doc_index") -> dict:
    """Returns info about the current index: document count and indexed paths."""
    if not exists_in(index_dir):
        return {"exists": False, "doc_count": 0, "files": []}
    
    ix = open_dir(index_dir)
    files = set()
    doc_count = 0
    
    with ix.searcher() as searcher:
        for doc in searcher.all_stored_fields():
            doc_count += 1
            path = doc.get("path", "")
            if path:
                files.add(path)
    
    return {
        "exists": True,
        "doc_count": doc_count,
        "files": sorted(list(files))
    }
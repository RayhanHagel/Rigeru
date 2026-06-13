import os
import fitz  # PyMuPDF
import docx
from whoosh.index import create_in, open_dir, exists_in
from whoosh.fields import Schema, TEXT, ID
from whoosh.qparser import QueryParser
from whoosh.highlight import Formatter

# Custom highlighter for Streamlit markdown
class MarkdownFormatter(Formatter):
    def format_token(self, text, token, replace=False):
        # Wrap matched terms in bold violet markdown
        return f"**:violet[{text[token.startchar:token.endchar]}]**"

def extract_text(file_path: str) -> str:
    """Safely extracts raw text from PDF, DOCX, or TXT files."""
    ext = os.path.splitext(file_path)[1].lower()
    text = ""
    
    try:
        if ext == '.pdf':
            with fitz.open(file_path) as doc:
                for page in doc:
                    text += page.get_text() + "\n"
        elif ext == '.docx':
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
        elif ext in ['.txt', '.md', '.csv']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text = f.read()
    except Exception:
        pass # Silently skip corrupted or unreadable files so the indexer doesn't crash
    
    return text.strip()

def build_index(target_dir: str, index_dir: str = "./cache/doc_index") -> tuple[int, int]:
    """Crawls the target directory and builds/updates a Whoosh text index."""
    os.makedirs(index_dir, exist_ok=True)
        
    schema = Schema(path=ID(stored=True, unique=True), mtime=ID(stored=True), title=TEXT(stored=True), content=TEXT(stored=True))
    
    if not exists_in(index_dir):
        ix = create_in(index_dir, schema)
    else:
        ix = open_dir(index_dir)
        
    writer = ix.writer()
    
    valid_exts = {'.pdf', '.docx', '.txt', '.md', '.csv'}
    files_indexed = 0
    files_skipped = 0
    
    # Use context manager for the searcher to ensure it closes properly
    with ix.searcher() as searcher:
        for root, _, files in os.walk(target_dir):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in valid_exts:
                    file_path = os.path.join(root, file)
                    
                    try:
                        current_mtime = str(os.path.getmtime(file_path))
                    except Exception:
                        continue # File might have been deleted mid-scan
                    
                    # If the file is in the index AND hasn't been modified, skip it
                    document = searcher.document(path=file_path)
                    if document and document.get("mtime") == current_mtime:
                        files_skipped += 1
                        continue 
                    
                    content = extract_text(file_path)
                    if content:
                        writer.update_document(
                            path=file_path,
                            mtime=current_mtime,
                            title=file,
                            content=content
                        )
                        files_indexed += 1
                        
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
            results = searcher.search(query, limit=20) # Top 20 results
            
            # Apply our custom Markdown formatter to the highlights
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
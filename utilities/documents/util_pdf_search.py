from typing import Any, Dict, List, Optional, Tuple
import os
import fitz  # PyMuPDF
import docx
from whoosh.index import create_in, open_dir, exists_in
from whoosh.fields import Schema, TEXT, ID
from whoosh.qparser import QueryParser
from whoosh.highlight import Formatter

class MarkdownFormatter(Formatter):
    def format_token(self, text: str, token: Any, replace: bool = False) -> str:
        """
        Format matched query token into Markdown bold highlight syntax.

        Args:
            text (str): Surrounding token text.
            token (Any): Match token with startchar and endchar offsets.
            replace (bool, optional): Replace flag. Defaults to False.

        Returns:
            str: Highlighted Markdown token string.
        """
        return f"**:violet[{text[token.startchar:token.endchar]}]**"

def extract_text(file_path: str) -> str:
    """

            Extract raw text content from PDF, DOCX, TXT, or MD documents.

            Args:
                file_path (str): Target document filepath.

            Returns:
                str: Extracted textual content.
            
    """
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

def _scan_files(path: str) -> Any:
    """

            Recursive generator yielding filesystem directory entries without redundant stat calls.

            Args:
                path (str): Root directory path.

            Yields:
                os.DirEntry: Directory entry instances.

            Returns:
                Any: Entry generator.
            
    """
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
    """

            Traverse target directory and populate full-text Whoosh inverted search index.

            Args:
                target_dir (str): Root folder containing documents to index.
                index_dir (str, optional): Target index storage directory. Defaults to "./cache/doc_index".

            Returns:
                tuple[int, int]: Count of newly indexed files and count of skipped unchanged files.
            
    """
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

def search_documents(query_str: str, index_dir: str = "./cache/doc_index") -> tuple[bool, str, list[dict[str, Any]]]:
    """

            Execute ranked BM25 search across Whoosh index returning matched snippets.

            Args:
                query_str (str): User keyword query.
                index_dir (str, optional): Whoosh index location. Defaults to "./cache/doc_index".

            Returns:
                tuple[bool, str, list[dict[str, Any]]]: Success flag, summary message, and list of result records.
            
    """
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
    """

            Remove the entire search index directory from disk.

            Args:
                index_dir (str, optional): Path to index folder. Defaults to "./cache/doc_index".

            Returns:
                bool: True if removed successfully, False otherwise.
            
    """
    import shutil
    if os.path.exists(index_dir):
        shutil.rmtree(index_dir)
        return True
    return False

def delete_document(file_path: str, index_dir: str = "./cache/doc_index") -> bool:
    """

            Remove a specific document entry from the Whoosh index by its path term.

            Args:
                file_path (str): Indexed document filepath.
                index_dir (str, optional): Index directory path. Defaults to "./cache/doc_index".

            Returns:
                bool: True if document deleted from index, False otherwise.
            
    """
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
    """

            Query document count and indexed file inventory from the Whoosh index.

            Args:
                index_dir (str, optional): Search index folder. Defaults to "./cache/doc_index".

            Returns:
                dict[str, Any]: Dictionary containing 'exists', 'doc_count', and 'files' list.
            
    """
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

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import tempfile
import uuid
import shutil

OBSIDIAN_CACHE_DIR = os.path.join(".", "cache", "obsidian")

router = APIRouter(
    prefix="/api/files-documents",
    tags=["Files & Documents"]
)

# --- Chart Maker ---
@router.post("/chart/parse")
async def parse_chart_data_endpoint(file_hash: str = Form(...)) -> Dict[str, Any]:
    """
    Extract and structure tabular dataset from an uploaded CSV, Excel, or JSON file for charting.

    Args:
        file_hash (str: Hash key of the tabular file in uploads cache.)

    Returns:
        Dict[str, Any]: Parsed columns, series data, and recommended chart specifications.
    """
    from utilities.documents.util_charts import parse_chart_data
    """
    Parses an uploaded CSV/Excel file (by hash) and returns structured JSON for charts.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    try:
        with open(tmp_path, "rb") as f:
            contents = f.read()
        # Find original filename (from uploads metadata if possible, else assume csv)
        # In this simple implementation, we'll try parsing as CSV first, then Excel.
        data = parse_chart_data(contents, "data.csv")
        return {"data": data}
    except Exception as e:
        # Fallback for Excel if CSV fails
        try:
            data = parse_chart_data(contents, "data.xlsx")
            return {"data": data}
        except Exception as e2:
            raise HTTPException(status_code=400, detail=f"Failed to parse file: {e2}")


@router.get("/obsidian/vaults")
def list_obsidian_vaults() -> Dict[str, List[str]]:
    """
    List all local Obsidian vaults and knowledge repositories configured in the system.

    Returns:
        Dict[str, List[str]]: Array of discovered vault folder names.
    """
    vaults = []
    if not os.path.exists(OBSIDIAN_CACHE_DIR):
        return vaults
    
    for vault_name in os.listdir(OBSIDIAN_CACHE_DIR):
        if vault_name == "settings.json": continue
        vault_path = os.path.join(OBSIDIAN_CACHE_DIR, vault_name)
        if os.path.isdir(vault_path):
            file_count = len([f for f in os.listdir(vault_path) if f.endswith(".md")])
            created_at = os.path.getctime(vault_path)
            
            root_topics = []
            meta_path = os.path.join(vault_path, "vault_meta.json")
            if os.path.exists(meta_path):
                try:
                    import json
                    with open(meta_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        root_topics = meta.get("root_topics", [])
                except Exception:
                    pass
                    
            vaults.append({"name": vault_name, "file_count": file_count, "created_at": created_at, "root_topics": root_topics})
    
    return vaults

@router.delete("/obsidian/vaults/{vault_name}")
def delete_obsidian_vault(vault_name: str) -> Dict[str, str]:
    """
    Delete an entire Obsidian vault folder and all indexed topics.

    Args:
        vault_name (str: Vault directory name.)

    Returns:
        Dict[str, str]: Confirmation status message.
    """
    import string
    # basic sanitization
    safe_name = "".join(c for c in vault_name if c.isalnum() or c in (" ", "-", "_"))
    vault_path = os.path.join(OBSIDIAN_CACHE_DIR, safe_name)
    
    if os.path.exists(vault_path) and os.path.isdir(vault_path):
        try:
            shutil.rmtree(vault_path)
            return {"status": "success"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    raise HTTPException(status_code=404, detail="Vault not found")

@router.delete("/obsidian/vaults/{vault_name}/topics/{topic}")
def delete_obsidian_topic(vault_name: str, topic: str) -> Dict[str, str]:
    """
    Delete a specific topic folder and markdown notes within an Obsidian vault.

    Args:
        vault_name (str: Vault name.)
        topic (str: Topic directory name.)

    Returns:
        Dict[str, str]: Confirmation status message.
    """
    import json
    safe_name = "".join(c for c in vault_name if c.isalnum() or c in (" ", "-", "_"))
    vault_path = os.path.join(OBSIDIAN_CACHE_DIR, safe_name)
    
    if not os.path.exists(vault_path) or not os.path.isdir(vault_path):
        raise HTTPException(status_code=404, detail="Vault not found")
        
    meta_path = os.path.join(vault_path, "vault_meta.json")
    if os.path.exists(meta_path):
        try:
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
            
            if topic in meta.get("root_topics", []):
                meta["root_topics"].remove(topic)
                with open(meta_path, "w", encoding="utf-8") as f:
                    json.dump(meta, f, indent=4)
        except Exception as e:
            pass
            
    # Attempt to delete the .md file itself
    from utilities.documents.util_obsidian_agent import sanitize_filename
    safe_topic = sanitize_filename(topic)
    md_path = os.path.join(vault_path, f"{safe_topic}.md")
    if os.path.exists(md_path):
        try:
            os.remove(md_path)
        except Exception:
            pass
            
    return {"status": "success"}

@router.get("/obsidian/vaults/{vault_name}/node/{node_id}")
def get_vault_node_content(vault_name: str, node_id: str) -> Dict[str, str]:
    """
    Fetch the raw markdown text of a specific document node in an Obsidian vault.

    Args:
        vault_name (str: Target vault name.)
        node_id (str: Document path or identifier.)

    Returns:
        Dict[str, str]: Markdown content payload ({"content": str}).
    """
    safe_name = "".join(c for c in vault_name if c.isalnum() or c in (" ", "-", "_"))
    vault_path = os.path.join(OBSIDIAN_CACHE_DIR, safe_name)
    if not os.path.exists(vault_path):
        raise HTTPException(status_code=404, detail="Vault not found")
        
    safe_node = "".join(c for c in node_id if c.isalnum() or c in (" ", "-", "_"))
    file_path = os.path.join(vault_path, f"{safe_node}.md")
    
    if not os.path.exists(file_path):
        return {"content": f"# {node_id}\n\n*This node has not been generated yet.*"}
        
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {e}")

@router.get("/obsidian/vaults/{vault_name}/graph")
def get_vault_graph(vault_name: str) -> Dict[str, Any]:
    """
    Generate directed graph data (nodes and edges) for interactive visual graph rendering.

    Args:
        vault_name (str: Target vault name.)

    Returns:
        Dict[str, Any]: Nodes, links, and connection weights for the vault knowledge graph.
    """
    import glob
    import re
    
    safe_name = "".join(c for c in vault_name if c.isalnum() or c in (" ", "-", "_"))
    vault_path = os.path.join(OBSIDIAN_CACHE_DIR, safe_name)
    if not os.path.exists(vault_path):
        raise HTTPException(status_code=404, detail="Vault not found")
        
    nodes = []
    links = []
    node_ids = {}
    
    file_paths = glob.glob(os.path.join(vault_path, "*.md"))
    for fp in file_paths:
        basename = os.path.basename(fp)[:-3] # remove .md
        nodes.append({"id": basename, "group": 1})
        node_ids[basename.lower()] = basename
        
    for fp in file_paths:
        basename = os.path.basename(fp)[:-3]
        try:
            with open(fp, "r", encoding="utf-8") as f:
                content = f.read()
                
            extracted_links = re.findall(r'\[\[(.*?)\]\]', content)
            for raw_link in extracted_links:
                link_clean = re.sub(r'[\\/*?:"<>|]', "", raw_link).strip()
                if not link_clean: 
                    continue
                    
                target = node_ids.get(link_clean.lower(), link_clean)
                
                if target.lower() not in node_ids:
                    nodes.append({"id": target, "group": 2}) # Group 2 for dangling nodes
                    node_ids[target.lower()] = target
                    
                # avoid duplicates
                if not any(l["source"] == basename and l["target"] == target for l in links):
                    links.append({"source": basename, "target": target})
        except Exception as e:
            print(f"Error parsing {fp}: {e}")
            
    # Calculate BFS depth to assign 'group' (which we'll use for color)
    if nodes:
        root_node_id = None
        for n in nodes:
            if n["id"].lower() == safe_name.lower():
                root_node_id = n["id"]
                break
                
        if not root_node_id:
            # Fallback: find node with 0 in-degree
            in_degrees = {n["id"]: 0 for n in nodes}
            for l in links:
                if l["target"] in in_degrees:
                    in_degrees[l["target"]] += 1
            zeros = [nid for nid, deg in in_degrees.items() if deg == 0]
            if zeros:
                root_node_id = zeros[0]
            else:
                root_node_id = nodes[0]["id"]
                
        # BFS traversal
        adj_list = {n["id"]: [] for n in nodes}
        for l in links:
            if l["source"] in adj_list:
                adj_list[l["source"]].append(l["target"])
                
        depths = {}
        queue = [(root_node_id, 0)]
        
        while queue:
            curr, depth = queue.pop(0)
            if curr not in depths:
                depths[curr] = depth
                for neighbor in adj_list.get(curr, []):
                    if neighbor not in depths:
                        queue.append((neighbor, depth + 1))
                        
        for n in nodes:
            n["group"] = depths.get(n["id"], 5) # Default to 5 for disconnected/distant nodes

    return {"nodes": nodes, "links": links, "completed_count": len(file_paths)}

@router.get("/obsidian/stream")
async def obsidian_stream(topic: str, vault: str, max_pages: int = 10, max_depth: int = 2) -> StreamingResponse:
    """
    Execute research crawler and stream real-time markdown note generation via SSE.

    Args:
        topic (str: Research topic.)
        vault (str: Destination vault name.)
        max_pages (int, optional: Page crawl limit. Defaults to 5.)
        max_depth (int, optional: Link crawl depth. Defaults to 1.)

    Returns:
        StreamingResponse: Text/event-stream of research synthesis progress.
    """
    from utilities.documents.util_obsidian_agent import stream_obsidian_build
    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(
        stream_obsidian_build(topic, vault, max_pages, max_depth), 
        media_type="text/event-stream",
        headers=headers
    )

class ObsidianSettings(BaseModel):
    textFadeThreshold: float = 1.5
    nodeSize: float = 5.0
    linkThickness: float = 1.5
    centerForce: float = 0.05
    repelForce: float = 300.0
    linkForce: float = 1.0
    linkDistance: float = 50.0
    displayDepth: int = 5

@router.get("/obsidian/settings")
def get_obsidian_settings() -> Dict[str, Any]:
    """
    Retrieve active configuration parameters for Obsidian AI research agent.

    Returns:
        Dict[str, Any]: Vault path and LLM settings.
    """
    import json
    settings_path = os.path.join(OBSIDIAN_CACHE_DIR, "settings.json")
    if os.path.exists(settings_path):
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return ObsidianSettings().dict()

@router.post("/obsidian/settings")
def save_obsidian_settings(settings: ObsidianSettings) -> Dict[str, str]:
    """
    Persist configuration parameters for the Obsidian research agent.

    Args:
        settings (Dict[str, Any]: Updated agent configuration.)

    Returns:
        Dict[str, str]: Confirmation status message.
    """
    import json
    os.makedirs(OBSIDIAN_CACHE_DIR, exist_ok=True)
    settings_path = os.path.join(OBSIDIAN_CACHE_DIR, "settings.json")
    try:
        with open(settings_path, "w", encoding="utf-8") as f:
            json.dump(settings.dict(), f, indent=4)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract-text")
async def extract_text(file_hash: str = Form(...)) -> Dict[str, Any]:
    """
    Extract raw and structured text from an uploaded document (PDF, DOCX, TXT).

    Args:
        file_hash (str: Document file hash in uploads cache.)

    Returns:
        Dict[str, Any]: Extracted text content and document statistics.
    """
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file selected")
        
    ext = os.path.splitext(file_hash)[1].lower()
    
    if ext == ".txt":
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            content = f.read()
        return {"text": content.decode('utf-8', errors='ignore')}
        
    # For pdf and docx, save to temp file first
    temp_dir = os.path.join(".", "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}{ext}")
    
    try:
        pass # File already in cache
        temp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(temp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
            
        text = ""
        
        if ext == ".pdf":
            import fitz
            doc = fitz.open(temp_path)
            for page in doc:
                text += page.get_text() + "\n\n"
            doc.close()
            
        elif ext == ".docx":
            import docx
            doc = docx.Document(temp_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
                
        elif ext == ".epub":
            import zipfile
            from xml.etree import ElementTree as ET
            import re
            
            with zipfile.ZipFile(temp_path, 'r') as epub:
                html_files = [f for f in epub.namelist() if f.endswith(('.html', '.xhtml', '.htm'))]
                for html_file in html_files:
                    try:
                        content = epub.read(html_file).decode('utf-8', errors='ignore')
                        clean_text = re.sub(r'<[^>]+>', ' ', content)
                        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
                        if clean_text:
                            text += clean_text + "\n\n"
                    except Exception as e:
                        pass
                        
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, DOCX, TXT, or EPUB.")
            
        return {"text": text.strip()}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except:
            pass

class ExperienceData(BaseModel):
    title: str = ""
    company: str = ""
    dates: str = ""
    description: str = ""

class EducationData(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""

class CVRequest(BaseModel):
    name: str
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    summary: str = ""
    experience: List[ExperienceData] = []
    education: List[EducationData] = []
    skills: str = ""
    template: str = "Classic"

@router.post("/cv-builder/generate")
def generate_cv(req: CVRequest) -> Response:
    """
    Compile curriculum vitae data into a professional styled PDF or DOCX resume document.

    Args:
        req (Dict[str, Any]: Structured CV fields (experience, education, skills, template).)

    Returns:
        Response: Binary document stream with download headers.
    """
    data = req.dict()
    template = data.pop("template")
    
    from utilities.documents.util_cv_builder import generate_cv_pdf
    success, result = generate_cv_pdf(data, template)
    
    if not success:
        raise HTTPException(status_code=500, detail=str(result))
        
    import urllib.parse
    encoded_filename = urllib.parse.quote(f"{req.name.replace(' ', '_')}_Resume.pdf")
    return Response(
        content=result, 
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename*=utf-8''{encoded_filename}"}
    )

from fastapi import UploadFile, File, Form
from utilities.documents.util_pdf_compress import compress_pdf
from utilities.documents.util_pdf_redact import redact_pdf_text

@router.post("/pdf-studio/compress")
async def compress_pdf_endpoint(file_hash: str = Form(...)) -> Response:
    """
    Compress a PDF document by optimizing images, fonts, and object streams.

    Args:
        file_hash (str: PDF hash key in uploads cache.)

    Returns:
        Response: Compressed binary PDF file stream.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, compressed_bytes, orig_size, new_size, percent, msg = compress_pdf(contents)
    
    if not success:
        raise HTTPException(status_code=500, detail=msg)
        
    # Return percentage and sizes in headers so frontend can display metrics
    headers = {
        "Content-Disposition": f'attachment; filename="compressed_{file_hash}"',
        "X-Original-Size": str(orig_size),
        "X-New-Size": str(new_size),
        "X-Percent-Saved": str(percent)
    }
    
    return Response(
        content=compressed_bytes,
        media_type="application/pdf",
        headers=headers
    )

@router.post("/pdf-studio/redact")
async def redact_pdf_endpoint(
    file_hash: str = Form(...),
    words: str = Form(...)
) -> Response:
    """
    Permanently black out and redact sensitive keywords or phrases from a PDF.

    Args:
        file_hash (str: PDF hash key in uploads cache.)
        words (str: Comma-separated search words to black out.)

    Returns:
        Response: Redacted binary PDF document.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    words_list = [w.strip() for w in words.split(",") if w.strip()]
    
    success, result, count = redact_pdf_text(contents, words_list)
    
    if not success:
        raise HTTPException(status_code=500, detail=str(result))
        
    headers = {
        "Content-Disposition": f'attachment; filename="redacted_{file_hash}"',
        "X-Redaction-Count": str(count)
    }
    
    return Response(
        content=result,
        media_type="application/pdf",
        headers=headers
    )

from utilities.documents.util_pdf_security import manage_pdf_password, add_pdf_watermark

@router.post("/pdf-studio/security/password")
async def pdf_security_password_endpoint(
    file_hash: str = Form(...),
    password: str = Form(...),
    action: str = Form(...) # "lock" or "unlock"
) -> Response:
    """
    Apply or remove AES encryption password protection on a PDF document.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        password (str: Encryption or decryption password.)
        action (str: Operation type (encrypt or decrypt).)

    Returns:
        Response: Protected or decrypted binary PDF file.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = manage_pdf_password(contents, password, action)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    filename_prefix = "locked_" if action == "lock" else "unlocked_"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename_prefix}{file_hash}"'
    }
    
    return Response(
        content=result,
        media_type="application/pdf",
        headers=headers
    )

@router.post("/pdf-studio/security/watermark")
async def pdf_security_watermark_endpoint(
    file_hash: str = Form(...),
    text: str = Form(...),
    opacity: float = Form(0.3)
) -> Response:
    """
    Stamp a custom text watermark across every page of a PDF document.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        text (str: Watermark message string.)
        opacity (float, optional: Alpha opacity (0.0 - 1.0). Defaults to 0.3.)

    Returns:
        Response: Watermarked binary PDF file.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = add_pdf_watermark(contents, text, opacity)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    headers = {
        "Content-Disposition": f'attachment; filename="watermarked_{file_hash}"'
    }
    
    return Response(
        content=result,
        media_type="application/pdf",
        headers=headers
    )

from utilities.documents.util_pdf_ops import merge_pdfs, split_pdf, remove_specific_pages, remove_blank_pages, resize_pdf_pages

@router.post("/pdf-studio/ops/merge")
async def pdf_ops_merge_endpoint(file_hashes: List[str] = Form(...)) -> Response:
    """
    Concatenate and merge multiple PDF documents into a single sequential PDF.

    Args:
        file_hashes (str: JSON list of PDF file hashes to merge.)

    Returns:
        Response: Merged binary PDF document stream.
    """
    bytes_list = []
    for h in file_hashes:
        tmp_path = os.path.join(".", "uploads", h)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            bytes_list.append(f.read())
        
    success, result = merge_pdfs(bytes_list)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="merged_document.pdf"'}
    )

@router.post("/pdf-studio/ops/split")
async def pdf_ops_split_endpoint(
    file_hash: str = Form(...),
    buckets_json: str = Form(...)
) -> Response:
    """
    Split a PDF document into multiple sub-documents based on page bucket definitions.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        buckets_json (str: JSON string mapping split names to page ranges.)

    Returns:
        Response: Binary ZIP archive containing split PDF parts.
    """
    import json
    try:
        buckets = json.loads(buckets_json)
    except:
        raise HTTPException(status_code=400, detail="Invalid buckets_json")
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    from utilities.documents.util_pdf_ops import split_pdf_buckets
    success, result = split_pdf_buckets(contents, buckets)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="split_{file_hash}.zip"'}
    )

@router.post("/pdf-studio/ops/remove")
async def pdf_ops_remove_endpoint(
    file_hash: str = Form(...),
    pages: str = Form(...)
) -> Response:
    """
    Delete specified page indices from a PDF document.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        pages (str: Comma-separated 1-indexed page numbers to delete.)

    Returns:
        Response: Modified binary PDF stream without deleted pages.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    try:
        pages_list = [int(p.strip()) for p in pages.split(",") if p.strip().isdigit()]
    except:
        raise HTTPException(status_code=400, detail="Invalid pages format.")
        
    success, result = remove_specific_pages(contents, pages_list)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="trimmed_{file_hash}"'}
    )

@router.post("/pdf-studio/ops/clean")
async def pdf_ops_clean_endpoint(file_hash: str = Form(...)) -> Response:
    """
    Scan and strip all blank or empty pages from a PDF document.

    Args:
        file_hash (str: PDF hash in uploads cache.)

    Returns:
        Response: Cleaned binary PDF stream.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result, count = remove_blank_pages(contents)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="cleaned_{file_hash}"',
            "X-Blank-Pages-Removed": str(count)
        }
    )

@router.post("/pdf-studio/ops/resize")
async def pdf_ops_resize_endpoint(
    file_hash: str = Form(...),
    target: str = Form(...)
) -> Response:
    """
    Standardize all pages of a PDF to a standard paper format (A4, Letter, Legal).

    Args:
        file_hash (str: PDF hash in uploads cache.)
        target (str: Target paper standard name (A4, Letter, Legal).)

    Returns:
        Response: Resized binary PDF stream.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = resize_pdf_pages(contents, target)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="resized_{file_hash}"'}
    )

from utilities.documents.util_pdf_metadata import get_pdf_metadata, update_pdf_metadata, check_pdf_authenticity

@router.post("/pdf-studio/metadata/get")
async def pdf_metadata_get_endpoint(file_hash: str = Form(...)) -> Dict[str, Any]:
    """
    Inspect embedded metadata headers (title, author, subject, keywords) of a PDF.

    Args:
        file_hash (str: PDF hash in uploads cache.)

    Returns:
        Dict[str, Any]: Document metadata properties mapping.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, metadata = get_pdf_metadata(contents)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(metadata))
        
    return metadata

@router.post("/pdf-studio/metadata/update")
async def pdf_metadata_update_endpoint(
    file_hash: str = Form(...),
    title: str = Form(""),
    author: str = Form(""),
    subject: str = Form(""),
    keywords: str = Form(""),
    creator: str = Form(""),
    producer: str = Form("")
) -> Response:
    """
    Modify embedded PDF metadata attributes and return updated PDF.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        title (str, optional: Document title.)
        author (str, optional: Author name.)
        subject (str, optional: Subject description.)
        keywords (str, optional: Comma-separated tags.)
        creator (str, optional: Creator application.)
        producer (str, optional: PDF producer software.)

    Returns:
        Response: Binary PDF stream with updated metadata.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    new_metadata = {
        "title": title,
        "author": author,
        "subject": subject,
        "keywords": keywords,
        "creator": creator,
        "producer": producer
    }
    
    success, result = update_pdf_metadata(contents, new_metadata)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="updated_{file_hash}"'}
    )

@router.post("/pdf-studio/metadata/health")
async def pdf_metadata_health_endpoint(file_hash: str = Form(...)) -> Dict[str, Any]:
    """
    Audit a PDF file for corruption, missing fonts, encryption, and structural integrity.

    Args:
        file_hash (str: PDF hash in uploads cache.)

    Returns:
        Dict[str, Any]: Integrity score, page count, security flags, and warnings.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, report = check_pdf_authenticity(contents)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(report))
        
    return report

import zipfile
import io
from utilities.documents.util_pdf_convert import pdf_to_images, images_to_pdf, make_pdf_searchable

@router.post("/pdf-studio/convert/pdf-to-images")
async def pdf_convert_pdf_to_images_endpoint(
    file_hash: str = Form(...),
    dpi: int = Form(150)
) -> Response:
    """
    Rasterize all PDF pages into high-resolution PNG images bundled in a ZIP file.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        dpi (int, optional: Render resolution DPI. Defaults to 200.)

    Returns:
        Response: Binary ZIP archive containing rendered page images.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = pdf_to_images(contents, dpi)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    # Result is a list of tuples: (page_num, image_bytes)
    # We will zip them together to return a single file
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for page_num, img_bytes in result:
            zf.writestr(f"page_{page_num}.png", img_bytes)
            
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="images_{file_hash}.zip"'}
    )

@router.post("/pdf-studio/convert/images-to-pdf")
async def pdf_convert_images_to_pdf_endpoint(file_hashes: List[str] = Form(...)) -> Response:
    """
    Combine multiple uploaded raster images into a single multi-page PDF.

    Args:
        file_hashes (str: JSON list of image hashes in uploads cache.)

    Returns:
        Response: Compiled multi-page binary PDF stream.
    """
    bytes_list = []
    for h in file_hashes:
        tmp_path = os.path.join(".", "uploads", h)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            bytes_list.append(f.read())
        
    success, result = images_to_pdf(bytes_list)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="converted_images.pdf"'}
    )

@router.post("/pdf-studio/convert/ocr")
async def pdf_convert_ocr_endpoint(file_hash: str = Form(...)) -> Response:
    """
    Perform Tesseract Optical Character Recognition on a scanned PDF to create a searchable text layer.

    Args:
        file_hash (str: PDF hash in uploads cache.)

    Returns:
        Response: Searchable binary PDF document.
    """
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = make_pdf_searchable(contents)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="searchable_{file_hash}"'}
    )

class BuildIndexRequest(BaseModel):
    target_dir: str

@router.post("/pdf-studio/search/build")
def pdf_search_build_endpoint(req: BuildIndexRequest) -> Dict[str, Any]:
    """
    Build semantic inverted index across uploaded PDF documents for instant full-text search.

    Args:
        req (Dict[str, Any]: Document identifiers to index.)

    Returns:
        Dict[str, Any]: Status summary and indexed document counts.
    """
    from utilities.documents.util_pdf_search import build_index
    try:
        indexed, skipped = build_index(req.target_dir)
        return {"indexed": indexed, "skipped": skipped, "message": f"Successfully indexed {indexed} files (skipped {skipped})."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pdf-studio/search/query")
def pdf_search_query_endpoint(q: str) -> Dict[str, Any]:
    """
    Query the PDF search index and return ranked snippet matches with page numbers.

    Args:
        q (str: Full-text query string.)

    Returns:
        Dict[str, Any]: Ranked search result list with snippet contexts.
    """
    from utilities.documents.util_pdf_search import search_documents
    success, msg, results = search_documents(q)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "results": results}

@router.get("/pdf-studio/search/info")
def pdf_search_info_endpoint() -> Dict[str, Any]:
    """
    Inspect PDF index status, indexed file counts, and storage metrics.

    Returns:
        Dict[str, Any]: Search index status metadata.
    """
    from utilities.documents.util_pdf_search import get_index_info
    return get_index_info()

@router.delete("/pdf-studio/search/index")
def pdf_search_delete_endpoint() -> Dict[str, str]:
    """
    Completely wipe the PDF search index database.

    Returns:
        Dict[str, str]: Confirmation status message.
    """
    from utilities.documents.util_pdf_search import delete_index
    deleted = delete_index()
    if deleted:
        return {"message": "Index deleted successfully."}
    raise HTTPException(status_code=404, detail="No index found to delete.")

class DeleteDocumentRequest(BaseModel):
    file_path: str

@router.delete("/pdf-studio/search/index/document")
def pdf_search_delete_document_endpoint(req: DeleteDocumentRequest) -> Dict[str, str]:
    """
    Remove a specific document from the PDF search index.

    Args:
        req (Dict[str, Any]: Document identifier payload.)

    Returns:
        Dict[str, str]: Confirmation status message.
    """
    from utilities.documents.util_pdf_search import delete_document
    deleted = delete_document(req.file_path)
    if deleted:
        return {"message": f"Document '{req.file_path}' removed from index."}
    raise HTTPException(status_code=404, detail="Document not found in index.")

from utilities.documents.util_pdf_diff import compare_pdfs

@router.post("/pdf-studio/diff")
async def pdf_diff_endpoint(
    file1_hash: str = Form(...),
    file2_hash: str = Form(...)
) -> Dict[str, Any]:
    """
    Compare visual and textual differences between two versions of a PDF document.

    Args:
        file1_hash (str: Hash of original base PDF.)
        file2_hash (str: Hash of modified comparison PDF.)

    Returns:
        Dict[str, Any]: Text diffs, modified pages, and visual comparison overlays.
    """
    t1 = os.path.join(".", "uploads", file1_hash)
    t2 = os.path.join(".", "uploads", file2_hash)
    if not os.path.exists(t1) or not os.path.exists(t2):
        raise HTTPException(400, "File not found")
    with open(t1, "rb") as f: contents1 = f.read()
    with open(t2, "rb") as f: contents2 = f.read()
    
    success, result = compare_pdfs(contents1, contents2)
    
    if not success:
        raise HTTPException(status_code=500, detail=str(result))
        
    return {"diff": result}

# --- FILE ORGANIZER ---
from fastapi.responses import FileResponse
from utilities.core.util_preview import get_image_preview
from utilities.core.util_os import open_file_in_os
from utilities.file_tools.util_file_mover import get_target_files, perform_move, perform_delete, perform_undo

class ScanRequest(BaseModel):
    source_path: str

class OpenRequest(BaseModel):
    file_path: str

class ActionRequest(BaseModel):
    action: str  # "move", "rename", "delete"
    src_file_path: str
    current_file: str
    dest_dir: str = ""
    rename_val: str = ""

class UndoRequest(BaseModel):
    last_action: dict
    source_path: str
    dest_path: str

@router.post("/file-organizer/scan")
def file_organizer_scan(req: ScanRequest) -> Dict[str, Any]:
    """
    Scan a directory and classify files by file extensions into categorized buckets.

    Args:
        req (Dict[str, Any]: Target directory path.)

    Returns:
        Dict[str, Any]: Classified file mapping and category counts.
    """
    try:
        files = get_target_files(req.source_path)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/file-organizer/preview")
def file_organizer_preview(path: str) -> FileResponse:
    """
    Generate a thumbnail preview for a file during directory organization.

    Args:
        path (str: File path on host system.)

    Returns:
        FileResponse: Thumbnail image stream.
    """
    import os
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
        
    preview_path = get_image_preview(path)
    if preview_path and os.path.exists(preview_path):
        return FileResponse(preview_path)
    raise HTTPException(status_code=404, detail="No preview available")

@router.post("/file-organizer/open")
def file_organizer_open(req: OpenRequest) -> Dict[str, str]:
    """
    Open a file using the operating system default application.

    Args:
        req (Dict[str, Any]: Target file path payload.)

    Returns:
        Dict[str, str]: Status confirmation message.
    """
    open_file_in_os(req.file_path)
    return {"status": "opened"}

@router.post("/file-organizer/action")
def file_organizer_action(req: ActionRequest) -> Dict[str, Any]:
    """
    Execute file organization moves according to categorized directory rules.

    Args:
        req (Dict[str, Any]: Classification rules and plan.)

    Returns:
        Dict[str, Any]: Execution results and undo history token.
    """
    if req.action == "delete":
        success, err = perform_delete(req.src_file_path)
        if not success:
            raise HTTPException(status_code=400, detail=err)
        return {"status": "success", "message": "Deleted"}
        
    elif req.action in ["move", "rename"]:
        success, final_name, action_type, err = perform_move(
            req.src_file_path, 
            req.dest_dir, 
            req.current_file, 
            req.rename_val
        )
        if not success:
            raise HTTPException(status_code=400, detail=err)
        return {
            "status": "success", 
            "final_name": final_name, 
            "action_type": action_type
        }
    
    raise HTTPException(status_code=400, detail="Invalid action")

@router.post("/file-organizer/undo")
def file_organizer_undo(req: UndoRequest) -> Dict[str, Any]:
    """
    Roll back the last file organizer batch move operation.

    Args:
        req (Dict[str, Any]: Undo transaction token.)

    Returns:
        Dict[str, Any]: Restored files confirmation.
    """
    success, msg = perform_undo(req.last_action, req.source_path, req.dest_path)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg}

@router.get("/utils/explore-dir")
def explore_dir(path: str = "", include_files: bool = False) -> Dict[str, Any]:
    """
    List directory contents on host filesystem for folder pickers.

    Args:
        path (str: Directory path to explore.)
        include_files (bool, optional: Include files alongside folders. Defaults to False.)

    Returns:
        Dict[str, Any]: Directory hierarchy entries.
    """
    from utilities.file_tools.util_file_explorer import get_directory_contents
    try:
        return get_directory_contents(path, include_files)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/excel-cleaner/preview")
async def excel_cleaner_preview(
    file_hash: str = Form(...),
    has_header: bool = Form(...)
) -> Dict[str, Any]:
    """
    Preview the first rows of an Excel spreadsheet and detect header rows.

    Args:
        file_hash (str: Spreadsheet hash in uploads cache.)
        has_header (bool, optional: First row contains column names. Defaults to True.)

    Returns:
        Dict[str, Any]: Preview rows and detected column schemas.
    """
    from utilities.documents.util_excel import load_data
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    
    success, result = load_data(contents, file_hash, has_header)
    if not success:
        raise HTTPException(status_code=400, detail=result)
        
    df = result
    from utilities.documents.util_excel import format_dataframe_for_preview
    return format_dataframe_for_preview(df)

@router.post("/excel-cleaner/process")
async def excel_cleaner_process(
    file_hash: str = Form(...),
    has_header: bool = Form(...),
    drop_na: bool = Form(...),
    drop_duplicates: bool = Form(...),
    rules: str = Form("[]"),
    action: str = Form(...), # "preview" or "download"
    export_format: str = Form("CSV") # "CSV" or "Excel"
) -> Response:
    """
    Apply data sanitization rules (drop nulls, remove duplicates, trim whitespace) to a spreadsheet.

    Args:
        file_hash (str: Spreadsheet hash in uploads cache.)
        has_header (bool: First row is header.)
        drop_na (bool: Remove empty rows.)
        drop_duplicates (bool: Remove duplicate records.)
        rules (str: JSON data cleaning rule array.)
        action (str: Action mode (clean, filter).)
        export_format (str, optional: Target format (xlsx, csv). Defaults to xlsx.)

    Returns:
        Response: Cleaned binary spreadsheet file.
    """
    from utilities.documents.util_excel import load_data, process_dataframe, export_data
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    
    # Load
    success, result = load_data(contents, file_hash, has_header)
    if not success:
        raise HTTPException(status_code=400, detail=result)
        
    df = result
    
    # Process rules
    import json
    try:
        parsed_rules = json.loads(rules)
    except Exception:
        parsed_rules = []
        
    proc_success, proc_result = process_dataframe(df, drop_na, drop_duplicates, parsed_rules)
    if not proc_success:
        raise HTTPException(status_code=400, detail=proc_result)
        
    cleaned_df = proc_result
    
    if action == "preview":
        from utilities.documents.util_excel import format_dataframe_for_preview
        return format_dataframe_for_preview(cleaned_df)
    
    elif action == "download":
        try:
            file_bytes = export_data(cleaned_df, export_format)
            if not file_bytes:
                raise HTTPException(status_code=500, detail="Failed to export data")
                
            # Use original filename without extension, add new extension
            base_name = file_hash.rsplit('.', 1)[0]
            ext = ".csv" if export_format == "CSV" else ".xlsx"
            out_name = f"cleaned_{base_name}{ext}"
            
            media_type = "text/csv" if export_format == "CSV" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            
            return Response(
                content=file_bytes,
                media_type=media_type,
                headers={"Content-Disposition": f'attachment; filename="{out_name}"'}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    raise HTTPException(status_code=400, detail="Invalid action")

@router.post("/expense-tracker/extract")
async def expense_tracker_extract(
    file_hash: str = Form(...)
) -> Dict[str, Any]:
    """
    Parse receipt images or bank statement PDFs to extract expense amounts and merchant names.

    Args:
        file_hash (str: Receipt file hash in uploads cache.)

    Returns:
        Dict[str, Any]: Extracted expense entries with date, vendor, and amount.
    """
    from utilities.productivity_lifestyle.util_expense import extract_receipt_data
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    
    success, result = extract_receipt_data(contents)
    if not success:
        raise HTTPException(status_code=500, detail=result)
        
    return result

@router.get("/math-latex/models")
async def get_math_latex_models() -> Dict[str, List[str]]:
    """
    List available LaTeX OCR models for handwritten equation recognition.

    Returns:
        Dict[str, List[str]]: Model architectures list ({"models": [...]}).
    """
    from utilities.documents.util_math_latex import get_model_labels
    return {"models": get_model_labels()}

@router.post("/math-latex/convert")
async def convert_math_latex(
    file_hash: str = Form(...)
) -> Dict[str, Any]:
    """
    Convert an image of a math equation into LaTeX syntax using Pix2Tex OCR.

    Args:
        file_hash (str: Equation image hash in uploads cache.)

    Returns:
        Dict[str, Any]: Generated LaTeX code string ({"latex": str}).
    """
    from utilities.documents.util_math_latex import process_math_image
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = process_math_image(contents)
    if not success:
        raise HTTPException(status_code=500, detail=result)
        
    return {"latex": result}

@router.get("/hash-integrity/snapshots")
async def list_hash_snapshots() -> Dict[str, List[Dict[str, Any]]]:
    """
    List all saved directory hash integrity manifest snapshots.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Snapshot records with file counts and timestamps.
    """
    import os
    import json
    
    hash_dir = os.path.join(".", "cache", "hash")
    if not os.path.exists(hash_dir):
        return {"snapshots": []}
        
    snapshots = []
    for f in os.listdir(hash_dir):
        if f.endswith(".json"):
            fp = os.path.join(hash_dir, f)
            try:
                # Just read the first few lines to extract timestamp and root_dir
                # to avoid loading massive JSONs into memory
                with open(fp, "r", encoding="utf-8") as file:
                    data = json.load(file)
                    snapshots.append({
                        "filename": f,
                        "timestamp": data.get("timestamp", ""),
                        "root_dir": data.get("root_dir", ""),
                        "size_bytes": os.path.getsize(fp)
                    })
            except Exception:
                pass
                
    # Sort newest first
    snapshots.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"snapshots": snapshots}

@router.delete("/hash-integrity/snapshots/{filename}")
async def delete_hash_snapshot(filename: str) -> Dict[str, str]:
    """
    Delete a saved directory hash snapshot manifest from disk.

    Args:
        filename (str: Snapshot filename to delete.)

    Returns:
        Dict[str, str]: Confirmation status message.
    """
    import os
    
    # security check
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
        
    hash_dir = os.path.join(".", "cache", "hash")
    target = os.path.join(hash_dir, filename)
    
    if os.path.exists(target) and os.path.isfile(target) and filename.endswith(".json"):
        try:
            os.remove(target)
            return {"status": "success"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    else:
        raise HTTPException(status_code=404, detail="Snapshot not found")

@router.post("/hash-integrity/snapshot")
async def create_hash_snapshot(target_dir: str = Form(...)) -> Dict[str, str]:
    """
    Compute cryptographic SHA-256 hashes across all files in a folder and save snapshot manifest.

    Args:
        target_dir (str: Directory to hash.)

    Returns:
        Dict[str, str]: Created snapshot filename.
    """
    from utilities.file_tools.util_hash import create_snapshot
    import os
    
    safe_name = "".join(
        c for c in os.path.basename(target_dir) if c.isalpha() or c.isdigit() or c == ' '
    ).rstrip()
    
    hash_dir = os.path.join(".", "cache", "hash")
    os.makedirs(hash_dir, exist_ok=True)
    
    import time
    output_filename = f"snapshot_{safe_name}_{int(time.time())}.json"
    output_file = os.path.join(hash_dir, output_filename)
    
    success, msg = create_snapshot(target_dir, output_file)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
        
    from fastapi.responses import FileResponse
    return FileResponse(
        output_file, 
        media_type='application/json',
        filename=output_filename
    )

@router.post("/hash-integrity/verify")
async def verify_hash_snapshot(target_dir: str = Form(...), file_hash: str = Form(...)) -> Dict[str, Any]:
    """
    Verify filesystem integrity against a baseline snapshot and report modified/deleted files.

    Args:
        target_dir (str: Directory to audit.)
        file_hash (str: Baseline manifest file hash in uploads cache.)

    Returns:
        Dict[str, Any]: Integrity audit report with changed, missing, and new files.
    """
    from utilities.file_tools.util_hash import verify_integrity
    import os
    
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
    
    snapshot_path = os.path.join(UPLOADS_DIR, file_hash)
    if not os.path.exists(snapshot_path):
        raise HTTPException(status_code=400, detail="Snapshot file not found.")
    
    success, results, msg = verify_integrity(target_dir, snapshot_path)
    
    if not success:
        raise HTTPException(status_code=400, detail=msg)
        
    return results

class MegaCleanerRequest(BaseModel):
    folder_links: list[str]
    max_image_size_mb: int
    max_video_size_mb: int
    max_other_size_mb: int

@router.post("/mega-cleaner/process")
async def process_mega(request: MegaCleanerRequest) -> Dict[str, Any]:
    """
    Inspect and download files from a Mega.nz public sharing link.

    Args:
        request (Dict[str, Any]: Mega URL and download parameters.)

    Returns:
        Dict[str, Any]: File metadata or downloaded file path.
    """
    from utilities.web.util_mega import process_mega_link
    
    results = []
    
    for link in request.folder_links:
        link = link.strip()
        if not link: continue
        
        link_result = process_mega_link(link, request.max_image_size_mb, request.max_video_size_mb, request.max_other_size_mb)
        
        if link_result.get("error"):
            results.append({
                "link": link,
                "error": link_result["error"]
            })
        else:
            results.append({
                "link": link,
                "raw": link_result["raw"],
                "named": link_result["named"],
                "logs": link_result["logs"],
                "original_size_bytes": link_result["original_size"],
                "cleaned_size_bytes": link_result["cleaned_size"],
                "error": None
            })
            
    return {"results": results}

@router.get("/llm-chat/config")
def get_llm_chat_config() -> Dict[str, Any]:
    """
    Retrieve active Ollama LLM chat configuration (model, system prompt, temperature).

    Returns:
        Dict[str, Any]: LLM settings configuration.
    """
    from utilities.productivity_lifestyle.util_llm_chat import load_tool_config
    from utilities.core.util_config import load_all_config
    config = load_all_config()
    model = config.get("obsidian_ollama_model", "llama3:8b-instruct-q4_K_M")
    return {"enabled_tools": load_tool_config(), "model": model}

class ToolConfigRequest(BaseModel):
    enabled_tools: List[str]

@router.post("/llm-chat/config")
def update_llm_chat_config(req: ToolConfigRequest) -> Dict[str, str]:
    """
    Update and save Ollama LLM chat parameters.

    Args:
        req (Dict[str, Any]: Updated model and temperature parameters.)

    Returns:
        Dict[str, str]: Status confirmation message.
    """
    from utilities.productivity_lifestyle.util_llm_chat import save_tool_config
    success = save_tool_config(req.enabled_tools)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save configuration")
    return {"status": "success"}

@router.get("/llm-chat/stream")
async def llm_chat_stream(messages: str, token: str = "") -> StreamingResponse:
    """
    Stream real-time token generation from local Ollama LLM via Server-Sent Events.

    Args:
        messages (str: JSON list of chat conversation turns.)
        token (str, optional: Auth token.)

    Returns:
        StreamingResponse: Text/event-stream of streamed tokens.
    """
    from utilities.productivity_lifestyle.util_llm_chat import stream_chat
    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(
        stream_chat(messages, token), 
        media_type="text/event-stream",
        headers=headers
    )

class EverythingSearchRequest(BaseModel):
    query: str
    max_results: int = 100
    extension: Optional[str] = None
    path: Optional[str] = None

from utilities.file_tools.util_everything import check_and_download_es, search_es, start_everything_service

@router.get("/everything/status")
def everything_status() -> Dict[str, Any]:
    """
    Check if the Voidtools Everything search service is running on Windows.

    Returns:
        Dict[str, Any]: Running status ({"running": bool}).
    """
    result = check_and_download_es()
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

@router.post("/everything/start")
def everything_start() -> Dict[str, str]:
    """
    Start the Everything desktop search background indexing daemon.

    Returns:
        Dict[str, str]: Service launch confirmation message.
    """
    result = start_everything_service()
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/everything/search")
def everything_search(req: EverythingSearchRequest) -> Dict[str, List[Dict[str, Any]]]:
    """
    Instantaneous filesystem search across entire Windows hard drives via Everything IPC.

    Args:
        req (Dict[str, Any]: Search query and result limits.)

    Returns:
        Dict[str, List[Dict[str, Any]]]: Matching files and paths ({"results": [...]}).
    """
    result = search_es(req.query, req.extension, req.path, req.max_results)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

# --- WHITEBOARD ---
from utilities.documents.util_whiteboard import export_whiteboard, transcribe_whiteboard

class WhiteboardExportRequest(BaseModel):
    images: List[str]
    format: str
    width: int
    height: int
    # Add these new optional fields so FastAPI doesn't reject the payload
    fps: Optional[int] = 30
    frameDelay: Optional[int] = 33
    step: Optional[int] = 2

class WhiteboardTranscribeRequest(BaseModel):
    image: str

@router.post("/whiteboard/export")
def whiteboard_export_endpoint(req: WhiteboardExportRequest) -> Response:
    """
    Export digital whiteboard vector sketches as PNG or SVG image files.

    Args:
        req (Dict[str, Any]: Whiteboard vector element strokes and export format.)

    Returns:
        Response: Binary PNG or SVG image response.
    """
    # Extract the frameDelay from the request, fallback to 33 (30fps) just in case
    frame_delay = getattr(req, "frameDelay", 33)
    
    # Pass frame_delay into the export function
    success, result = export_whiteboard(req.images, req.format, req.width, req.height, frame_delay)
    
    if not success:
        raise HTTPException(status_code=500, detail=result)
        
    media_type = "application/pdf" if req.format.lower() == "pdf" else "image/gif"
    return Response(
        content=result,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="whiteboard.{req.format.lower()}"'}
    )
@router.post("/whiteboard/transcribe")
async def whiteboard_transcribe_endpoint(req: WhiteboardTranscribeRequest) -> Dict[str, str]:
    """
    Convert handwritten notes or diagrams on a whiteboard into text via vision OCR.

    Args:
        req (Dict[str, Any]: Base64 image snapshot of the whiteboard.)

    Returns:
        Dict[str, str]: Transcribed text content ({"transcript": str}).
    """
    success, result = await transcribe_whiteboard(req.image)
    if not success:
        raise HTTPException(status_code=500, detail=result)
    return {"text": result}
# --- NEW PDF STUDIO ROUTES ---

from utilities.documents.util_pdf_ops import rotate_pages, crop_pdf, organize_pdf

@router.post("/pdf-studio/ops/rotate")
async def pdf_ops_rotate_endpoint(
    file_hash: str = Form(...),
    degrees: int = Form(...),
    pages: str = Form("all")
) -> Response:
    """
    Rotate selected pages of a PDF document by 90, 180, or 270 degrees.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        degrees (int: Rotation angle (90, 180, 270).)
        pages (str, optional: Target pages (e.g. all or 1,3,5). Defaults to all.)

    Returns:
        Response: Rotated binary PDF document stream.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = rotate_pages(contents, degrees, pages)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="rotated_{file_hash}"'}
    )

@router.post("/pdf-studio/ops/crop")
async def pdf_ops_crop_endpoint(
    file_hash: str = Form(...),
    margin: float = Form(...)
) -> Response:
    """
    Crop margins from all pages of a PDF document.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        margin (int: Margin crop depth in points.)

    Returns:
        Response: Cropped binary PDF stream.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = crop_pdf(contents, margin)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="cropped_{file_hash}"'}
    )

@router.post("/pdf-studio/ops/organize")
async def pdf_ops_organize_endpoint(
    file_hash: str = Form(...),
    order: str = Form(...)
) -> Response:
    """
    Reorder and shuffle pages of a PDF document according to custom sequence.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        order (str: Comma-separated page index permutation.)

    Returns:
        Response: Reordered binary PDF stream.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    try:
        pages_list = [int(p.strip()) for p in order.split(",") if p.strip().isdigit()]
    except:
        raise HTTPException(status_code=400, detail="Invalid pages format.")

    success, result = organize_pdf(contents, pages_list)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="organized_{file_hash}"'}
    )

from utilities.documents.util_pdf_images import extract_pdf_images, pdf_to_image

@router.post("/pdf-studio/images/extract")
async def pdf_images_extract_endpoint(
    file_hash: str = Form(...),
    pages: str = Form("all")
) -> Response:
    """
    Extract all embedded raster images from a PDF document into a ZIP archive.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        pages (str, optional: Target pages. Defaults to all.)

    Returns:
        Response: Binary ZIP archive containing extracted image files.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = extract_pdf_images(contents, pages=pages)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="extracted_images.zip"'}
    )

@router.post("/pdf-studio/images/pdf-to-image")
async def pdf_images_pdf_to_image_endpoint(
    file_hash: str = Form(...),
    dpi: int = Form(150),
    pages: str = Form("all"),
    fmt: str = Form("png")
) -> Response:
    """
    Convert PDF pages to image files (JPEG, PNG, WEBP) bundled in a ZIP archive.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        dpi (int, optional: Rasterization DPI. Defaults to 200.)
        pages (str, optional: Target pages. Defaults to all.)
        fmt (str, optional: Image format (png, jpeg, webp). Defaults to png.)

    Returns:
        Response: Binary ZIP archive containing images.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = pdf_to_image(contents, dpi, pages=pages, fmt=fmt)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    ext = "zip" if len(result) > 5000000 or result[:4] == b'PK\x03\x04' else fmt
    return Response(
        content=result,
        media_type="application/zip" if ext == "zip" else f"image/{fmt}",
        headers={"Content-Disposition": f'attachment; filename="converted.{ext}"'}
    )

from utilities.documents.util_pdf_advanced import flatten_pdf, optimize_pdf, repair_pdf

@router.post("/pdf-studio/advanced/flatten")
async def pdf_advanced_flatten_endpoint(file_hash: str = Form(...)) -> Response:
    """
    Flatten interactive form fields and annotations permanently into the PDF background.

    Args:
        file_hash (str: PDF hash in uploads cache.)

    Returns:
        Response: Flattened binary PDF stream.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = flatten_pdf(contents)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="flattened_{file_hash}"'}
    )

@router.post("/pdf-studio/advanced/optimize")
async def pdf_advanced_optimize_endpoint(file_hash: str = Form(...)) -> Response:
    """
    Optimize PDF structure, remove redundant objects, and recompress embedded content.

    Args:
        file_hash (str: PDF hash in uploads cache.)

    Returns:
        Response: Optimized binary PDF stream.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = optimize_pdf(contents)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="optimized_{file_hash}"'}
    )

@router.post("/pdf-studio/advanced/repair")
async def pdf_advanced_repair_endpoint(file_hash: str = Form(...)) -> Response:
    """
    Repair a corrupted, damaged, or unreadable PDF document structure.

    Args:
        file_hash (str: PDF hash in uploads cache.)

    Returns:
        Response: Repaired binary PDF stream.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = repair_pdf(contents)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="repaired_{file_hash}"'}
    )

from utilities.documents.util_pdf_sign import sign_pdf

@router.post("/pdf-studio/sign")
async def pdf_sign_endpoint(
    file_hash: str = Form(...),
    signature: UploadFile = File(...),
    x: str = Form("10"),
    y: str = Form("10"),
    w: str = Form("150"),
    h: str = Form("50")
) -> Response:
    """
    Stamp a digital signature or signature image onto a specific location in a PDF.

    Args:
        file_hash (str: PDF hash in uploads cache.)
        signature (str: Base64 signature image.)
        x (float: Horizontal position offset.)
        y (float: Vertical position offset.)
        w (float: Stamp width.)
        h (float: Stamp height.)

    Returns:
        Response: Signed binary PDF stream.
    """
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()
        
    sig_bytes = await signature.read()

    success, result = sign_pdf(contents, sig_bytes, float(x), float(y), float(w), float(h))
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="signed_{file_hash}"'}
    )

from utilities.documents.util_pdf_web import webpage_to_pdf
from utilities.documents.util_pdf_ops import merge_pdfs
from typing import Optional

@router.post("/pdf-studio/web-to-pdf")
async def pdf_web_to_pdf_endpoint(
    url: str = Form(...),
    file_hash: Optional[str] = Form(None)
) -> Response:
    """
    Render an entire live web page into a high-fidelity printable PDF document.

    Args:
        url (str, optional: Target website URL.)
        file_hash (str, optional: HTML document hash.)

    Returns:
        Response: Rendered binary PDF document.
    """
    success, result = await webpage_to_pdf(url)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    final_pdf_bytes = result
    
    if file_hash:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if os.path.exists(tmp_path):
            with open(tmp_path, "rb") as f:
                existing_pdf_bytes = f.read()
            merge_success, merge_result = merge_pdfs([existing_pdf_bytes, final_pdf_bytes])
            if merge_success and isinstance(merge_result, bytes):
                final_pdf_bytes = merge_result
        
    return Response(
        content=final_pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="webpage.pdf"'}
    )


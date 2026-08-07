from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import tempfile
import uuid
import shutil

import fitz  # PyMuPDF
import docx

from utilities.util_cv_builder import generate_cv_pdf
from utilities.util_obsidian_agent import stream_obsidian_build, CACHE_DIR as OBSIDIAN_CACHE_DIR
from utilities.util_everything import check_and_download_es, search_es, start_everything_service

router = APIRouter(
    prefix="/api/files-documents",
    tags=["Files & Documents"]
)

# --- Chart Maker ---
from utilities.util_charts import parse_chart_data

@router.post("/chart/parse")
async def parse_chart_data_endpoint(file_hash: str = Form(...)):
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
def list_obsidian_vaults():
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
def delete_obsidian_vault(vault_name: str):
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
def delete_obsidian_topic(vault_name: str, topic: str):
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
    from utilities.util_obsidian_agent import sanitize_filename
    safe_topic = sanitize_filename(topic)
    md_path = os.path.join(vault_path, f"{safe_topic}.md")
    if os.path.exists(md_path):
        try:
            os.remove(md_path)
        except Exception:
            pass
            
    return {"status": "success"}

@router.get("/obsidian/vaults/{vault_name}/node/{node_id}")
def get_vault_node_content(vault_name: str, node_id: str):
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
def get_vault_graph(vault_name: str):
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
async def obsidian_stream(topic: str, vault: str, max_pages: int = 10, max_depth: int = 2):
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
def get_obsidian_settings():
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
def save_obsidian_settings(settings: ObsidianSettings):
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
async def extract_text(file_hash: str = Form(...)):
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
            doc = fitz.open(temp_path)
            for page in doc:
                text += page.get_text() + "\n\n"
            doc.close()
            
        elif ext == ".docx":
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
def generate_cv(req: CVRequest):
    data = req.dict()
    template = data.pop("template")
    
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
from utilities.util_pdf_compress import compress_pdf
from utilities.util_pdf_redact import redact_pdf_text

@router.post("/pdf-studio/compress")
async def compress_pdf_endpoint(file_hash: str = Form(...)):
    
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
):
    
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

from utilities.util_pdf_security import manage_pdf_password, add_pdf_watermark

@router.post("/pdf-studio/security/password")
async def pdf_security_password_endpoint(
    file_hash: str = Form(...),
    password: str = Form(...),
    action: str = Form(...) # "lock" or "unlock"
):
    
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
):
    
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

from utilities.util_pdf_ops import merge_pdfs, split_pdf, remove_specific_pages, remove_blank_pages, resize_pdf_pages

@router.post("/pdf-studio/ops/merge")
async def pdf_ops_merge_endpoint(file_hashes: List[str] = Form(...)):
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
    start: int = Form(...),
    end: int = Form(...)
):
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = split_pdf(contents, start, end)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="extracted_{file_hash}"'}
    )

@router.post("/pdf-studio/ops/remove")
async def pdf_ops_remove_endpoint(
    file_hash: str = Form(...),
    pages: str = Form(...)
):
    
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
async def pdf_ops_clean_endpoint(file_hash: str = Form(...)):
    
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
):
    
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

from utilities.util_pdf_metadata import get_pdf_metadata, update_pdf_metadata, check_pdf_authenticity

@router.post("/pdf-studio/metadata/get")
async def pdf_metadata_get_endpoint(file_hash: str = Form(...)):
    
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
):
    
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
async def pdf_metadata_health_endpoint(file_hash: str = Form(...)):
    
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
from utilities.util_pdf_convert import pdf_to_images, images_to_pdf, make_pdf_searchable

@router.post("/pdf-studio/convert/pdf-to-images")
async def pdf_convert_pdf_to_images_endpoint(
    file_hash: str = Form(...),
    dpi: int = Form(150)
):
    
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
async def pdf_convert_images_to_pdf_endpoint(file_hashes: List[str] = Form(...)):
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
async def pdf_convert_ocr_endpoint(file_hash: str = Form(...)):
    
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

from utilities.util_pdf_search import build_index, search_documents, delete_index, get_index_info, delete_document

class BuildIndexRequest(BaseModel):
    target_dir: str

@router.post("/pdf-studio/search/build")
def pdf_search_build_endpoint(req: BuildIndexRequest):
    try:
        indexed, skipped = build_index(req.target_dir)
        return {"indexed": indexed, "skipped": skipped, "message": f"Successfully indexed {indexed} files (skipped {skipped})."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pdf-studio/search/query")
def pdf_search_query_endpoint(q: str):
    success, msg, results = search_documents(q)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg, "results": results}

@router.get("/pdf-studio/search/info")
def pdf_search_info_endpoint():
    return get_index_info()

@router.delete("/pdf-studio/search/index")
def pdf_search_delete_endpoint():
    deleted = delete_index()
    if deleted:
        return {"message": "Index deleted successfully."}
    raise HTTPException(status_code=404, detail="No index found to delete.")

class DeleteDocumentRequest(BaseModel):
    file_path: str

@router.delete("/pdf-studio/search/index/document")
def pdf_search_delete_document_endpoint(req: DeleteDocumentRequest):
    deleted = delete_document(req.file_path)
    if deleted:
        return {"message": f"Document '{req.file_path}' removed from index."}
    raise HTTPException(status_code=404, detail="Document not found in index.")

from utilities.util_pdf_diff import compare_pdfs

@router.post("/pdf-studio/diff")
async def pdf_diff_endpoint(
    file1_hash: str = Form(...),
    file2_hash: str = Form(...)
):
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
from utilities.util_preview import get_image_preview
from utilities.util_os import open_file_in_os
from utilities.util_file_mover import get_target_files, perform_move, perform_delete, perform_undo

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
def file_organizer_scan(req: ScanRequest):
    try:
        files = get_target_files(req.source_path)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/file-organizer/preview")
def file_organizer_preview(path: str):
    import os
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
        
    preview_path = get_image_preview(path)
    if preview_path and os.path.exists(preview_path):
        return FileResponse(preview_path)
    raise HTTPException(status_code=404, detail="No preview available")

@router.post("/file-organizer/open")
def file_organizer_open(req: OpenRequest):
    open_file_in_os(req.file_path)
    return {"status": "opened"}

@router.post("/file-organizer/action")
def file_organizer_action(req: ActionRequest):
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
def file_organizer_undo(req: UndoRequest):
    success, msg = perform_undo(req.last_action, req.source_path, req.dest_path)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "success", "message": msg}

@router.get("/utils/explore-dir")
def explore_dir(path: str = "", include_files: bool = False):
    from utilities.util_file_explorer import get_directory_contents
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
):
    from utilities.util_excel import load_data
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    
    success, result = load_data(contents, file_hash, has_header)
    if not success:
        raise HTTPException(status_code=400, detail=result)
        
    df = result
    from utilities.util_excel import format_dataframe_for_preview
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
):
    from utilities.util_excel import load_data, process_dataframe, export_data
    
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
        from utilities.util_excel import format_dataframe_for_preview
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
):
    from utilities.util_expense import extract_receipt_data
    
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
async def get_math_latex_models():
    from utilities.util_math_latex import get_model_labels
    return {"models": get_model_labels()}

@router.post("/math-latex/convert")
async def convert_math_latex(
    file_hash: str = Form(...)
):
    from utilities.util_math_latex import process_math_image
    
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
async def list_hash_snapshots():
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
async def delete_hash_snapshot(filename: str):
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
async def create_hash_snapshot(target_dir: str = Form(...)):
    from utilities.util_hash import create_snapshot
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
async def verify_hash_snapshot(target_dir: str = Form(...), file_hash: str = Form(...)):
    from utilities.util_hash import verify_integrity
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
async def process_mega(request: MegaCleanerRequest):
    from utilities.util_mega import process_mega_link
    
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

from utilities.util_llm_chat import load_tool_config, save_tool_config, stream_chat

@router.get("/llm-chat/config")
def get_llm_chat_config():
    from utilities.util_config import load_all_config
    config = load_all_config()
    model = config.get("obsidian_ollama_model", "llama3:8b-instruct-q4_K_M")
    return {"enabled_tools": load_tool_config(), "model": model}

class ToolConfigRequest(BaseModel):
    enabled_tools: List[str]

@router.post("/llm-chat/config")
def update_llm_chat_config(req: ToolConfigRequest):
    success = save_tool_config(req.enabled_tools)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save configuration")
    return {"status": "success"}

@router.get("/llm-chat/stream")
async def llm_chat_stream(messages: str, token: str = ""):
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

@router.get("/everything/status")
def everything_status():
    result = check_and_download_es()
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))
    return result

@router.post("/everything/start")
def everything_start():
    result = start_everything_service()
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

@router.post("/everything/search")
def everything_search(req: EverythingSearchRequest):
    result = search_es(req.query, req.extension, req.path, req.max_results)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result

# --- WHITEBOARD ---
from utilities.util_whiteboard import export_whiteboard, transcribe_whiteboard

class WhiteboardExportRequest(BaseModel):
    images: List[str]
    format: str
    width: int
    height: int

class WhiteboardTranscribeRequest(BaseModel):
    image: str

@router.post("/whiteboard/export")
def whiteboard_export_endpoint(req: WhiteboardExportRequest):
    success, result = export_whiteboard(req.images, req.format, req.width, req.height)
    if not success:
        raise HTTPException(status_code=500, detail=result)
        
    media_type = "application/pdf" if req.format.lower() == "pdf" else "image/gif"
    return Response(
        content=result,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="whiteboard.{req.format.lower()}"'}
    )

@router.post("/whiteboard/transcribe")
async def whiteboard_transcribe_endpoint(req: WhiteboardTranscribeRequest):
    success, result = await transcribe_whiteboard(req.image)
    if not success:
        raise HTTPException(status_code=500, detail=result)
    return {"text": result}
# --- NEW PDF STUDIO ROUTES ---

from utilities.util_pdf_ops import rotate_pages, crop_pdf, organize_pdf

@router.post("/pdf-studio/ops/rotate")
async def pdf_ops_rotate_endpoint(
    file_hash: str = Form(...),
    degrees: int = Form(...),
    pages: str = Form("all")
):
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
):
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
):
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

from utilities.util_pdf_images import extract_pdf_images, pdf_to_image

@router.post("/pdf-studio/images/extract")
async def pdf_images_extract_endpoint(file_hash: str = Form(...)):
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = extract_pdf_images(contents)
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
    dpi: int = Form(150)
):
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = pdf_to_image(contents, dpi)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    ext = "zip" if len(result) > 5000000 or result[:4] == b'PK\x03\x04' else "png"
    return Response(
        content=result,
        media_type="application/zip" if ext == "zip" else "image/png",
        headers={"Content-Disposition": f'attachment; filename="converted.{ext}"'}
    )

from utilities.util_pdf_advanced import flatten_pdf, optimize_pdf, repair_pdf

@router.post("/pdf-studio/advanced/flatten")
async def pdf_advanced_flatten_endpoint(file_hash: str = Form(...)):
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
async def pdf_advanced_optimize_endpoint(file_hash: str = Form(...)):
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
async def pdf_advanced_repair_endpoint(file_hash: str = Form(...)):
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

from utilities.util_pdf_sign import sign_pdf

@router.post("/pdf-studio/sign")
async def pdf_sign_endpoint(
    file_hash: str = Form(...),
    signature_text: str = Form(...)
):
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
    with open(tmp_path, "rb") as f:
        contents = f.read()

    success, result = sign_pdf(contents, signature_text)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="signed_{file_hash}"'}
    )

from utilities.util_pdf_web import webpage_to_pdf

@router.post("/pdf-studio/web-to-pdf")
async def pdf_web_to_pdf_endpoint(
    url: str = Form(...)
):
    success, result = await webpage_to_pdf(url)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="webpage.pdf"'}
    )


from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Optional

from utilities.util_cv_builder import generate_cv_pdf

router = APIRouter(
    prefix="/api/files-documents",
    tags=["Files & Documents"]
)

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
        
    return Response(
        content=result, 
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{req.name.replace(" ", "_")}_Resume.pdf"'}
    )

from fastapi import UploadFile, File, Form
from utilities.util_pdf_compress import compress_pdf
from utilities.util_pdf_redact import redact_pdf_text

@router.post("/pdf-studio/compress")
async def compress_pdf_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    success, compressed_bytes, orig_size, new_size, percent, msg = compress_pdf(contents)
    
    if not success:
        raise HTTPException(status_code=500, detail=msg)
        
    # Return percentage and sizes in headers so frontend can display metrics
    headers = {
        "Content-Disposition": f'attachment; filename="compressed_{file.filename}"',
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
    file: UploadFile = File(...),
    words: str = Form(...)
):
    contents = await file.read()
    words_list = [w.strip() for w in words.split(",") if w.strip()]
    
    success, result, count = redact_pdf_text(contents, words_list)
    
    if not success:
        raise HTTPException(status_code=500, detail=str(result))
        
    headers = {
        "Content-Disposition": f'attachment; filename="redacted_{file.filename}"',
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
    file: UploadFile = File(...),
    password: str = Form(...),
    action: str = Form(...) # "lock" or "unlock"
):
    contents = await file.read()
    success, result = manage_pdf_password(contents, password, action)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    filename_prefix = "locked_" if action == "lock" else "unlocked_"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename_prefix}{file.filename}"'
    }
    
    return Response(
        content=result,
        media_type="application/pdf",
        headers=headers
    )

@router.post("/pdf-studio/security/watermark")
async def pdf_security_watermark_endpoint(
    file: UploadFile = File(...),
    text: str = Form(...),
    opacity: float = Form(0.3)
):
    contents = await file.read()
    success, result = add_pdf_watermark(contents, text, opacity)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    headers = {
        "Content-Disposition": f'attachment; filename="watermarked_{file.filename}"'
    }
    
    return Response(
        content=result,
        media_type="application/pdf",
        headers=headers
    )

from utilities.util_pdf_ops import merge_pdfs, split_pdf, remove_specific_pages, remove_blank_pages, resize_pdf_pages

@router.post("/pdf-studio/ops/merge")
async def pdf_ops_merge_endpoint(files: List[UploadFile] = File(...)):
    bytes_list = []
    for f in files:
        bytes_list.append(await f.read())
        
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
    file: UploadFile = File(...),
    start: int = Form(...),
    end: int = Form(...)
):
    contents = await file.read()
    success, result = split_pdf(contents, start, end)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="extracted_{file.filename}"'}
    )

@router.post("/pdf-studio/ops/remove")
async def pdf_ops_remove_endpoint(
    file: UploadFile = File(...),
    pages: str = Form(...)
):
    contents = await file.read()
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
        headers={"Content-Disposition": f'attachment; filename="trimmed_{file.filename}"'}
    )

@router.post("/pdf-studio/ops/clean")
async def pdf_ops_clean_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    success, result, count = remove_blank_pages(contents)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="cleaned_{file.filename}"',
            "X-Blank-Pages-Removed": str(count)
        }
    )

@router.post("/pdf-studio/ops/resize")
async def pdf_ops_resize_endpoint(
    file: UploadFile = File(...),
    target: str = Form(...)
):
    contents = await file.read()
    success, result = resize_pdf_pages(contents, target)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="resized_{file.filename}"'}
    )

from utilities.util_pdf_metadata import get_pdf_metadata, update_pdf_metadata, check_pdf_authenticity

@router.post("/pdf-studio/metadata/get")
async def pdf_metadata_get_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    success, metadata = get_pdf_metadata(contents)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(metadata))
        
    return metadata

@router.post("/pdf-studio/metadata/update")
async def pdf_metadata_update_endpoint(
    file: UploadFile = File(...),
    title: str = Form(""),
    author: str = Form(""),
    subject: str = Form(""),
    keywords: str = Form(""),
    creator: str = Form(""),
    producer: str = Form("")
):
    contents = await file.read()
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
        headers={"Content-Disposition": f'attachment; filename="updated_{file.filename}"'}
    )

@router.post("/pdf-studio/metadata/health")
async def pdf_metadata_health_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    success, report = check_pdf_authenticity(contents)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(report))
        
    return report

import zipfile
import io
from utilities.util_pdf_convert import pdf_to_images, images_to_pdf, make_pdf_searchable

@router.post("/pdf-studio/convert/pdf-to-images")
async def pdf_convert_pdf_to_images_endpoint(
    file: UploadFile = File(...),
    dpi: int = Form(150)
):
    contents = await file.read()
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
        headers={"Content-Disposition": f'attachment; filename="images_{file.filename}.zip"'}
    )

@router.post("/pdf-studio/convert/images-to-pdf")
async def pdf_convert_images_to_pdf_endpoint(files: List[UploadFile] = File(...)):
    bytes_list = []
    for f in files:
        bytes_list.append(await f.read())
        
    success, result = images_to_pdf(bytes_list)
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="converted_images.pdf"'}
    )

@router.post("/pdf-studio/convert/ocr")
async def pdf_convert_ocr_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    success, result = make_pdf_searchable(contents)
    
    if not success:
        raise HTTPException(status_code=400, detail=str(result))
        
    return Response(
        content=result,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="searchable_{file.filename}"'}
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
    file: UploadFile = File(...),
    has_header: bool = Form(...)
):
    from utilities.util_excel import load_data
    contents = await file.read()
    
    success, result = load_data(contents, file.filename, has_header)
    if not success:
        raise HTTPException(status_code=400, detail=result)
        
    df = result
    preview_df = df.head(50)
    
    # Convert NaNs and Infs to None for JSON serialization
    import numpy as np
    import pandas as pd
    preview_df = preview_df.replace([np.inf, -np.inf, np.nan, pd.NaT], None)
    
    # Extract column types
    import pandas as pd
    import datetime
    col_types = {}
    for col, dtype in df.dtypes.items():
        if pd.api.types.is_numeric_dtype(dtype):
            col_types[col] = "number"
        elif pd.api.types.is_datetime64_any_dtype(dtype):
            col_types[col] = "date"
        else:
            sample = df[col].dropna().head(1)
            if not sample.empty and isinstance(sample.iloc[0], datetime.time):
                col_types[col] = "time"
            else:
                col_types[col] = "text"
                
    # Also explicitly convert datetime and time columns to strings for JSON
    for col in preview_df.columns:
        if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
            preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d %H:%M:%S').replace("NaT", None)
        elif col_types.get(col) == "time":
            preview_df[col] = preview_df[col].apply(lambda x: x.strftime('%H:%M:%S') if isinstance(x, datetime.time) else None)
    
    return {
        "rows": df.shape[0],
        "cols": df.shape[1],
        "columns": list(df.columns),
        "columnTypes": col_types,
        "data": preview_df.to_dict(orient="records")
    }

@router.post("/excel-cleaner/process")
async def excel_cleaner_process(
    file: UploadFile = File(...),
    has_header: bool = Form(...),
    drop_na: bool = Form(...),
    drop_duplicates: bool = Form(...),
    rules: str = Form("[]"),
    action: str = Form(...), # "preview" or "download"
    export_format: str = Form("CSV") # "CSV" or "Excel"
):
    from utilities.util_excel import load_data, process_dataframe, export_data
    contents = await file.read()
    
    # Load
    success, result = load_data(contents, file.filename, has_header)
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
        preview_df = cleaned_df.head(50)
        import numpy as np
        import pandas as pd
        preview_df = preview_df.replace([np.inf, -np.inf, np.nan, pd.NaT], None)
        
        col_types = {}
        import datetime
        for col, dtype in cleaned_df.dtypes.items():
            if pd.api.types.is_numeric_dtype(dtype):
                col_types[col] = "number"
            elif pd.api.types.is_datetime64_any_dtype(dtype):
                col_types[col] = "date"
            else:
                sample = cleaned_df[col].dropna().head(1)
                if not sample.empty and isinstance(sample.iloc[0], datetime.time):
                    col_types[col] = "time"
                else:
                    col_types[col] = "text"
                    
        for col in preview_df.columns:
            if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d %H:%M:%S').replace("NaT", None)
            elif col_types.get(col) == "time":
                preview_df[col] = preview_df[col].apply(lambda x: x.strftime('%H:%M:%S') if isinstance(x, datetime.time) else None)
                
        return {
            "rows": cleaned_df.shape[0],
            "cols": cleaned_df.shape[1],
            "columns": list(cleaned_df.columns),
            "columnTypes": col_types,
            "data": preview_df.to_dict(orient="records")
        }
    
    elif action == "download":
        try:
            file_bytes = export_data(cleaned_df, export_format)
            if not file_bytes:
                raise HTTPException(status_code=500, detail="Failed to export data")
                
            # Use original filename without extension, add new extension
            base_name = file.filename.rsplit('.', 1)[0]
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
    file: UploadFile = File(...)
):
    from utilities.util_expense import extract_receipt_data
    contents = await file.read()
    
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
    file: UploadFile = File(...)
):
    from utilities.util_math_latex import process_math_image
    import io
    from PIL import Image
    
    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid image file")
        
    success, result = process_math_image(img)
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
async def verify_hash_snapshot(target_dir: str = Form(...), snapshot: UploadFile = File(...)):
    from utilities.util_hash import verify_integrity
    import os
    import tempfile
    
    contents = await snapshot.read()
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".json")
    tmp.write(contents)
    tmp.close()
    
    success, results, msg = verify_integrity(target_dir, tmp.name)
    os.unlink(tmp.name)
    
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

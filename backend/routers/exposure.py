import os
import shutil
import uuid
import asyncio
import json
import zipfile
import cv2
from typing import Dict, Any, List
from fastapi import APIRouter, Form, HTTPException
from utilities.vision.util_exposure import generate_exposure_photography, adjust_image_exposure

router = APIRouter(
    prefix="/api/exposure",
    tags=["exposure"]
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
TEMP_DIR = os.path.join(BASE_DIR, "temp")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

def process_single_file(file_path: str, out_dir: str, ev: float) -> str:
    _, ext = os.path.splitext(file_path.lower())
    if ext in VIDEO_EXTS:
        return generate_exposure_photography(file_path, out_dir, ev=ev)
    else:
        img = cv2.imread(file_path)
        if img is None:
            raise ValueError("Could not read image file.")
        adjusted = adjust_image_exposure(img, ev=ev)
        output_filename = f"exposure_{uuid.uuid4().hex[:8]}.jpg"
        cv2.imwrite(os.path.join(out_dir, output_filename), adjusted)
        return output_filename

@router.post("/process")
async def process_exposure(
    file_hash: str = Form(..., min_length=1, description="Uploaded file hash"),
    ev: float = Form(0.0, description="Exposure value compensation (-3.0 to +3.0)")
) -> Dict[str, Any]:
    """
    Process an uploaded image or video into an exposure-adjusted / long exposure photograph.
    """
    clean_hash = file_hash.strip()
    if not clean_hash:
        raise HTTPException(status_code=400, detail="File hash is required.")
        
    file_path = os.path.join(UPLOADS_DIR, clean_hash)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found.")
    
    try:
        output_filename = await asyncio.to_thread(process_single_file, file_path, TEMP_DIR, ev)
        image_url = f"/temp/{output_filename}"
        return {"success": True, "image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process/batch")
async def api_exposure_batch(
    hashes: str = Form(..., description="JSON-encoded list of file hashes"),
    ev: float = Form(0.0, description="Exposure value compensation (-3.0 to +3.0)")
) -> Dict[str, Any]:
    """
    Batch process multiple uploaded files (images or videos) into exposure photos and bundle into a ZIP archive.
    """
    try:
        hash_list = json.loads(hashes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hashes format: JSON list expected.")
        
    if not isinstance(hash_list, list) or not hash_list:
        raise HTTPException(status_code=400, detail="No files provided in hashes list.")
        
    out_dir = os.path.join(TEMP_DIR, f"exposure_batch_{uuid.uuid4().hex[:8]}")
    os.makedirs(out_dir, exist_ok=True)
    
    try:
        processed_files: List[str] = []
        original_files: List[str] = []
        for fhash in hash_list:
            if not isinstance(fhash, str) or not fhash.strip():
                continue
            fpath = os.path.join(UPLOADS_DIR, fhash.strip())
            if not os.path.exists(fpath):
                continue
                
            output_filename = await asyncio.to_thread(process_single_file, fpath, out_dir, ev)
            out_path = os.path.join(out_dir, output_filename)
            
            frontend_accessible_path = os.path.join(TEMP_DIR, output_filename)
            shutil.copy2(out_path, frontend_accessible_path)
            
            processed_files.append(f"/temp/{output_filename}")
            original_files.append(f"/uploads/{fhash.strip()}")
                    
        zip_filename = f"exposure_batch_{uuid.uuid4().hex[:8]}.zip"
        zip_path = os.path.join(TEMP_DIR, zip_filename)
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(out_dir):
                for file in files:
                    zipf.write(os.path.join(root, file), file)
                    
        shutil.rmtree(out_dir, ignore_errors=True)
        return {
            "success": True, 
            "zip_url": f"/temp/{zip_filename}", 
            "processed_urls": processed_files,
            "original_urls": original_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

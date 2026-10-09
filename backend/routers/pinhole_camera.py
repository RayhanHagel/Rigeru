import os
import shutil
import uuid
import asyncio
import json
import zipfile
from typing import Dict, Any, List
from fastapi import APIRouter, Form, HTTPException
from utilities.vision.util_pinhole import generate_pinhole_photography

router = APIRouter(
    prefix="/api/pinhole",
    tags=["pinhole-camera"]
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
TEMP_DIR = os.path.join(BASE_DIR, "temp")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

@router.post("/process")
async def process_pinhole_video(file_hash: str = Form(..., min_length=1, description="Uploaded video file hash")) -> Dict[str, Any]:
    """
    Process an uploaded video into a simulated long-exposure pinhole photograph.

    Args:
        file_hash (str): Hash / filename of the uploaded video located in uploads directory.

    Returns:
        Dict[str, Any]: Success status and URL path to generated output image.

    Raises:
        HTTPException: If file_hash is missing, file does not exist, or processing fails.
    """
    clean_hash = file_hash.strip()
    if not clean_hash:
        raise HTTPException(status_code=400, detail="File hash is required.")
        
    video_path = os.path.join(UPLOADS_DIR, clean_hash)
    if not os.path.exists(video_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found.")
    
    try:
        output_filename = await asyncio.to_thread(generate_pinhole_photography, video_path, TEMP_DIR)
        image_url = f"/temp/{output_filename}"
        return {"success": True, "image_url": image_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process/batch")
async def api_pinhole_batch(hashes: str = Form(..., description="JSON-encoded list of video file hashes")) -> Dict[str, Any]:
    """
    Batch process multiple uploaded videos into pinhole photos and bundle into a ZIP archive.

    Args:
        hashes (str): JSON string representing a list of file hashes to process.

    Returns:
        Dict[str, Any]: URLs for the generated ZIP archive, individual processed images, and original videos.

    Raises:
        HTTPException: If input is invalid JSON, list is empty, or batch processing fails.
    """
    try:
        hash_list = json.loads(hashes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hashes format: JSON list expected.")
        
    if not isinstance(hash_list, list) or not hash_list:
        raise HTTPException(status_code=400, detail="No files provided in hashes list.")
        
    out_dir = os.path.join(TEMP_DIR, f"pinhole_batch_{uuid.uuid4().hex[:8]}")
    os.makedirs(out_dir, exist_ok=True)
    
    try:
        processed_files: List[str] = []
        original_files: List[str] = []
        for fhash in hash_list:
            if not isinstance(fhash, str) or not fhash.strip():
                continue
            video_path = os.path.join(UPLOADS_DIR, fhash.strip())
            if not os.path.exists(video_path):
                continue
                
            output_filename = await asyncio.to_thread(generate_pinhole_photography, video_path, out_dir)
            out_path = os.path.join(out_dir, output_filename)
            
            frontend_accessible_path = os.path.join(TEMP_DIR, output_filename)
            shutil.copy2(out_path, frontend_accessible_path)
            
            processed_files.append(f"/temp/{output_filename}")
            original_files.append(f"/uploads/{fhash.strip()}")
                    
        zip_filename = f"pinhole_batch_{uuid.uuid4().hex[:8]}.zip"
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

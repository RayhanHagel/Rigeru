import os
import shutil
import uuid
from fastapi import APIRouter, Form, HTTPException
from utilities.util_pinhole import generate_pinhole_photography

router = APIRouter(
    prefix="/api/pinhole",
    tags=["pinhole-camera"]
)

# Use the same TEMP_DIR and UPLOADS_DIR logic as main.py
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
TEMP_DIR = os.path.join(BASE_DIR, "temp")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

@router.post("/process")
async def process_pinhole_video(file_hash: str = Form(...)):
    """
    Receives a video file hash, generates a long-exposure pinhole photograph,
    and returns the URL of the generated image.
    """
    if not file_hash:
        raise HTTPException(status_code=400, detail="File hash is required.")
        
    video_path = os.path.join(UPLOADS_DIR, file_hash)
    if not os.path.exists(video_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found.")
    
    try:
        # Process video and save image to TEMP_DIR
        output_filename = generate_pinhole_photography(video_path, TEMP_DIR)
        
        # URL for the frontend to access the generated image
        image_url = f"/temp/{output_filename}"
        
        return {"success": True, "image_url": image_url}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import json
import zipfile

@router.post("/process/batch")
async def api_pinhole_batch(hashes: str = Form(...)):
    """Batch process multiple videos into pinhole photos."""
    try:
        hash_list = json.loads(hashes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hashes format")
        
    if not hash_list:
        raise HTTPException(status_code=400, detail="No files provided")
        
    out_dir = os.path.join(TEMP_DIR, f"pinhole_batch_{uuid.uuid4().hex[:8]}")
    os.makedirs(out_dir, exist_ok=True)
    
    try:
        processed_files = []
        original_files = []
        for fhash in hash_list:
            video_path = os.path.join(UPLOADS_DIR, fhash)
            if not os.path.exists(video_path):
                continue
                
            output_filename = generate_pinhole_photography(video_path, out_dir)
            out_path = os.path.join(out_dir, output_filename)
            
            # Also copy to TEMP_DIR directly so it's accessible at /temp/
            frontend_accessible_path = os.path.join(TEMP_DIR, output_filename)
            shutil.copy2(out_path, frontend_accessible_path)
            
            processed_files.append(f"/temp/{output_filename}")
            original_files.append(f"/uploads/{fhash}")
                    
        # Zip the directory
        zip_filename = f"pinhole_batch_{uuid.uuid4().hex[:8]}.zip"
        zip_path = os.path.join(TEMP_DIR, zip_filename)
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(out_dir):
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

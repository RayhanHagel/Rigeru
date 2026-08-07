from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response, BackgroundTasks
import os
import shutil
import time

router = APIRouter(prefix="/api/system/upload", tags=["System Upload"])

UPLOAD_DIR = os.path.join(".", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/check")
def check_upload(file_hash: str):
    """Check if a file with this hash already exists."""
    if not file_hash:
        raise HTTPException(status_code=400, detail="file_hash is required")
        
    file_path = os.path.join(UPLOAD_DIR, file_hash)
    if os.path.exists(file_path):
        # Update modification time so it doesn't get cleaned up if it's still being used
        try:
            os.utime(file_path, None)
        except:
            pass
        return {"exists": True, "path": file_path}
    return {"exists": False}

@router.post("/direct")
async def direct_upload(background_tasks: BackgroundTasks, file_hash: str = Form(...), file: UploadFile = File(...)):
    """Upload a file directly to the cache/uploads directory."""
        
    if not file_hash:
        raise HTTPException(status_code=400, detail="file_hash is required")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    file_path = os.path.join(UPLOAD_DIR, file_hash)
    
    # If it already exists, just return success
    if os.path.exists(file_path):
        return {"success": True, "path": file_path, "message": "File already exists"}
        
    try:
        with open(file_path, "wb") as buffer:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)
        return {"success": True, "path": file_path}
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stage-folder")
async def stage_folder(folder_path: str = Form(...)):
    """Stage a local folder into the uploads cache and return their hashes."""
    if not folder_path or not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    
    valid_exts = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov', '.avi'}
    staged_files = []
    
    try:
        for f in os.listdir(folder_path):
            ext = os.path.splitext(f)[1].lower()
            if ext in valid_exts:
                fpath = os.path.join(folder_path, f)
                if not os.path.isfile(fpath):
                    continue
                    
                # Compute fast hash (just SHA256 of the whole file for simplicity in backend)
                hasher = hashlib.sha256()
                with open(fpath, "rb") as fb:
                    for chunk in iter(lambda: fb.read(4096), b""):
                        hasher.update(chunk)
                file_hash = hasher.hexdigest() + ext
                
                dest_path = os.path.join(UPLOAD_DIR, file_hash)
                if not os.path.exists(dest_path):
                    shutil.copy2(fpath, dest_path)
                    
                mime_type, _ = mimetypes.guess_type(fpath)
                
                staged_files.append({
                    "hash_name": file_hash,
                    "original_name": f,
                    "file_type": mime_type or "application/octet-stream"
                })
                
        return {"success": True, "files": staged_files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

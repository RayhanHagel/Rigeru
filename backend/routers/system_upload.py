import os
import shutil
import time
import hashlib
import mimetypes
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks

router = APIRouter(prefix="/api/system/upload", tags=["System Upload"])

UPLOAD_DIR = os.path.join(".", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/check")
def check_upload(file_hash: str) -> Dict[str, Any]:
    """
    Check if a file with the given hash already exists in the uploads cache.

    Args:
        file_hash (str): Hash key of the target file.

    Returns:
        Dict[str, Any]: Existence flag and absolute file path if present (`{"exists": bool, "path"?: str}`).

    Raises:
        HTTPException: If file_hash is missing or empty.
    """
    clean_hash = file_hash.strip()
    if not clean_hash:
        raise HTTPException(status_code=400, detail="file_hash is required.")
        
    file_path = os.path.join(UPLOAD_DIR, clean_hash)
    if os.path.exists(file_path):
        # Update modification time so it doesn't get cleaned up if it's still being used
        try:
            os.utime(file_path, None)
        except OSError:
            pass
        return {"exists": True, "path": file_path}
    return {"exists": False}

@router.post("/direct")
async def direct_upload(
    background_tasks: BackgroundTasks,
    file_hash: str = Form(..., min_length=1, description="Unique hash string for the file"),
    file: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Stream and persist an uploaded file directly into the server uploads directory.

    Args:
        background_tasks (BackgroundTasks): FastAPI background task runner.
        file_hash (str): Destination filename / hash key.
        file (UploadFile): Binary multipart file stream from the client.

    Returns:
        Dict[str, Any]: Upload confirmation containing the file path (`{"success": bool, "path": str}`).

    Raises:
        HTTPException: If hash or file is missing, or disk write fails.
    """
    clean_hash = file_hash.strip()
    if not clean_hash:
        raise HTTPException(status_code=400, detail="file_hash is required.")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")
        
    file_path = os.path.join(UPLOAD_DIR, clean_hash)
    
    # If it already exists, just return success
    if os.path.exists(file_path):
        return {"success": True, "path": file_path, "message": "File already exists."}
        
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
            try:
                os.remove(file_path)
            except OSError:
                pass
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stage-folder")
async def stage_folder(
    folder_path: str = Form(..., min_length=1, description="Absolute local path to the folder to stage")
) -> Dict[str, Any]:
    """
    Stage all media files from a local directory into the server upload cache.

    Args:
        folder_path (str): Host filesystem path pointing to directory containing media.

    Returns:
        Dict[str, Any]: List of staged media items with hash names, original names, and mime types.

    Raises:
        HTTPException: If path is invalid, inaccessible, or copying fails.
    """
    clean_path = folder_path.strip()
    if not clean_path or not os.path.isdir(clean_path):
        raise HTTPException(status_code=400, detail="Invalid folder path: directory does not exist.")
    
    valid_exts = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov', '.avi'}
    staged_files: List[Dict[str, str]] = []
    
    try:
        for f in os.listdir(clean_path):
            ext = os.path.splitext(f)[1].lower()
            if ext in valid_exts:
                fpath = os.path.join(clean_path, f)
                if not os.path.isfile(fpath):
                    continue
                    
                hasher = hashlib.sha256()
                with open(fpath, "rb") as fb:
                    for chunk in iter(lambda: fb.read(65536), b""):
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

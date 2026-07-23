import os
import shutil
import base64
import uuid
from typing import Optional, Dict
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

from utilities.util_audio import (
    extract_video_frame,
    bgr_frame_to_rgb,
    extract_speaker_thumbnail,
    extract_speaker_clip,
    run_transcription_pipeline,
    collect_raw_speaker_ids,
    apply_speaker_renames,
    export_srt,
    export_ass_multistyle
)
from utilities.util_huggingface import load_hf_token

router = APIRouter(prefix="/api/subtitles", tags=["Subtitles & Metadata"])
CACHE_DIR = os.path.join(".", "cache", "temp")
os.makedirs(CACHE_DIR, exist_ok=True)

class TranscribeRequest(BaseModel):
    file_id: str
    model_size: str = "base"
    do_diarize: bool = False

class ExportRequest(BaseModel):
    segments: list
    speaker_mapping: Dict[str, str] = {}
    speaker_styles: Dict[str, str] = {} # Map speaker ID -> preset name
    format: str = "srt" # or "ass"
    style_preset: str = "Cinema Black"

@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    
    file_id = str(uuid.uuid4()) + "_" + file.filename
    temp_path = os.path.join(CACHE_DIR, file_id)
    
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"file_id": file_id, "filename": file.filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preview-frame/{file_id}")
def get_preview_frame(file_id: str):
    temp_path = os.path.join(CACHE_DIR, file_id)
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        import cv2
        frame = extract_video_frame(temp_path)
        if frame is None:
            raise HTTPException(status_code=400, detail="Could not extract frame")
            
        rgb_frame = bgr_frame_to_rgb(frame)
        ret, buffer = cv2.imencode('.jpg', cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR))
        img_b64 = base64.b64encode(buffer).decode('utf-8')
        return {"image_base64": img_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe")
def transcribe_media(req: TranscribeRequest):
    temp_path = os.path.join(CACHE_DIR, req.file_id)
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    hf_token = load_hf_token() if req.do_diarize else ""
    if req.do_diarize and not hf_token:
        raise HTTPException(status_code=400, detail="Hugging Face token required for diarization")
        
    try:
        # Note: In a production app, this should be an async task or streaming response.
        # For this migration, we'll run it synchronously like the Streamlit app.
        segments = run_transcription_pipeline(
            audio_path=temp_path,
            model_name=req.model_size,
            hf_token=hf_token,
            do_diarize=req.do_diarize,
            speaker_mapping={}
        )
        raw_ids = collect_raw_speaker_ids(segments)
        return {"segments": segments, "raw_ids": raw_ids}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/speaker-thumbnail/{file_id}")
def get_speaker_thumbnail(file_id: str, start: float):
    temp_path = os.path.join(CACHE_DIR, file_id)
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        import cv2
        thumb = extract_speaker_thumbnail(temp_path, start)
        if thumb is None:
            return {"image_base64": None}
            
        ret, buffer = cv2.imencode('.jpg', cv2.cvtColor(thumb, cv2.COLOR_RGB2BGR))
        img_b64 = base64.b64encode(buffer).decode('utf-8')
        return {"image_base64": img_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/speaker-clip/{file_id}")
def get_speaker_clip(file_id: str, start: float, end: float):
    temp_path = os.path.join(CACHE_DIR, file_id)
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    clip_path = os.path.join(CACHE_DIR, f"{file_id}_{start}_{end}.mp3")
    
    try:
        # If we already extracted this exact clip, return it
        if os.path.exists(clip_path):
            from fastapi.responses import FileResponse
            return FileResponse(clip_path, media_type="audio/mpeg")
            
        success = extract_speaker_clip(temp_path, start, end, clip_path)
        if not success or not os.path.exists(clip_path):
            raise HTTPException(status_code=500, detail="Failed to extract audio clip")
            
        from fastapi.responses import FileResponse
        return FileResponse(clip_path, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export")
def export_subtitles(req: ExportRequest):
    # Apply speaker mapping if provided
    mapped_segments = req.segments
    if req.speaker_mapping:
        mapped_segments = apply_speaker_renames(req.segments, req.speaker_mapping)
        
    try:
        if req.format.lower() == "srt":
            content = export_srt(mapped_segments, identify_people=True)
            return {"content": content, "filename": "subtitles.srt"}
        elif req.format.lower() == "ass":
            from utilities.util_audio import STYLE_PRESETS
            # Map frontend preset names to actual style dictionaries
            actual_styles = {}
            for spk_id, preset_name in req.speaker_styles.items():
                if preset_name in STYLE_PRESETS:
                    actual_styles[spk_id] = STYLE_PRESETS[preset_name]
                    
            content = export_ass_multistyle(mapped_segments, actual_styles, True, req.style_preset)
            return {"content": content, "filename": "subtitles.ass"}
        else:
            raise HTTPException(status_code=400, detail="Unsupported format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_subtitles import search_opensubtitles, download_subtitle
from fastapi.responses import Response

@router.post("/fetcher/search")
def api_subtitle_fetcher_search(
    file_path: str = Form(...),
    os_api_key: str = Form(...),
    language: str = Form("en")
):
    try:
        success, results = search_opensubtitles(
            file_path=file_path,
            api_key=os_api_key,
            language=language
        )
        if not success:
            raise HTTPException(status_code=400, detail=results)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fetcher/download")
def api_subtitle_fetcher_download(
    file_id: str = Form(...),
    os_api_key: str = Form(...)
):
    try:
        success, content, filename = download_subtitle(file_id, os_api_key)
        if not success:
            raise HTTPException(status_code=400, detail=content)
            
        # Ensure filename is safe for headers
        safe_filename = filename.encode('ascii', 'ignore').decode('ascii')
        
        return Response(
            content=content,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_ass_merger import merge_ass_files
import tempfile

@router.post("/merger/merge")
async def api_subtitle_merger_merge(
    base_file: UploadFile = File(...),
    overlay_file: UploadFile = File(...)
):
    if not base_file.filename or not overlay_file.filename:
        raise HTTPException(status_code=400, detail="Must provide both base and overlay files")
        
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ass") as base_tmp:
            base_content = await base_file.read()
            base_tmp.write(base_content)
            base_path = base_tmp.name
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=".ass") as overlay_tmp:
            overlay_content = await overlay_file.read()
            overlay_tmp.write(overlay_content)
            overlay_path = overlay_tmp.name
            
        success, result_path = merge_ass_files(base_path, overlay_path)
        
        # Cleanup temp files
        os.unlink(base_path)
        os.unlink(overlay_path)
        
        if not success:
            raise HTTPException(status_code=500, detail=result_path)
            
        with open(result_path, "rb") as f:
            merged_content = f.read()
            
        # Cleanup merged file
        os.unlink(result_path)
        
        return Response(
            content=merged_content,
            media_type="text/plain",
            headers={"Content-Disposition": 'attachment; filename="merged_subtitle.ass"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_metadata import get_media_metadata, save_media_metadata

class MediaTagsRequest(BaseModel):
    file_path: str
    title: str = ""
    artist: str = ""
    album: str = ""
    date: str = ""

@router.post("/tags/read")
def api_read_media_tags(req: MediaTagsRequest):
    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail="File does not exist")
    try:
        tags = get_media_metadata(req.file_path)
        return {"tags": tags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tags/save")
def api_save_media_tags(req: MediaTagsRequest):
    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail="File does not exist")
    try:
        success, msg = save_media_metadata(
            file_path=req.file_path,
            title=req.title,
            artist=req.artist,
            album=req.album,
            date=req.date
        )
        if not success:
            raise HTTPException(status_code=500, detail=msg)
        return {"message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_metadata import get_file_timestamps, set_file_timestamps
import datetime

class TimestampsRequest(BaseModel):
    file_path: str
    created: Optional[str] = None
    modified: Optional[str] = None
    accessed: Optional[str] = None

@router.post("/timestamps/read")
def api_read_timestamps(req: TimestampsRequest):
    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail="File does not exist")
    try:
        ts = get_file_timestamps(req.file_path)
        return {
            "timestamps": {
                "created": ts.get("created").isoformat() if "created" in ts else None,
                "modified": ts.get("modified").isoformat() if "modified" in ts else None,
                "accessed": ts.get("accessed").isoformat() if "accessed" in ts else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/timestamps/save")
def api_save_timestamps(req: TimestampsRequest):
    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail="File does not exist")
    try:
        c_time = datetime.datetime.fromisoformat(req.created) if req.created else datetime.datetime.now()
        m_time = datetime.datetime.fromisoformat(req.modified) if req.modified else datetime.datetime.now()
        a_time = datetime.datetime.fromisoformat(req.accessed) if req.accessed else datetime.datetime.now()
        
        success, msg = set_file_timestamps(req.file_path, c_time, m_time, a_time)
        if not success:
            raise HTTPException(status_code=500, detail=msg)
        return {"message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_exif import get_exif_data, strip_exif

@router.post("/exif/read")
async def api_read_exif(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        content = await file.read()
        success, exif_dict = get_exif_data(content)
        if not success:
            raise HTTPException(status_code=400, detail=str(exif_dict))
        return {"exif": exif_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/exif/strip")
async def api_strip_exif(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        content = await file.read()
        success, clean_bytes = strip_exif(content)
        if not success:
            raise HTTPException(status_code=500, detail=str(clean_bytes))
        
        safe_filename = "clean_" + file.filename.encode('ascii', 'ignore').decode('ascii')
        
        return Response(
            content=clean_bytes,
            media_type=file.content_type or "application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

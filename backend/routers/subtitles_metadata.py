import os
import shutil
import base64
import uuid
import json
import time
import datetime
import tempfile
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from fastapi.responses import JSONResponse, FileResponse

from utilities.audio_video.util_audio import (
    extract_video_frame,
    bgr_frame_to_rgb,
    extract_speaker_thumbnail,
    extract_speaker_clip,
    run_transcription_pipeline,
    collect_raw_speaker_ids,
    apply_speaker_renames,
    export_srt,
    export_ass_multistyle,
    STYLE_PRESETS
)
from utilities.vision.util_image_fx import encode_cv2_image_to_base64
from utilities.core.util_huggingface import load_hf_token
from utilities.audio_video.util_subtitles import search_opensubtitles, download_subtitle
from utilities.audio_video.util_ass_merger import merge_ass_files
from utilities.file_tools.util_metadata import get_media_metadata, save_media_metadata, get_file_timestamps, set_file_timestamps
from utilities.file_tools.util_exif import get_exif_data, strip_exif

router = APIRouter(prefix="/api/subtitles", tags=["Subtitles & Metadata"])
CACHE_DIR = os.path.join(".", "uploads")
os.makedirs(CACHE_DIR, exist_ok=True)

DICTATIONS_DIR = os.path.join(".", "cache", "dictations")
os.makedirs(DICTATIONS_DIR, exist_ok=True)

class TranscribeRequest(BaseModel):
    file_id: str = Field(..., min_length=1, description="Unique cached media file identifier.")
    model_size: str = Field("base", description="Whisper model footprint (tiny, base, small, medium, large).")
    do_diarize: bool = Field(False, description="Enable pyannote speaker diarization.")

class ExportRequest(BaseModel):
    segments: List[Dict[str, Any]] = Field(..., description="Timestamped transcription segments.")
    speaker_mapping: Dict[str, str] = Field(default_factory=dict, description="Custom speaker name remapping.")
    speaker_styles: Dict[str, str] = Field(default_factory=dict, description="Mapping of speaker IDs to typography style presets.")
    format: str = Field("srt", description="Target subtitle format ('srt' or 'ass').")
    style_preset: str = Field("Cinema Black", description="Global ASS visual typography style preset.")

@router.post("/upload")
async def upload_media(file_hash: str = Form(..., min_length=1, description="Uploaded file hash")) -> Dict[str, str]:
    """
    Register and verify the presence of an uploaded media asset in the server cache.

    Args:
        file_hash (str): Hash key of the cached upload.

    Returns:
        Dict[str, str]: Registered file identifier and filename (`{"file_id": str, "filename": str}`).

    Raises:
        HTTPException: 400 if file_hash is empty or file not found in uploads cache.
    """
    clean_hash = file_hash.strip()
    if not clean_hash:
        raise HTTPException(status_code=400, detail="No file selected.")
    
    temp_path = os.path.join(CACHE_DIR, clean_hash)
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    return {"file_id": clean_hash, "filename": clean_hash}

@router.get("/preview-frame/{file_id}")
def get_preview_frame(file_id: str) -> Dict[str, str]:
    """
    Extract a keyframe image from a video file and return it encoded in Base64 JPEG.

    Args:
        file_id (str): Video file identifier in the uploads cache.

    Returns:
        Dict[str, str]: Base64 image payload (`{"image_base64": str}`).

    Raises:
        HTTPException: 404 if file does not exist, 400 if frame extraction fails.
    """
    clean_id = file_id.strip()
    temp_path = os.path.join(CACHE_DIR, clean_id)
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        frame = extract_video_frame(temp_path)
        if frame is None:
            raise HTTPException(status_code=400, detail="Could not extract frame")
            
        rgb_frame = bgr_frame_to_rgb(frame)
        b64 = encode_cv2_image_to_base64(rgb_frame, format=".jpg")
        img_b64 = b64.split(",")[-1] if "," in b64 else b64
        return {"image_base64": img_b64}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe")
def transcribe_media(req: TranscribeRequest) -> Dict[str, Any]:
    """
    Execute speech-to-text transcription with optional pyannote speaker diarization.

    Args:
        req (TranscribeRequest): Media file ID, model size, and diarization flag.

    Returns:
        Dict[str, Any]: Timestamped transcript segments and detected speaker identifiers.

    Raises:
        HTTPException: 404 if file not found, 400 if diarization is requested without token.
    """
    temp_path = os.path.join(CACHE_DIR, req.file_id.strip())
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    hf_token = load_hf_token() if req.do_diarize else ""
    if req.do_diarize and not hf_token:
        raise HTTPException(status_code=400, detail="Hugging Face token required for diarization")
        
    try:
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

@router.get("/dictations")
def list_dictations() -> Dict[str, List[Dict[str, Any]]]:
    """
    List all recorded voice dictations with transcripts and timestamps.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Array of saved dictation metadata records sorted by date.
    """
    dictations: List[Dict[str, Any]] = []
    for f in os.listdir(DICTATIONS_DIR):
        if f.endswith(".json"):
            try:
                with open(os.path.join(DICTATIONS_DIR, f), "r", encoding="utf-8") as file:
                    dictations.append(json.load(file))
            except Exception:
                pass
    dictations.sort(key=lambda x: x.get("date", 0), reverse=True)
    return {"dictations": dictations}

@router.post("/dictations")
async def save_dictation(file_hash: str = Form(..., min_length=1, description="Uploaded audio file hash")) -> Dict[str, Any]:
    """
    Save an uploaded browser voice recording as a new dictation record.

    Args:
        file_hash (str): Hash key of the audio file in the cache directory.

    Returns:
        Dict[str, Any]: Created dictation metadata record.

    Raises:
        HTTPException: 400 if file hash is missing or not found on disk.
    """
    clean_hash = file_hash.strip()
    if not clean_hash:
        raise HTTPException(status_code=400, detail="No file selected")
    
    dict_id = str(uuid.uuid4())
    audio_source = os.path.join(CACHE_DIR, clean_hash)
    if not os.path.exists(audio_source):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    dest_audio = os.path.join(DICTATIONS_DIR, f"{dict_id}.webm")
    shutil.copy2(audio_source, dest_audio)
    
    json_path = os.path.join(DICTATIONS_DIR, f"{dict_id}.json")
    metadata = {
        "id": dict_id,
        "name": f"Recording {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "date": time.time(),
        "transcript": None,
        "is_transcribed": False
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f)
        
    return metadata

class RenameDictationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128, description="New title for the dictation.")

@router.patch("/dictations/{dict_id}")
def rename_dictation(dict_id: str, payload: RenameDictationRequest) -> Dict[str, Any]:
    """
    Rename an existing saved voice dictation.

    Args:
        dict_id (str): Unique UUID of the dictation.
        payload (RenameDictationRequest): New title payload.

    Returns:
        Dict[str, Any]: Updated dictation metadata.

    Raises:
        HTTPException: 404 if dictation does not exist.
    """
    clean_id = dict_id.strip()
    json_path = os.path.join(DICTATIONS_DIR, f"{clean_id}.json")
    if not os.path.exists(json_path):
        raise HTTPException(status_code=404, detail="Dictation not found")
        
    with open(json_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)
        
    metadata["name"] = payload.name.strip()
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f)
        
    return metadata

@router.delete("/dictations/{dict_id}")
def delete_dictation(dict_id: str) -> Dict[str, bool]:
    """
    Permanently delete a voice dictation recording and its associated metadata.

    Args:
        dict_id (str): Unique UUID of the dictation to remove.

    Returns:
        Dict[str, bool]: Success confirmation (`{"success": True}`).
    """
    clean_id = dict_id.strip()
    audio_path = os.path.join(DICTATIONS_DIR, f"{clean_id}.webm")
    json_path = os.path.join(DICTATIONS_DIR, f"{clean_id}.json")
    try:
        if os.path.exists(audio_path):
            os.remove(audio_path)
    except OSError:
        pass
    try:
        if os.path.exists(json_path):
            os.remove(json_path)
    except OSError:
        pass
    return {"success": True}

@router.post("/dictations/{dict_id}/transcribe")
def transcribe_dictation(dict_id: str) -> Dict[str, Any]:
    """
    Transcribe a saved voice dictation into text using OpenAI Whisper.

    Args:
        dict_id (str): UUID of the dictation recording.

    Returns:
        Dict[str, Any]: Updated dictation metadata containing the full transcript text.

    Raises:
        HTTPException: 404 if dictation files are not found.
    """
    clean_id = dict_id.strip()
    audio_path = os.path.join(DICTATIONS_DIR, f"{clean_id}.webm")
    json_path = os.path.join(DICTATIONS_DIR, f"{clean_id}.json")
    if not os.path.exists(json_path) or not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Dictation not found")
        
    try:
        segments = run_transcription_pipeline(
            audio_path=audio_path,
            model_name="base", 
            hf_token="",
            do_diarize=False,
            speaker_mapping={}
        )
        text = " ".join([s["text"].strip() for s in segments if "text" in s])
        
        with open(json_path, "r", encoding="utf-8") as f:
            metadata = json.load(f)
            
        metadata["transcript"] = text
        metadata["is_transcribed"] = True
        
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f)
            
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/dictations/{dict_id}/clean")
def clean_dictation_audio(dict_id: str) -> Dict[str, bool]:
    """
    Apply deep learning noise reduction and background filtering to a dictation audio file.

    Args:
        dict_id (str): UUID of the target dictation recording.

    Returns:
        Dict[str, bool]: Confirmation flag (`{"success": True}`).

    Raises:
        HTTPException: 404 if dictation is not found.
    """
    clean_id = dict_id.strip()
    audio_path = os.path.join(DICTATIONS_DIR, f"{clean_id}.webm")
    json_path = os.path.join(DICTATIONS_DIR, f"{clean_id}.json")
    if not os.path.exists(json_path) or not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Dictation not found")
        
    try:
        from utilities.audio_video.util_noise_reduction import apply_ai_noise_reduction
        apply_ai_noise_reduction(audio_path)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dictations/{dict_id}/audio")
def get_dictation_audio(dict_id: str) -> FileResponse:
    """
    Stream the raw webm audio file of a saved dictation recording.

    Args:
        dict_id (str): UUID of the target dictation.

    Returns:
        FileResponse: Binary audio/webm media stream.

    Raises:
        HTTPException: 404 if audio file does not exist.
    """
    clean_id = dict_id.strip()
    audio_path = os.path.join(DICTATIONS_DIR, f"{clean_id}.webm")
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(audio_path, media_type="audio/webm")

@router.get("/speaker-thumbnail/{file_id}")
def get_speaker_thumbnail(file_id: str, start: float) -> Dict[str, Optional[str]]:
    """
    Extract a cropped face thumbnail representing the active speaker at a given timestamp.

    Args:
        file_id (str): Video file identifier in the uploads cache.
        start (float): Timestamp in seconds where the speaker speaks.

    Returns:
        Dict[str, Optional[str]]: Base64 JPEG thumbnail string, or None if no face detected.

    Raises:
        HTTPException: 404 if media file does not exist.
    """
    clean_id = file_id.strip()
    temp_path = os.path.join(CACHE_DIR, clean_id)
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        thumb = extract_speaker_thumbnail(temp_path, max(0.0, start))
        if thumb is None:
            return {"image_base64": None}
            
        b64 = encode_cv2_image_to_base64(thumb, format=".jpg")
        img_b64 = b64.split(",")[-1] if "," in b64 else b64
        return {"image_base64": img_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/speaker-clip/{file_id}")
def get_speaker_clip(file_id: str, start: float, end: float) -> FileResponse:
    """
    Cut and export an isolated audio segment corresponding to a speaker segment.

    Args:
        file_id (str): Media file identifier.
        start (float): Clip start time in seconds.
        end (float): Clip end time in seconds.

    Returns:
        FileResponse: Extracted MP3 audio clip stream.

    Raises:
        HTTPException: 404 if file not found, 400 if start >= end.
    """
    clean_id = file_id.strip()
    if start < 0 or end <= start:
        raise HTTPException(status_code=400, detail="Invalid start/end time range.")
        
    temp_path = os.path.join(CACHE_DIR, clean_id)
    if not os.path.exists(temp_path):
        raise HTTPException(status_code=404, detail="File not found")
        
    clip_path = os.path.join(CACHE_DIR, f"{clean_id}_{start}_{end}.mp3")
    try:
        if os.path.exists(clip_path):
            return FileResponse(clip_path, media_type="audio/mpeg")
            
        success = extract_speaker_clip(temp_path, start, end, clip_path)
        if not success or not os.path.exists(clip_path):
            raise HTTPException(status_code=500, detail="Failed to extract audio clip")
            
        return FileResponse(clip_path, media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/export")
def export_subtitles(req: ExportRequest) -> Dict[str, str]:
    """
    Export transcribed and diarized segments into formatted SRT or ASS subtitle files.

    Args:
        req (ExportRequest): Segments, format, speaker aliases, and visual style presets.

    Returns:
        Dict[str, str]: Subtitle file content and recommended filename.

    Raises:
        HTTPException: 400 if format is unsupported, 500 on export error.
    """
    mapped_segments = req.segments
    if req.speaker_mapping:
        mapped_segments = apply_speaker_renames(req.segments, req.speaker_mapping)
        
    try:
        fmt = req.format.strip().lower()
        if fmt == "srt":
            content = export_srt(mapped_segments, identify_people=True)
            return {"content": content, "filename": "subtitles.srt"}
        elif fmt == "ass":
            actual_styles = {}
            for spk_id, preset_name in req.speaker_styles.items():
                if preset_name in STYLE_PRESETS:
                    actual_styles[spk_id] = STYLE_PRESETS[preset_name]
                    
            content = export_ass_multistyle(mapped_segments, actual_styles, True, req.style_preset)
            return {"content": content, "filename": "subtitles.ass"}
        else:
            raise HTTPException(status_code=400, detail="Unsupported format: expected 'srt' or 'ass'.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- OpenSubtitles Integration ---

@router.post("/fetcher/search")
def api_subtitle_fetcher_search(
    file_path: str = Form(..., min_length=1, description="Path or filename to search subtitles for"),
    os_api_key: str = Form(..., min_length=1, description="OpenSubtitles REST API key"),
    language: str = Form("en", min_length=2, max_length=10, description="ISO language code")
) -> Dict[str, Any]:
    """
    Search OpenSubtitles.com database for community subtitle tracks matching a video file.

    Args:
        file_path (str): Video file path or filename to hash/search.
        os_api_key (str): OpenSubtitles consumer API key.
        language (str, optional): Target language code. Defaults to 'en'.

    Returns:
        Dict[str, Any]: List of matching subtitle items with download IDs and ratings.

    Raises:
        HTTPException: 400 if search fails or credentials invalid.
    """
    try:
        success, results = search_opensubtitles(
            file_path=file_path.strip(),
            api_key=os_api_key.strip(),
            language=language.strip()
        )
        if not success:
            raise HTTPException(status_code=400, detail=results)
        return {"results": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fetcher/download")
def api_subtitle_fetcher_download(
    file_id: str = Form(..., min_length=1, description="OpenSubtitles file ID to download"),
    os_api_key: str = Form(..., min_length=1, description="OpenSubtitles REST API key")
) -> Response:
    """
    Download a subtitle file directly from OpenSubtitles and return as an attachment.

    Args:
        file_id (str): OpenSubtitles file ID.
        os_api_key (str): OpenSubtitles consumer API key.

    Returns:
        Response: Text response with content disposition attachment header.

    Raises:
        HTTPException: 400 if download fails.
    """
    try:
        success, content, filename = download_subtitle(file_id.strip(), os_api_key.strip())
        if not success:
            raise HTTPException(status_code=400, detail=content)
            
        safe_filename = filename.encode('ascii', 'ignore').decode('ascii')
        return Response(
            content=content,
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/merger/merge")
async def api_subtitle_merger_merge(
    base_file_hash: str = Form(..., min_length=1, description="Base ASS subtitle file hash"),
    overlay_file_hash: str = Form(..., min_length=1, description="Overlay ASS subtitle file hash")
) -> Response:
    """
    Merge two Advanced SubStation Alpha (.ass) subtitle files into a single compound track.

    Args:
        base_file_hash (str): Hash key of the base ASS subtitle file in uploads.
        overlay_file_hash (str): Hash key of the overlay ASS subtitle file in uploads.

    Returns:
        Response: Compound ASS subtitle file as a downloadable text stream.

    Raises:
        HTTPException: 400 if files are missing from cache, 500 on parse error.
    """
    base_path = os.path.join(CACHE_DIR, base_file_hash.strip())
    if not os.path.exists(base_path):
        raise HTTPException(status_code=400, detail="Base file not found in cache.")
        
    overlay_path = os.path.join(CACHE_DIR, overlay_file_hash.strip())
    if not os.path.exists(overlay_path):
        raise HTTPException(status_code=400, detail="Overlay file not found in cache.")
        
    try:
        success, result_path = merge_ass_files(base_path, overlay_path)
        if not success:
            raise HTTPException(status_code=500, detail=result_path)
            
        with open(result_path, "rb") as f:
            merged_content = f.read()
            
        try:
            os.unlink(result_path)
        except OSError:
            pass
            
        return Response(
            content=merged_content,
            media_type="text/plain",
            headers={"Content-Disposition": 'attachment; filename="merged_subtitle.ass"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Media Metadata & EXIF ---

class MediaTagsRequest(BaseModel):
    file_path: str = Field(..., min_length=1, description="Local path to audio/video media file.")
    title: str = Field("", description="Track title.")
    artist: str = Field("", description="Artist name.")
    album: str = Field("", description="Album name.")
    date: str = Field("", description="Release year or date string.")

@router.post("/tags/read")
def api_read_media_tags(req: MediaTagsRequest) -> Dict[str, Any]:
    """
    Read ID3/media tag metadata from an audio or video file.

    Args:
        req (MediaTagsRequest): File path payload.

    Returns:
        Dict[str, Any]: Tag key-value pairs (`{"tags": {...}}`).

    Raises:
        HTTPException: 404 if file does not exist, 500 on read error.
    """
    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail="File does not exist")
    try:
        tags = get_media_metadata(req.file_path)
        return {"tags": tags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tags/save")
def api_save_media_tags(req: MediaTagsRequest) -> Dict[str, str]:
    """
    Write updated ID3 / media tag values into an audio or video file.

    Args:
        req (MediaTagsRequest): Target file path and updated tag attributes.

    Returns:
        Dict[str, str]: Confirmation status message.

    Raises:
        HTTPException: 404 if file does not exist, 500 on write failure.
    """
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TimestampsRequest(BaseModel):
    file_path: str = Field(..., min_length=1, description="Local filesystem path to target file.")
    created: Optional[str] = Field(None, description="ISO datetime string for creation time.")
    modified: Optional[str] = Field(None, description="ISO datetime string for last modified time.")
    accessed: Optional[str] = Field(None, description="ISO datetime string for last access time.")

@router.post("/timestamps/read")
def api_read_timestamps(req: TimestampsRequest) -> Dict[str, Any]:
    """
    Inspect filesystem timestamps (creation, last modified, last accessed) for a local file.

    Args:
        req (TimestampsRequest): File path payload.

    Returns:
        Dict[str, Any]: ISO datetime strings for file timestamps.

    Raises:
        HTTPException: 404 if file does not exist, 500 on inspect failure.
    """
    if not os.path.exists(req.file_path):
        raise HTTPException(status_code=404, detail="File does not exist")
    try:
        ts = get_file_timestamps(req.file_path)
        return {
            "timestamps": {
                "created": ts.get("created").isoformat() if "created" in ts and ts["created"] else None,
                "modified": ts.get("modified").isoformat() if "modified" in ts and ts["modified"] else None,
                "accessed": ts.get("accessed").isoformat() if "accessed" in ts and ts["accessed"] else None
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/timestamps/save")
def api_save_timestamps(req: TimestampsRequest) -> Dict[str, str]:
    """
    Update filesystem metadata timestamps for a local file.

    Args:
        req (TimestampsRequest): File path and new timestamp values.

    Returns:
        Dict[str, str]: Confirmation message (`{"message": str}`).

    Raises:
        HTTPException: 404 if file does not exist, 500 on modification failure.
    """
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/exif/read")
async def api_read_exif(file_hash: str = Form(..., min_length=1, description="Uploaded image hash")) -> Dict[str, Any]:
    """
    Extract embedded EXIF metadata tags from an uploaded image file.

    Args:
        file_hash (str): Hash key of the image file in uploads cache.

    Returns:
        Dict[str, Any]: Extracted EXIF tags mapping (`{"exif": {...}}`).

    Raises:
        HTTPException: 400 if image not found or EXIF parsing fails.
    """
    clean_hash = file_hash.strip()
    tmp_path = os.path.join(CACHE_DIR, clean_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    try:
        with open(tmp_path, "rb") as f:
            content = f.read()
        success, exif_dict = get_exif_data(content)
        if not success:
            raise HTTPException(status_code=400, detail=str(exif_dict))
        return {"exif": exif_dict}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/exif/strip")
async def api_strip_exif(file_hash: str = Form(..., min_length=1, description="Uploaded image hash")) -> Response:
    """
    Strip all EXIF, GPS, and device metadata from an image file and return the anonymized image.

    Args:
        file_hash (str): Hash key of the image file in uploads cache.

    Returns:
        Response: Binary sanitized image file stream.

    Raises:
        HTTPException: 400 if file not found, 500 if EXIF stripping fails.
    """
    clean_hash = file_hash.strip()
    tmp_path = os.path.join(CACHE_DIR, clean_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    try:
        with open(tmp_path, "rb") as f:
            content = f.read()
        success, clean_bytes = strip_exif(content)
        if not success:
            raise HTTPException(status_code=500, detail=str(clean_bytes))
        
        safe_filename = "clean_" + clean_hash.encode('ascii', 'ignore').decode('ascii')
        
        return Response(
            content=clean_bytes,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

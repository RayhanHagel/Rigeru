import base64
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException


from utilities.audio_video.util_ffmpeg import process_video
from utilities.vision.util_image_compress import batch_compress_images
from utilities.audio_video.util_tts import (
    generate_cloned_speech,
    generate_cloned_speech_from_saved,
    generate_voice_design,
    list_saved_voices,
    save_voice,
    delete_voice,
)
from fastapi import UploadFile, File, Form, Response, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.concurrency import run_in_threadpool
import os
import tempfile
from utilities.core.util_config import load_all_config
from utilities.productivity_lifestyle.util_nlp import translate_text
import subprocess
import uuid
import shutil

router = APIRouter(prefix="/api/media-vision", tags=["Media & Vision"])

import threading
WEBCAM_STOP_EVENTS = {}

@router.post("/webcam/stop")
def api_stop_webcam(camera_index: int = Form(...)) -> Dict[str, str]:
    """
        Signal a running webcam video capture loop to cease execution.
    
        Args:
            camera_index (int): Index of the physical webcam device.
    
        Returns:
            Dict[str, str]: Status confirming camera was stopped or not found.
        """
    if camera_index in WEBCAM_STOP_EVENTS:
        WEBCAM_STOP_EVENTS[camera_index].set()
        return {"status": "stopped"}
    return {"status": "not_found"}

class TranslationRequest(BaseModel):
    text: str
    source_lang: str = "English"
    target_lang: str = "French"
    model_id: str | None = None

@router.post("/translation")
def api_translation(req: TranslationRequest) -> Dict[str, str]:
    """
        Translate text across supported languages using HuggingFace Helsinki-NLP models.
    
        Args:
            req (TranslationRequest): Text payload, source, target language, and optional model ID.
    
        Returns:
            Dict[str, str]: Translated text result (`{"translated_text": str}`).
    
        Raises:
            HTTPException: 400 if text is empty, 500 on model inference failure.
        """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    try:
        translated_text = translate_text(req.text, req.source_lang, req.target_lang, req.model_id)
        return {"translated_text": translated_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tts/clone")
async def api_tts_clone(
    text: str = Form(...),
    file_hash: str = Form(...),
    ref_text: str = Form(""),
    save_as: str = Form(""),  # optional: display name to save this voice under
) -> Response:
    """
        Synthesize cloned speech from reference audio using neural voice cloning.
    
        Args:
            text (str): Script to synthesize.
            file_hash (str): Hash identifier of the reference voice audio.
            ref_text (str, optional): Transcription of the reference audio. Defaults to "".
            save_as (str, optional): Name to persist this voice model profile. Defaults to "".
    
        Returns:
            Response: Audio WAV binary stream.
    
        Raises:
            HTTPException: 400 if text or audio is missing, 500 on synthesis error.
        """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if not file_hash:
        raise HTTPException(status_code=400, detail="No reference audio selected")

    temp_dir = os.path.join(".", "temp")
    os.makedirs(temp_dir, exist_ok=True)

    file_id = str(uuid.uuid4())
    ref_ext = os.path.splitext(file_hash)[1] or ".wav"
    ref_path = os.path.join(temp_dir, f"{file_id}_ref{ref_ext}")
    output_path = os.path.join(temp_dir, f"{file_id}_tts.wav")

    try:
        pass # File already in cache
        ref_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(ref_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")

        # Convert incoming audio to a clean 24kHz mono WAV (OmniVoice native rate)
        from utilities.audio_video.util_tts import format_audio_for_tts
        format_audio_for_tts(ref_path, ref_path)

        # Optionally save this voice for session reuse
        if save_as.strip():
            save_voice(file_id, ref_path, ref_text, save_as.strip())

        generate_cloned_speech(text, ref_path, output_path, ref_text=ref_text)

        with open(output_path, "rb") as f:
            audio_data = f.read()

        # Cleanup temp files (saved voice dir is separate)
        try:
            pass # do not delete cached upload
            os.remove(output_path)
        except Exception:
            pass

        return Response(content=audio_data, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tts/clone/from-saved")
async def api_tts_clone_from_saved(voice_id: str = Form(...), text: str = Form(...)) -> Response:
    """
        Synthesize speech using a previously saved neural voice clone profile.
    
        Args:
            voice_id (str): Saved voice profile identifier.
            text (str): Speech script to vocalize.
    
        Returns:
            Response: Audio WAV binary stream.
    
        Raises:
            HTTPException: 400 if text is empty, 404 if voice not found.
        """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    temp_dir = os.path.join(".", "temp")
    os.makedirs(temp_dir, exist_ok=True)
    output_path = os.path.join(temp_dir, f"{uuid.uuid4()}_tts.wav")

    try:
        generate_cloned_speech_from_saved(text, voice_id, output_path)
        with open(output_path, "rb") as f:
            audio_data = f.read()
        try:
            os.remove(output_path)
        except Exception:
            pass
        return Response(content=audio_data, media_type="audio/wav")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tts/voices")
def api_list_voices() -> Dict[str, List[Dict[str, Any]]]:
    """
        List all saved neural voice cloning profiles.
    
        Returns:
            Dict[str, List[Dict[str, Any]]]: Array of saved voice profile objects.
        """
    return {"voices": list_saved_voices()}


@router.delete("/tts/voices/{voice_id}")
def api_delete_voice(voice_id: str) -> Dict[str, bool]:
    """
        Delete a saved neural voice profile from disk.
    
        Args:
            voice_id (str): Voice profile ID to remove.
    
        Returns:
            Dict[str, bool]: Confirmation flag (`{"ok": True}`).
    
        Raises:
            HTTPException: 404 if voice profile not found.
        """
    try:
        delete_voice(voice_id)
        return {"ok": True}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tts/design")
async def api_tts_design(text: str = Form(...), speaker_attributes: str = Form(...)) -> Response:
    """
        Generate custom voice audio purely from descriptive natural language attributes.
    
        Args:
            text (str): Dialogue script to synthesize.
            speaker_attributes (str): Voice characteristics (e.g. gender, age, tone).
    
        Returns:
            Response: Audio WAV binary stream.
    
        Raises:
            HTTPException: 400 if inputs are empty, 500 on synthesis error.
        """
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if not speaker_attributes.strip():
        raise HTTPException(status_code=400, detail="Speaker attributes cannot be empty")

    temp_dir = os.path.join(".", "temp")
    os.makedirs(temp_dir, exist_ok=True)
    output_path = os.path.join(temp_dir, f"{uuid.uuid4()}_design.wav")

    try:
        generate_voice_design(text, output_path, speaker_attributes)
        with open(output_path, "rb") as f:
            audio_data = f.read()
        try:
            os.remove(output_path)
        except Exception:
            pass
        return Response(content=audio_data, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/video-to-gif")
async def api_video_to_gif(file_hash: str = Form(...), fps: int = Form(15), scale: int = Form(480)) -> FileResponse:
    """
        Transcode a video segment into an optimized animated GIF.
    
        Args:
            file_hash (str): Hash identifier of the source video in cache.
            fps (int, optional): Output framerate. Defaults to 15.
            scale (int, optional): Horizontal pixel scale. Defaults to 480.
    
        Returns:
            FileResponse: Converted GIF binary file stream.
    
        Raises:
            HTTPException: 400 if file is missing, 500 on transcoding error.
        """
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file selected")
        
    temp_dir = os.path.join(".", "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    output_path = os.path.join(temp_dir, f"{file_hash}_out.gif")
    
    try:
        input_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(input_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
            
        from utilities.audio_video.util_ffmpeg import convert_video_to_gif
        success, result_msg = convert_video_to_gif(input_path, output_path, fps=fps, scale=scale)
        if not success:
            raise Exception(result_msg)
            
        from fastapi.responses import FileResponse
        # Return the file and delete the input to save space
        try:
            pass # do not delete cached upload
        except:
            pass
            
        return FileResponse(output_path, media_type="image/gif", filename=f"converted_{fps}fps.gif")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/audio-trim")
async def api_audio_trim(file_hash: str = Form(...), start: float = Form(...), end: float = Form(...)) -> FileResponse:
    """
        Trim an audio track between specified start and end timestamps.
    
        Args:
            file_hash (str): Audio file hash in uploads cache.
            start (float): Start time offset in seconds.
            end (float): End time offset in seconds.
    
        Returns:
            FileResponse: Trimmed MP3 audio file stream.
    
        Raises:
            HTTPException: 400 if file is missing, 500 on trim error.
        """
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file selected")
        
    temp_dir = os.path.join(".", "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    file_id = str(uuid.uuid4())
    input_ext = os.path.splitext(file_hash)[1] or ".mp3"
    input_path = os.path.join(temp_dir, f"{file_id}_in{input_ext}")
    output_path = os.path.join(temp_dir, f"{file_id}_out{input_ext}")
    
    try:
        pass # File already in cache
        input_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(input_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
            
        from utilities.audio_video.util_ffmpeg import trim_audio
        success, result_msg = trim_audio(input_path, output_path, start, end)
        if not success:
            raise HTTPException(status_code=500, detail=result_msg)
            
        from fastapi.responses import FileResponse
        try:
            pass # do not delete cached upload
        except:
            pass
            
        
        if not os.path.exists(output_path):
            raise HTTPException(status_code=500, detail=f"FFmpeg succeeded but output file {output_path} was not created.")
            
        return FileResponse(output_path, media_type="audio/mpeg", filename=f"trimmed{input_ext}")
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/compress-video")
async def api_compress_video(
    file_hash: str = Form(...),
    output_dir: str = Form(...),
    start_time: float = Form(...),
    end_time: float = Form(...),
    target_res: str = Form(...),
    crf: int = Form(...),
    preset: str = Form(...),
    keep_audio: bool = Form(...),
    audio_codec: str = Form(...)
) -> Dict[str, Any]:
    """
        Compress and re-encode a video file with custom CRF, preset, and resolution.
    
        Args:
            file_hash (str): Video file hash in uploads cache.
            output_dir (str): Target directory for output file.
            start_time (float): Video clip start offset in seconds.
            end_time (float): Video clip end offset in seconds.
            target_res (str): Target resolution string (e.g. 1080p, 720p).
            crf (int): Constant Rate Factor compression value (0-51).
            preset (str): FFmpeg speed preset (e.g. fast, medium, slow).
            keep_audio (bool): Retain all original audio channels.
            audio_codec (str): Output audio codec (aac, mp3, copy).
    
        Returns:
            Dict[str, Any]: Status message and output file path.
    
        Raises:
            HTTPException: 400 if file missing, 500 on compression failure.
        """
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")

        success, msg = process_video(
            input_path=tmp_path,
            output_dir=output_dir,
            start_t=start_time,
            end_t=end_time,
            target_res=target_res,
            crf=crf,
            preset=preset,
            keep_all_audio=keep_audio,
            audio_codec=audio_codec
        )
        
        pass # do not delete cached upload
        
        if not success:
            raise HTTPException(status_code=500, detail=msg)
        return {"status": "success", "message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CompressImagesRequest(BaseModel):
    input_dir: str
    output_dir: str
    quality: int
    max_width: int
    max_height: int
    fit_mode: str

@router.post("/compress-images")
def api_compress_images(req: CompressImagesRequest) -> Dict[str, str]:
    """
        Batch compress and resize images within a directory using Pillow and mozjpeg.
    
        Args:
            req (CompressImagesRequest): Input directory, output directory, quality, and dimensions.
    
        Returns:
            Dict[str, str]: Operation outcome message.
    
        Raises:
            HTTPException: 500 if image compression fails.
        """
    try:
        success, msg = batch_compress_images(
            input_dir=req.input_dir,
            output_dir=req.output_dir,
            quality=req.quality,
            max_width=req.max_width if req.max_width > 0 else None,
            max_height=req.max_height if req.max_height > 0 else None,
            fit_mode=req.fit_mode
        )
        if not success:
            raise HTTPException(status_code=500, detail=msg)
        return {"status": "success", "message": msg}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.vision.util_upscale import upscale_image, get_compute_device
import io
import asyncio
from fastapi.responses import Response

@router.get("/upscaler-config")
def api_get_upscaler_config() -> Dict[str, List[str]]:
    """
        Query available hardware acceleration compute devices for Real-ESRGAN upscaling.
    
        Returns:
            Dict[str, List[str]]: Supported compute devices (e.g. cuda, cpu).
        """
    try:
        devices = get_compute_device()
        return {"devices": devices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upscale-image")
async def api_upscale_image(
    file_hash: str = Form(...)
) -> Response:
    """
        Super-resolve and upscale an image using Real-ESRGAN neural network.
    
        Args:
            file_hash (str): Image hash identifier in uploads cache.
            model (str, optional): Model architecture. Defaults to "RealESRGAN_x4plus".
            scale (int, optional): Upscaling multiplier. Defaults to 4.
            tile (int, optional): Tiling dimension for VRAM management. Defaults to 0.
            device (str, optional): Target compute device. Defaults to "Auto".
    
        Returns:
            Response: Upscaled PNG image binary stream.
    
        Raises:
            HTTPException: 400 if image missing, 500 on upscale failure.
        """
    config = load_all_config()
    scale = int(config.get("image_upscaler_scale", 4))
    device_pref = config.get("device_preference", "Auto-Detect")
    device = "cuda" if device_pref == "GPU Preference" else "cpu"
    
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")

        success, result = await asyncio.to_thread(upscale_image, tmp_path, scale=scale, device=device)
        pass # do not delete cached upload

        if not success:
            raise HTTPException(status_code=500, detail=str(result))

        # Convert PIL Image to BytesIO and return as raw image response
        img_byte_arr = io.BytesIO()
        result.save(img_byte_arr, format='PNG')
        img_byte_arr = img_byte_arr.getvalue()
        
        return Response(content=img_byte_arr, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upscale-image/batch")
async def api_upscale_image_batch(hashes: str = Form(...)) -> Dict[str, Any]:
    """
        Batch upscale multiple uploaded images and bundle results into a ZIP archive.
    
        Args:
            hashes (str): JSON list of image hashes in uploads cache.
            model (str, optional): Upscaler model. Defaults to "RealESRGAN_x4plus".
            scale (int, optional): Upscale factor. Defaults to 4.
            tile (int, optional): Tile size. Defaults to 0.
            device (str, optional): Hardware device. Defaults to "Auto".
    
        Returns:
            Dict[str, Any]: Archive URL and lists of processed image URLs.
    
        Raises:
            HTTPException: 400 if hashes invalid, 500 on batch failure.
        """
    import json, zipfile, uuid, shutil
    
    config = load_all_config()
    scale = int(config.get("image_upscaler_scale", 4))
    device_pref = config.get("device_preference", "Auto-Detect")
    device = "cuda" if device_pref == "GPU Preference" else "cpu"
    
    try:
        hash_list = json.loads(hashes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hashes format")
        
    if not hash_list:
        raise HTTPException(status_code=400, detail="No files provided")
        
    out_dir = os.path.join(".", "temp", f"upscale_batch_{uuid.uuid4().hex[:8]}")
    os.makedirs(out_dir, exist_ok=True)
    
    try:
        processed_files = []
        original_files = []
        for fhash in hash_list:
            tmp_path = os.path.join(".", "uploads", fhash)
            if not os.path.exists(tmp_path):
                continue

            success, result = await asyncio.to_thread(upscale_image, tmp_path, scale=scale, device=device)
            if success:
                out_filename = f"{fhash}_upscaled.png"
                out_path = os.path.join(out_dir, out_filename)
                
                # Convert PIL Image to PNG and save
                result.save(out_path, format='PNG')
                
                frontend_accessible_path = os.path.join(".", "temp", out_filename)
                shutil.copy2(out_path, frontend_accessible_path)
                
                processed_files.append(f"/temp/{out_filename}")
                original_files.append(f"/uploads/{fhash}")
                    
        # Zip the directory
        zip_filename = f"upscale_batch_{uuid.uuid4().hex[:8]}.zip"
        zip_path = os.path.join(".", "temp", zip_filename)
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


import base64

@router.post("/remove-background")
async def api_remove_background(file_hash: str = Form(...)) -> Dict[str, str]:
    """
        Remove background from an image using Rembg neural segmentation.
    
        Args:
            file_hash (str): Image hash identifier in uploads cache.
    
        Returns:
            Dict[str, str]: Base64-encoded PNG image with transparent alpha background.
    
        Raises:
            HTTPException: 400 if file missing, 500 on segmentation failure.
        """
    from utilities.vision.util_bg_remove import remove_image_background
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            content = f.read()
        success, result = await asyncio.to_thread(remove_image_background, content)
        
        if not success:
            raise HTTPException(status_code=500, detail=str(result))
            
        # result is PNG bytes. The frontend expects image_base64.
        b64_encoded = base64.b64encode(result).decode("utf-8")
        return {"image_base64": b64_encoded}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import zipfile
import tempfile
import json

@router.post("/remove-background/batch")
async def api_remove_background_batch(hashes: str = Form(...)) -> Dict[str, Any]:
    """
        Batch remove backgrounds from multiple images and return a ZIP package.
    
        Args:
            hashes (str): JSON-encoded list of image file hashes.
    
        Returns:
            Dict[str, Any]: Downloadable ZIP archive URL and processed image URLs.
    
        Raises:
            HTTPException: 400 if invalid JSON, 500 on processing failure.
        """
    try:
        hash_list = json.loads(hashes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hashes format")
        
    if not hash_list:
        raise HTTPException(status_code=400, detail="No files provided")
        
    out_dir = os.path.join(".", "temp", f"bg_remove_batch_{uuid.uuid4().hex[:8]}")
    os.makedirs(out_dir, exist_ok=True)
    
    try:
        processed_files = []
        original_files = []
        for fhash in hash_list:
            tmp_path = os.path.join(".", "uploads", fhash)
            if not os.path.exists(tmp_path):
                continue
            with open(tmp_path, "rb") as f:
                content = f.read()
            success, result = await asyncio.to_thread(remove_image_background, content)
            if success:
                out_filename = f"{fhash}_nobg.png"
                out_path = os.path.join(out_dir, out_filename)
                with open(out_path, "wb") as f:
                    f.write(result)
                
                # Copy to a static/temp accessible path for frontend preview
                frontend_accessible_path = os.path.join(".", "temp", out_filename)
                shutil.copy2(out_path, frontend_accessible_path)
                
                processed_files.append(f"/temp/{out_filename}")
                original_files.append(f"/uploads/{fhash}")
                    
        # Zip the directory
        zip_filename = f"bg_remove_batch_{uuid.uuid4().hex[:8]}.zip"
        zip_path = os.path.join(".", "temp", zip_filename)
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


from fastapi.background import BackgroundTasks

@router.post("/fisheye")
async def api_fisheye(
    background_tasks: BackgroundTasks,
    file_hash: str = Form(...),
    strength: float = Form(0.5)
) -> Dict[str, str]:
    """
        Apply optical fisheye lens distortion or barrel de-warping to an image.
    
        Args:
            file_hash (str): Image file hash in cache.
            distortion (float, optional): Distortion coefficient. Defaults to 0.5.
            zoom (float, optional): Digital focal zoom factor. Defaults to 1.0.
    
        Returns:
            Dict[str, str]: Base64-encoded distorted output image.
    
        Raises:
            HTTPException: 400 if image missing, 500 on transform failure.
        """
    from utilities.vision.util_fisheye import apply_fisheye
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")

        output_path = os.path.join(".", "temp", f"{uuid.uuid4()}_fisheye.jpg")
        
        await asyncio.to_thread(apply_fisheye, tmp_path, output_path, strength)

        background_tasks.add_task(cleanup_files, output_path)
        return FileResponse(output_path, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fisheye/batch")
async def api_fisheye_batch(
    hashes: str = Form(...),
    strength: float = Form(0.5)
) -> Dict[str, Any]:
    """
        Apply batch fisheye lens distortion across multiple images and package as ZIP.
    
        Args:
            hashes (str): JSON array of image file hashes.
            distortion (float, optional): Distortion strength. Defaults to 0.5.
            zoom (float, optional): Zoom factor. Defaults to 1.0.
    
        Returns:
            Dict[str, Any]: Output ZIP archive URL and image URL lists.
    
        Raises:
            HTTPException: 400 on invalid input, 500 on failure.
        """
    import json, zipfile, uuid, shutil
    try:
        hash_list = json.loads(hashes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hashes format")
        
    if not hash_list:
        raise HTTPException(status_code=400, detail="No files provided")
        
    out_dir = os.path.join(".", "temp", f"fisheye_batch_{uuid.uuid4().hex[:8]}")
    os.makedirs(out_dir, exist_ok=True)
    
    try:
        processed_files = []
        original_files = []
        for fhash in hash_list:
            tmp_path = os.path.join(".", "uploads", fhash)
            if not os.path.exists(tmp_path):
                continue
            
            out_filename = f"{fhash}_fisheye.jpg"
            out_path = os.path.join(out_dir, out_filename)
            await asyncio.to_thread(apply_fisheye, tmp_path, out_path, strength)
            
            # Copy to a static/temp accessible path for frontend preview
            frontend_accessible_path = os.path.join(".", "temp", out_filename)
            shutil.copy2(out_path, frontend_accessible_path)
            
            processed_files.append(f"/temp/{out_filename}")
            original_files.append(f"/uploads/{fhash}")
                    
        # Zip the directory
        zip_filename = f"fisheye_batch_{uuid.uuid4().hex[:8]}.zip"
        zip_path = os.path.join(".", "temp", zip_filename)
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

from utilities.vision.util_color_picker import get_color_from_coords

@router.post("/color-picker")
async def api_color_picker(
    file_hash: str = Form(...),
    x: int = Form(...),
    y: int = Form(...)
) -> Dict[str, Any]:
    """
        Sample the exact RGB and Hex color values at specific pixel coordinates in an image.
    
        Args:
            file_hash (str): Image hash in uploads cache.
            x (int): Horizontal pixel coordinate.
            y (int): Vertical pixel coordinate.
    
        Returns:
            Dict[str, Any]: Sampled RGB and Hex color values.
    
        Raises:
            HTTPException: 400 if coordinates out of bounds or image missing.
        """
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            content = f.read()
        success, result = get_color_from_coords(content, x, y)
        if not success:
            raise HTTPException(status_code=400, detail=str(result))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.vision.util_color_picker import get_color_palette

@router.post("/color-palette")
async def api_color_palette(
    file_hash: str = Form(...),
    num_colors: int = Form(5)
) -> Dict[str, Any]:
    """
        Extract dominant color palette from an image using k-means clustering.
    
        Args:
            file_hash (str): Image hash in uploads cache.
            num_colors (int, optional): Number of palette clusters. Defaults to 5.
    
        Returns:
            Dict[str, Any]: Array of dominant colors with hex codes and percentages.
    
        Raises:
            HTTPException: 400 if image missing, 500 on clustering failure.
        """
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            content = f.read()
        success, result = get_color_palette(content, num_colors)
        if not success:
            raise HTTPException(status_code=400, detail=str(result))
        return {"colors": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.vision.util_code_image import generate_carbon_image
from pydantic import BaseModel

class CodeToImageRequest(BaseModel):
    code: str
    language: str
    theme: str
    bg_color: str

@router.post("/code-to-image")
def api_code_to_image(req: CodeToImageRequest) -> Response:
    """
        Render styled syntax-highlighted code snippet image using Carbon/Pygments.
    
        Args:
            req (CodeToImageRequest): Source code, programming language, theme, and background.
    
        Returns:
            Response: PNG image binary stream.
    
        Raises:
            HTTPException: 400 if code is empty, 500 on rendering failure.
        """
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
        
    try:
        img_bytes = generate_carbon_image(
            code=req.code,
            language=req.language.lower(),
            theme=req.theme,
            bg_color=req.bg_color
        )
        # Returns bytes directly for the browser to render
        return Response(content=img_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.vision.util_depth_estimation import process_image_depth, process_video_depth
from fastapi.responses import FileResponse
from fastapi.background import BackgroundTasks

def cleanup_files(*paths) -> None:
    """
        Safely delete temporary files from disk without raising exceptions.
    
        Args:
            *paths: Variable list of file paths to remove.
    
        Returns:
            None
        """
    for p in paths:
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except:
                pass

@router.post("/depth-image")
async def api_depth_image(
    background_tasks: BackgroundTasks,
    file_hash: str = Form(...),
    colormap: str = Form(...),
    invert: bool = Form(...)
) -> FileResponse:
    """
        Estimate depth map for a single image using Depth Anything neural network.
    
        Args:
            background_tasks (BackgroundTasks): Task worker for post-response cleanup.
            file_hash (str): Image file hash in uploads cache.
            colormap (str): OpenCV colormap name (e.g. INFERNO, PLASMA, MAGMA).
            invert (bool): Invert depth gradients.
    
        Returns:
            FileResponse: Depth map JPEG image response.
    
        Raises:
            HTTPException: 400 if image missing, 500 on depth inference error.
        """
    config = load_all_config()
    model_size = config.get("depth_estimation", "Base")
    engine = config.get("global_compute_engine", "cpu")
    hw_opt = config.get("hardware_optimization", "PyTorch (Standard)")
    precision = "fp16" if "FP16" in hw_opt else ("int8" if "INT8" in hw_opt else "fp32")
    
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    try:
        success, out_path, msg = process_image_depth(
            input_path=tmp_path,
            model_size=model_size,
            engine=engine,
            precision=precision,
            colormap=colormap,
            invert=invert
        )
        if not success:
            pass # do not delete cached upload
            raise HTTPException(status_code=500, detail=msg)
            
        # Add cleanup to run after response is sent
        background_tasks.add_task(cleanup_files, out_path)
        
        return FileResponse(out_path, media_type="image/jpeg")
    except Exception as e:
        pass # do not delete cached upload
        raise HTTPException(status_code=500, detail=str(e))

from utilities.vision.util_webcam_fx import generate_depth_webcam_frames

@router.get("/depth-estimation/webcam-stream")
async def api_depth_webcam(
    request: Request,
    camera_index: int,
    colormap: str = "INFERNO",
    invert: bool = False,
    ai_fps: float = 5.0
) -> StreamingResponse:
    """
        Stream real-time webcam video with live neural depth estimation overlay.
    
        Args:
            request (Request): Client HTTP connection.
            camera_index (int): Hardware webcam device index.
            colormap (str, optional): Colormap palette. Defaults to "INFERNO".
            invert (bool, optional): Invert depth values. Defaults to False.
            ai_fps (float, optional): Inference rate limit. Defaults to 5.0.
    
        Returns:
            StreamingResponse: Multipart JPEG video frame stream.
        """
    import threading
    from fastapi.concurrency import run_in_threadpool
    stop_event = threading.Event()
    WEBCAM_STOP_EVENTS[camera_index] = stop_event

    async def stream_generator():
        it = generate_depth_webcam_frames(
            camera_index=camera_index,
            colormap=colormap,
            invert=invert,
            ai_fps=ai_fps,
            stop_event=stop_event
        )
        try:
            while True:
                if await request.is_disconnected():
                    stop_event.set()
                    break
                try:
                    chunk = await run_in_threadpool(next, it)
                    yield chunk
                except StopIteration:
                    break
                except Exception:
                    stop_event.set()
                    raise
        except Exception:
            stop_event.set()
        finally:
            stop_event.set()
            WEBCAM_STOP_EVENTS.pop(camera_index, None)

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.post("/depth-video")
async def api_depth_video(
    background_tasks: BackgroundTasks,
    file_hash: str = Form(...),
    colormap: str = Form(...),
    invert: bool = Form(...),
    encoder: str = Form(...),
    ai_fps: float = Form(5.0)
) -> FileResponse:
    """
        Generate a neural depth map video stream from an uploaded video file.
    
        Args:
            background_tasks (BackgroundTasks): Task worker for file cleanup.
            file_hash (str): Video file hash in uploads cache.
            colormap (str): Depth colormap name.
            invert (bool): Invert depth polarity.
            encoder (str): Video hardware encoder (e.g. libx264, h264_nvenc).
            ai_fps (float, optional): Neural processing framerate. Defaults to 5.0.
    
        Returns:
            FileResponse: Rendered MP4 depth video file.
    
        Raises:
            HTTPException: 400 if video missing, 500 on processing failure.
        """
    config = load_all_config()
    model_size = config.get("depth_estimation", "Base")
    engine = config.get("global_compute_engine", "cpu")
    hw_opt = config.get("hardware_optimization", "PyTorch (Standard)")
    precision = "fp16" if "FP16" in hw_opt else ("int8" if "INT8" in hw_opt else "fp32")
    
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    try:
        success, out_path, msg = process_video_depth(
            input_path=tmp_path,
            model_size=model_size,
            engine=engine,
            precision=precision,
            colormap=colormap,
            invert=invert,
            encoder=encoder,
            progress_hook=None,
            ai_fps=ai_fps
        )
        if not success:
            pass # do not delete cached upload
            raise HTTPException(status_code=500, detail=msg)
            
        background_tasks.add_task(cleanup_files, out_path)
        
        return FileResponse(out_path, media_type="video/mp4")
    except Exception as e:
        pass # do not delete cached upload
        raise HTTPException(status_code=500, detail=str(e))

from utilities.audio_video.util_ffmpeg import get_available_encoders

@router.get("/ffmpeg-encoders")
def api_get_ffmpeg_encoders() -> Dict[str, List[str]]:
    """
        Detect available hardware and software video encoders supported by the local FFmpeg build.
    
        Returns:
            Dict[str, List[str]]: Supported encoders list (`{"encoders": [...]}`).
        """
    try:
        return {"encoders": get_available_encoders()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from utilities.vision.util_object_detect import (
    load_yolo_model,
    analyze_image,
    render_image_boxes,
    process_video_object_detection,
    get_available_cameras,
    generate_webcam_frames
)
from fastapi.responses import StreamingResponse

@router.post("/object-detect/analyze")
async def api_od_analyze(
    file_hash: str = Form(...),
    conf_thresh: float = Form(...)
) -> Dict[str, List[Dict[str, Any]]]:
    """
        Detect objects in an image and return individual cropped entity bounding boxes.
    
        Args:
            file_hash (str): Image file hash in uploads cache.
            conf_thresh (float): Minimum confidence detection threshold (0.0 - 1.0).
    
        Returns:
            Dict[str, List[Dict[str, Any]]]: Detected objects with labels, boxes, and crops.
    
        Raises:
            HTTPException: 400 if image missing, 500 on YOLO detection error.
        """
    config = load_all_config()
    resolution = int(config.get("inference_resolution", 640))
    optimization = config.get("global_compute_engine", "cpu")
    
    try:
        yolo, msg = load_yolo_model(optimization, resolution)
        if yolo is None:
            raise HTTPException(status_code=500, detail=msg)
            
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            content = f.read()
            
        success, base_img, obj_data, err = analyze_image(content, yolo, resolution, conf_thresh)
        if not success:
            raise HTTPException(status_code=500, detail=err)
            
        import cv2
        import base64
        
        result_objs = []
        for obj in obj_data:
            is_success, buffer = cv2.imencode(".jpg", cv2.cvtColor(obj["crop"], cv2.COLOR_RGB2BGR))
            b64 = ""
            if is_success:
                b64 = "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")
                
            result_objs.append({
                "id": obj["id"],
                "label": obj["label"],
                "conf": obj["conf"],
                "crop": b64,
                "box": obj["box"]
            })
            
        return {"objects": result_objs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/object-detect/image")
async def api_od_image(
    file_hash: str = Form(...),
    conf_thresh: float = Form(...),
    selected_ids: str = Form(...) # JSON string of IDs
) -> Response:
    """
        Render annotated bounding boxes for detected objects onto an image.
    
        Args:
            file_hash (str): Image file hash in uploads cache.
            conf_thresh (float): Detection confidence threshold.
            selected_ids (str): JSON list of object IDs to render.
    
        Returns:
            Response: Rendered JPEG image with bounding boxes.
    
        Raises:
            HTTPException: 400 if image missing, 500 on detection failure.
        """
    config = load_all_config()
    model = config.get("object_detection", "yolov8n.pt")
    resolution = int(config.get("inference_resolution", 640))
    optimization = config.get("global_compute_engine", "cpu")
    
    try:
        import json
        sel_ids = json.loads(selected_ids)
        yolo, msg = load_yolo_model(optimization, resolution)
        if yolo is None:
            raise HTTPException(status_code=500, detail=msg)
            
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            content = f.read()
        success, base_img, obj_data, err = analyze_image(content, yolo, resolution, conf_thresh)
        
        if not success:
            raise HTTPException(status_code=500, detail=err)
            
        import cv2
        if not sel_ids:
            sel_ids = [obj["id"] for obj in obj_data]
            
        final_img = render_image_boxes(base_img, obj_data, sel_ids)
        is_success, buffer = cv2.imencode(".jpg", cv2.cvtColor(final_img, cv2.COLOR_RGB2BGR))
        if not is_success:
            raise HTTPException(status_code=500, detail="Failed to encode image")
            
        return Response(content=buffer.tobytes(), media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/object-detect/video")
async def api_od_video(
    background_tasks: BackgroundTasks,
    file_hash: str = Form(...),
    conf_thresh: float = Form(...),
    output_method: str = Form(...),
    encoder: str = Form(...),
    selected_classes: str = Form("[]"),
    ai_fps: float = Form(5.0),
    use_extrapolation: bool = Form(True)
) -> FileResponse:
    """
        Process video with YOLO object tracking and render bounding boxes onto output video.
    
        Args:
            background_tasks (BackgroundTasks): Task worker for cleanup.
            file_hash (str): Video file hash in uploads cache.
            conf_thresh (float): Minimum confidence threshold.
            output_method (str): Output format choice.
            encoder (str): FFmpeg video encoder.
            selected_classes (str, optional): JSON list of target classes. Defaults to "[]".
            ai_fps (float, optional): Inference sampling rate. Defaults to 5.0.
            use_extrapolation (bool, optional): Smooth trajectories between AI frames. Defaults to True.
    
        Returns:
            FileResponse: Annotated MP4 video file stream.
    
        Raises:
            HTTPException: 400 if video missing, 500 on inference failure.
        """
    config = load_all_config()
    model = config.get("object_detection", "yolov8n.pt")
    resolution = int(config.get("inference_resolution", 640))
    optimization = config.get("hardware_optimization", "PyTorch (Standard)")

    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    try:
        yolo, msg = load_yolo_model(optimization, resolution)
        if yolo is None:
            pass # do not delete cached upload
            raise HTTPException(status_code=500, detail=msg)
            
        import json
        sel_classes = json.loads(selected_classes)
        success, out_path = process_video_object_detection(
            input_path=tmp_path,
            model=yolo,
            resolution=resolution,
            conf_thresh=conf_thresh,
            output_method=output_method,
            progress_hook=None,
            encoder=encoder,
            selected_classes=sel_classes,
            ai_fps=ai_fps,
            use_extrapolation=use_extrapolation
        )
        if not success:
            pass # do not delete cached upload
            raise HTTPException(status_code=500, detail=out_path)
            
        background_tasks.add_task(cleanup_files, tmp_path, out_path)
        mime = "text/plain" if output_method == "subtitle" else "video/mp4"
        return FileResponse(out_path, media_type=mime)
    except Exception as e:
        pass # do not delete cached upload
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/object-detect/cameras")
def api_od_cameras() -> Dict[str, List[Dict[str, Any]]]:
    """
        Enumerate all connected webcam capture devices available on the system.
    
        Returns:
            Dict[str, List[Dict[str, Any]]]: Discovered camera devices list.
        """
    return {"cameras": get_available_cameras()}

@router.post("/object-detect/webcam-config")
def api_od_webcam_config(camera_index: int = Form(...), ai_fps: float = Form(...), selected_classes: str = Form("")) -> Dict[str, str]:
    """
        Update dynamic runtime detection parameters for an active webcam stream.
    
        Args:
            req (Dict[str, Any]): Dictionary of updated parameters.
    
        Returns:
            Dict[str, str]: Confirmation message (`{"status": "ok"}`).
        """
    from utilities.vision.util_object_detect import update_webcam_config
    update_webcam_config(camera_index, ai_fps, selected_classes)
    return {"status": "ok"}

@router.get("/object-detect/webcam-stream")
async def api_od_webcam_stream(
    request: Request,
    conf_thresh: float,
    camera_index: int,
    use_extrapolation: bool = False
) -> StreamingResponse:
    """
        Stream real-time webcam video with live YOLO object detection bounding boxes.
    
        Args:
            request (Request): Client HTTP connection.
            camera_index (int): Webcam hardware device index.
            conf_thresh (float, optional): Detection threshold. Defaults to 0.5.
            ai_fps (float, optional): Inference frame rate. Defaults to 5.0.
    
        Returns:
            StreamingResponse: Multipart JPEG video frame stream.
        """
    config = load_all_config()
    model = config.get("object_detection", "yolov8n.pt")
    resolution = int(config.get("inference_resolution", 640))
    optimization = config.get("hardware_optimization", "PyTorch (Standard)")
    
    yolo, msg = load_yolo_model(optimization, resolution)
    if yolo is None:
        raise HTTPException(status_code=500, detail=msg)
        
    import threading
    stop_event = threading.Event()
    WEBCAM_STOP_EVENTS[camera_index] = stop_event

    async def stream_generator():
        print(f"DEBUG: Starting stream generator for camera {camera_index}")
        it = generate_webcam_frames(
            model=yolo,
            camera_index=camera_index,
            resolution=resolution,
            conf_thresh=conf_thresh,
            target_height=600,
            use_extrapolation=use_extrapolation,
            stop_event=stop_event
        )
        try:
            while True:
                if await request.is_disconnected():
                    print("DEBUG: Request is disconnected via await request.is_disconnected()")
                    stop_event.set()
                    break
                try:
                    chunk = await run_in_threadpool(next, it)
                    yield chunk
                except StopIteration:
                    print("DEBUG: StopIteration from generator")
                    break
                except Exception as e:
                    print(f"DEBUG: Exception during yield or next: {repr(e)}")
                    stop_event.set()
                    raise
        except Exception as e:
            print(f"Webcam stream error: {repr(e)}")
            stop_event.set()
        finally:
            stop_event.set()
            WEBCAM_STOP_EVENTS.pop(camera_index, None)
            print("DEBUG: stream_generator finished")

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

from utilities.vision.util_face_blur import scan_faces, process_media_blur, save_frame_cache
import json

@router.post("/face-blur/scan")
async def api_fb_scan(
    file_hash: str = Form(...),
    fps_scan: float = Form(5.0),
    clustering_method: str = Form("None"),
    cluster_threshold: float = Form(0.50)
) -> Dict[str, Any]:
    """
        Detect and locate all human faces in an image using InsightFace/Haar Cascades.
    
        Args:
            file_hash (str): Image file hash in uploads cache.
    
        Returns:
            Dict[str, Any]: Detected face bounding boxes, crops, and metadata.
    
        Raises:
            HTTPException: 400 if image missing, 500 on face scan failure.
        """
    config = load_all_config()
    det_model = config.get("face_blur", "buffalo_l")
    rec_model = config.get("face_blur", "buffalo_l")
    det_size = int(config.get("inference_resolution", 640))
    hw_opt = config.get("hardware_optimization", "PyTorch (Standard)")
    precision = "fp16" if "FP16" in hw_opt else ("int8" if "INT8" in hw_opt else "fp32")
    
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    tmp_path = os.path.join(".", "uploads", file_hash)
    if not os.path.exists(tmp_path):
        raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        
    try:
        success, preview_img, face_data, frame_cache, msg = scan_faces(
            input_path=tmp_path,
            rec_model=rec_model if rec_model else None,
            precision=precision,
            sample_fps=fps_scan,
            clustering_method=clustering_method,
            cluster_threshold=cluster_threshold,
            det_size=det_size,
            progress_hook=None
        )
        
        if not success:
            pass # do not delete cached upload
            raise HTTPException(status_code=500, detail=msg)
            
        import cv2
        import base64
        
        # We need to base64 encode the crops in face_data so JSON can send them
        for face in face_data:
            if 'crop' in face:
                from utilities.vision.util_image_fx import encode_cv2_image_to_base64
                b64 = encode_cv2_image_to_base64(face['crop'], format=".jpg")
                if b64:
                    face['crop_b64'] = b64.split(",")[-1] if "," in b64 else b64
                del face['crop'] # Can't serialize numpy array

        frame_cache_path = None
        if frame_cache:
            frame_cache_path = save_frame_cache(frame_cache, tmp_path)
            
        return {
            "success": True,
            "face_data": face_data,
            "input_path": tmp_path,
            "frame_cache_path": frame_cache_path
        }
    except Exception as e:
        pass # do not delete cached upload
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/face-blur/scan-folder")
async def api_fb_scan_folder(
    folder_path: str = Form(...),
    fps_scan: float = Form(5.0),
    cluster_threshold: float = Form(0.50)
) -> Dict[str, Any]:
    """
        Scan an entire directory of images for human faces and cluster unique identities.
    
        Args:
            folder_path (str): Local filesystem folder path.
    
        Returns:
            Dict[str, Any]: Scanned images, detected face clusters, and thumbnails.
    
        Raises:
            HTTPException: 400 if folder does not exist, 500 on scan failure.
        """
    config = load_all_config()
    rec_model = config.get("face_blur", "buffalo_l")
    det_size = int(config.get("inference_resolution", 640))
    hw_opt = config.get("hardware_optimization", "PyTorch (Standard)")
    precision = "fp16" if "FP16" in hw_opt else ("int8" if "INT8" in hw_opt else "fp32")
    
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail="Invalid folder path")
        
    try:
        from utilities.vision.util_face_blur_folder import scan_folder_faces
        success, face_data, msg = scan_folder_faces(
            folder_path=folder_path,
            rec_model=rec_model if rec_model else None,
            precision=precision,
            sample_fps=fps_scan,
            cluster_threshold=cluster_threshold,
            det_size=det_size,
            progress_hook=None
        )
        
        if not success:
            raise HTTPException(status_code=500, detail=msg)
            
        from utilities.vision.util_image_fx import encode_cv2_image_to_base64
        
        for face in face_data:
            if 'crop' in face:
                b64 = encode_cv2_image_to_base64(face['crop'], format=".jpg")
                if b64:
                    face['crop_b64'] = b64.split(",")[-1] if "," in b64 else b64
                del face['crop']
                
            face.pop('_emb_sum', None)

        return {
            "success": True,
            "face_data": face_data,
            "input_path": folder_path,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/face-blur/serve-image")
def api_fb_serve_image(path: str) -> FileResponse:
    """
        Serve an image file directly from a local scanned directory.
    
        Args:
            path (str): Local file path.
    
        Returns:
            FileResponse: Binary image stream.
    
        Raises:
            HTTPException: 404 if file does not exist.
        """
    import os
    from fastapi.responses import FileResponse
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path)

@router.post("/face-blur/process-folder")
async def api_fb_process_folder(
    folder_path: str = Form(...),
    blur_intensity: int = Form(50),
    blur_style: str = Form("Gaussian"),
    selected_faces: str = Form(...),
    fps_scan: float = Form(5.0),
    gap_limit: float = Form(1.0),
    match_threshold: float = Form(0.50),
    encoder: str = Form("libx264"),
    output_method: str = Form("reencode")
) -> Dict[str, Any]:
    """
        Apply face blurring or masking across all images in a target folder.
    
        Args:
            req (FolderProcessRequest): Folder path, blur style, and selected face IDs.
    
        Returns:
            Dict[str, Any]: Processing summary and output paths.
    
        Raises:
            HTTPException: 400 if folder invalid, 500 on processing failure.
        """
    try:
        sel_faces = json.loads(selected_faces)
        if not sel_faces:
            raise HTTPException(status_code=400, detail="No faces selected.")
            
        from utilities.vision.util_face_blur_folder import process_folder_blur
        success, out_dir = process_folder_blur(
            folder_path=folder_path,
            selected_faces=sel_faces,
            blur_intensity=blur_intensity,
            blur_style=blur_style,
            fps_scan=fps_scan,
            gap_limit=gap_limit,
            match_threshold=match_threshold,
            encoder=encoder,
            output_method=output_method
        )
        if not success:
            raise HTTPException(status_code=500, detail="Failed to process folder")
            
        return {"success": True, "output_dir": out_dir}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.vision.util_webcam_fx import generate_face_blur_webcam_frames
from fastapi.responses import StreamingResponse

@router.get("/face-blur/webcam-stream")
async def api_face_blur_webcam(
    request: Request,
    conf_thresh: float,
    camera_index: int,
    blur_intensity: int = 50,
    blur_type: str = "Gaussian",
    ai_fps: float = 5.0,
    use_extrapolation: bool = True
) -> StreamingResponse:
    """\n    Stream webcam video with real-time facial anonymization / face blurring.\n\n    Args:\n        request (Request): Active connection.\n        camera_index (int): Hardware camera index.\n        blur_type (str, optional): Anonymization style ("gaussian", "pixelate", "solid"). Defaults to "gaussian".\n        blur_strength (int, optional): Blur kernel radius. Defaults to 25.\n\n    Returns:\n        StreamingResponse: Multipart JPEG video frame stream.\n    """
    import threading
    from fastapi.concurrency import run_in_threadpool
    stop_event = threading.Event()
    WEBCAM_STOP_EVENTS[camera_index] = stop_event

    async def stream_generator():
        it = generate_face_blur_webcam_frames(
            camera_index=camera_index,
            conf_thresh=conf_thresh,
            blur_type=blur_type,
            blur_strength=blur_intensity,
            ai_fps=ai_fps,
            use_extrapolation=use_extrapolation,
            stop_event=stop_event
        )
        try:
            while True:
                if await request.is_disconnected():
                    stop_event.set()
                    break
                try:
                    chunk = await run_in_threadpool(next, it)
                    yield chunk
                except StopIteration:
                    break
                except Exception:
                    stop_event.set()
                    raise
        except Exception:
            stop_event.set()
        finally:
            stop_event.set()
            WEBCAM_STOP_EVENTS.pop(camera_index, None)

    return StreamingResponse(
        stream_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.post("/face-blur/process")
async def api_fb_process(
    background_tasks: BackgroundTasks,
    input_path: str = Form(...),
    frame_cache_path: str = Form(""),
    blur_intensity: int = Form(50),
    blur_style: str = Form("Gaussian"),
    selected_faces: str = Form(...), # JSON string
    fps_scan: float = Form(5.0),
    gap_limit: float = Form(1.0),
    match_threshold: float = Form(0.50),
    encoder: str = Form("libx264"),
    output_method: str = Form("reencode"),
    use_extrapolation: bool = Form(True)
) -> FileResponse:
    """
        Anonymize selected faces in an image or video using Gaussian blur or pixelation.
    
        Args:
            background_tasks (BackgroundTasks): Task worker for file cleanup.
            file_hash (str): Media file hash in cache.
            blur_type (str): Anonymization effect (gaussian, pixelate, blackout).
            blur_strength (int): Kernel intensity.
            selected_faces (str): JSON list of target face IDs.
            target_res (str, optional): Video output resolution. Defaults to "Original".
            encoder (str, optional): FFmpeg video encoder. Defaults to "libx264".
            ai_fps (float, optional): Tracking framerate. Defaults to 5.0.
    
        Returns:
            FileResponse: Processed media file stream.
    
        Raises:
            HTTPException: 400 if media missing, 500 on processing failure.
        """
    try:
        sel_faces = json.loads(selected_faces)
        if not sel_faces:
            raise HTTPException(status_code=400, detail="No faces selected.")
            
        success, out_path = process_media_blur(
            input_path=input_path,
            blur_intensity=blur_intensity,
            blur_type=blur_style,
            selected_faces=sel_faces,
            scan_fps=fps_scan,
            drop_limit_sec=gap_limit,
            match_threshold=match_threshold,
            encoder=encoder if output_method != "subtitle" else None,
            output_method=output_method,
            frame_cache=frame_cache_path if frame_cache_path else None,
            progress_hook=None,
            use_extrapolation=use_extrapolation
        )
        
        if not success:
            raise HTTPException(status_code=500, detail=out_path)
            
        # Clean up everything!
        paths_to_delete = [input_path, out_path]
        if frame_cache_path:
            paths_to_delete.append(frame_cache_path)
            
        background_tasks.add_task(cleanup_files, *paths_to_delete)
        
        if out_path.endswith('.ass'):
            mime = "text/plain"
        elif out_path.endswith(('.png', '.jpg', '.jpeg')):
            mime = "image/jpeg"
        else:
            mime = "video/mp4"
            
        return FileResponse(out_path, media_type=mime)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.vision.util_censor import process_media_censor
import json

@router.post("/vision-censor")
async def api_vision_censor(
    background_tasks: BackgroundTasks,
    file_hash: str = Form(...),
    selected_labels: str = Form(...), # JSON list of strings
    scan_fps: float = Form(2.0),
    method: str = Form("reencode"),
    model_type: str = Form("320n.onnx"),
    engine: str = Form("cpu"),
    precision: str = Form("fp32"),
    blur_intensity: int = Form(50),
    blur_type: str = Form("Gaussian"),
    encoder: str = Form("libx264")
) -> Dict[str, str]:
    """
        Detect and redact NSFW content or nudity in an image using neural classification.
    
        Args:
            file_hash (str): Image hash in uploads cache.
            redact_type (str, optional): Censor style (blackout, blur, pixelate). Defaults to blackout.
            blur_strength (int, optional): Blur strength. Defaults to 30.
    
        Returns:
            Dict[str, str]: Base64-encoded sanitized image.
    
        Raises:
            HTTPException: 400 if image missing, 500 on censor failure.
        """
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    try:
        labels = json.loads(selected_labels)
        if not labels:
            raise HTTPException(status_code=400, detail="No labels selected.")
            
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")

            
        success, out_path = process_media_censor(
            input_path=tmp_path,
            target_classes=labels,
            scan_fps=scan_fps,
            method=method,
            model_type=model_type,
            engine=engine,
            precision=precision,
            blur_intensity=blur_intensity,
            blur_type=blur_type,
            encoder=encoder if method != "subtitle" else None,
            progress_hook=None
        )
        
        if not success:
            raise HTTPException(status_code=500, detail=out_path)
            
        # Clean up only the output file, keep the cached upload
        paths_to_delete = [out_path]
        background_tasks.add_task(cleanup_files, *paths_to_delete)
        
        if out_path.endswith('.ass'):
            mime = "text/plain"
        elif out_path.endswith(('.png', '.jpg', '.jpeg', '.webp')):
            mime = "image/png"
        else:
            mime = "video/mp4"
            
        return FileResponse(out_path, media_type=mime)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vision-censor/batch")
async def api_vision_censor_batch(
    background_tasks: BackgroundTasks,
    hashes: str = Form(...),
    selected_labels: str = Form(...),
    scan_fps: float = Form(2.0),
    method: str = Form("reencode"),
    model_type: str = Form("320n.onnx"),
    engine: str = Form("cpu"),
    precision: str = Form("fp32"),
    blur_intensity: int = Form(50),
    blur_type: str = Form("Gaussian"),
    encoder: str = Form("libx264")
) -> Dict[str, Any]:
    """
        Batch censor NSFW regions across multiple images and package into a ZIP archive.
    
        Args:
            hashes (str): JSON list of image file hashes.
            redact_type (str, optional): Redaction visual style. Defaults to blackout.
            blur_strength (int, optional): Blur kernel radius. Defaults to 30.
    
        Returns:
            Dict[str, Any]: Downloadable ZIP archive URL and processed image URLs.
    
        Raises:
            HTTPException: 400 if invalid JSON, 500 on processing failure.
        """
    import json, zipfile, uuid, shutil, asyncio
    
    try:
        hash_list = json.loads(hashes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hashes format")
        
    if not hash_list:
        raise HTTPException(status_code=400, detail="No files provided")
        
    try:
        labels = json.loads(selected_labels)
        if not labels:
            raise HTTPException(status_code=400, detail="No labels selected.")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid labels format")
        
    out_dir = os.path.join(".", "temp", f"vision_censor_batch_{uuid.uuid4().hex[:8]}")
    os.makedirs(out_dir, exist_ok=True)
    
    try:
        processed_files = []
        original_files = []
        
        for fhash in hash_list:
            tmp_path = os.path.join(".", "uploads", fhash)
            if not os.path.exists(tmp_path):
                continue

            success, out_path = await asyncio.to_thread(
                process_media_censor,
                input_path=tmp_path,
                target_classes=labels,
                scan_fps=scan_fps,
                method=method,
                model_type=model_type,
                engine=engine,
                precision=precision,
                blur_intensity=blur_intensity,
                blur_type=blur_type,
                encoder=encoder if method != "subtitle" else None,
                progress_hook=None
            )
            
            if success and os.path.exists(out_path):
                out_filename = os.path.basename(out_path)
                frontend_accessible_path = os.path.join(".", "temp", out_filename)
                shutil.copy2(out_path, frontend_accessible_path)
                
                # We can also put it in the zip directory
                zip_item_path = os.path.join(out_dir, out_filename)
                shutil.copy2(out_path, zip_item_path)
                
                processed_files.append(f"/temp/{out_filename}")
                original_files.append(f"/uploads/{fhash}")
                
                try:
                    os.remove(out_path)
                except Exception:
                    pass
                    
        # Zip the directory
        zip_filename = f"vision_censor_batch_{uuid.uuid4().hex[:8]}.zip"
        zip_path = os.path.join(".", "temp", zip_filename)
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(out_dir):
                for file in files:
                    zipf.write(os.path.join(root, file), file)
                    
        # Clean up out_dir
        shutil.rmtree(out_dir, ignore_errors=True)
        
        return {
            "zip_url": f"/temp/{zip_filename}",
            "processed_urls": processed_files,
            "original_urls": original_files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

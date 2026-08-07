import base64
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from utilities.util_code_image import generate_carbon_image
from utilities.util_bg_remove import remove_image_background
from utilities.util_ffmpeg import process_video
from utilities.util_image_compress import batch_compress_images
from utilities.util_tts import (
    generate_cloned_speech,
    generate_cloned_speech_from_saved,
    generate_voice_design,
    list_saved_voices,
    save_voice,
    delete_voice,
)
from fastapi import UploadFile, File, Form, Response
import os
import tempfile
from utilities.util_config import load_all_config
from utilities.util_nlp import translate_text
import subprocess
import uuid
import shutil

router = APIRouter(prefix="/api/media-vision", tags=["Media & Vision"])

class TranslationRequest(BaseModel):
    text: str
    source_lang: str = "English"
    target_lang: str = "French"
    model_id: str | None = None

@router.post("/translation")
def api_translation(req: TranslationRequest):
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
):
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    if not file_hash:
        raise HTTPException(status_code=400, detail="No reference audio selected")

    temp_dir = os.path.join(".", "temp")
    os.makedirs(temp_dir, exist_ok=True)

    file_id = str(uuid.uuid4())
    ref_ext = os.path.splitext(file.filename)[1] or ".wav"
    ref_path = os.path.join(temp_dir, f"{file_id}_ref{ref_ext}")
    output_path = os.path.join(temp_dir, f"{file_id}_tts.wav")

    try:
        pass # File already in cache
        ref_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(ref_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")

        # Convert incoming audio to a clean 24kHz mono WAV (OmniVoice native rate)
        from utilities.util_tts import format_audio_for_tts
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
async def api_tts_clone_from_saved(voice_id: str = Form(...), text: str = Form(...)):
    """Generate speech using a previously saved voice."""
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
def api_list_voices():
    """List all saved voices."""
    return {"voices": list_saved_voices()}


@router.delete("/tts/voices/{voice_id}")
def api_delete_voice(voice_id: str):
    """Delete a saved voice by ID."""
    try:
        delete_voice(voice_id)
        return {"ok": True}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tts/design")
async def api_tts_design(text: str = Form(...), speaker_attributes: str = Form(...)):
    """Generate speech using Voice Design (no reference audio needed)."""
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
async def api_video_to_gif(file_hash: str = Form(...), fps: int = Form(15), scale: int = Form(480)):
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file selected")
        
    temp_dir = os.path.join(".", "temp")
    os.makedirs(temp_dir, exist_ok=True)
    
    output_path = os.path.join(temp_dir, f"{file_hash}_out.gif")
    
    try:
        input_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(input_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
            
        from utilities.util_ffmpeg import convert_video_to_gif
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
async def api_audio_trim(file_hash: str = Form(...), start: float = Form(...), end: float = Form(...)):
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
            
        from utilities.util_ffmpeg import trim_audio
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

class CodeToImageRequest(BaseModel):
    code: str
    language: str = "Auto"
    theme: str = "monokai"
    bg_color: str = "#ABB8C3"

@router.post("/code-to-image")
def api_code_to_image(req: CodeToImageRequest):
    if not req.code.strip():
        raise HTTPException(status_code=400, detail="Code cannot be empty")
        
    try:
        img_bytes = generate_carbon_image(
            code=req.code,
            language=req.language.lower(),
            theme=req.theme,
            bg_color=req.bg_color
        )
        img_b64 = base64.b64encode(img_bytes).decode('utf-8')
        return {"image_base64": img_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/remove-background")
async def api_remove_background(file_hash: str = Form(...)):
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file selected")
    
    try:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            content = f.read()
        success, result = remove_image_background(content)
        if not success:
            raise HTTPException(status_code=500, detail=result)
            
        img_b64 = base64.b64encode(result).decode('utf-8')
        return {"image_base64": img_b64}
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
):
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
def api_compress_images(req: CompressImagesRequest):
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

from utilities.util_upscale import upscale_image, get_compute_device
import io
from fastapi.responses import Response

@router.get("/upscaler-config")
def api_get_upscaler_config():
    try:
        devices = get_compute_device()
        return {"devices": devices}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upscale-image")
async def api_upscale_image(
    file_hash: str = Form(...)
):
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

        success, result = upscale_image(tmp_path, scale=scale, device=device)
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
async def api_upscale_image_batch(hashes: str = Form(...)):
    """Batch process multiple files for image upscaler."""
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

            success, result = upscale_image(tmp_path, scale=scale, device=device)
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


from utilities.util_bg_remove import remove_image_background
import base64

@router.post("/remove-background")
async def api_remove_background(file_hash: str = Form(...)):
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")
        with open(tmp_path, "rb") as f:
            content = f.read()
        success, result = remove_image_background(content)
        
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
async def api_remove_background_batch(hashes: str = Form(...)):
    """Batch process multiple files. `hashes` is a JSON string of a list of hash strings."""
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
            success, result = remove_image_background(content)
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


from utilities.util_fisheye import apply_fisheye
from fastapi.background import BackgroundTasks

@router.post("/fisheye")
async def api_fisheye(
    background_tasks: BackgroundTasks,
    file_hash: str = Form(...),
    strength: float = Form(0.5)
):
    if not file_hash:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        tmp_path = os.path.join(".", "uploads", file_hash)
        if not os.path.exists(tmp_path):
            raise HTTPException(status_code=400, detail="Uploaded file not found in cache.")

        output_path = os.path.join(".", "temp", f"{uuid.uuid4()}_fisheye.jpg")
        
        apply_fisheye(tmp_path, output_path, strength)

        background_tasks.add_task(cleanup_files, output_path)
        return FileResponse(output_path, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/fisheye/batch")
async def api_fisheye_batch(
    hashes: str = Form(...),
    strength: float = Form(0.5)
):
    """Batch process multiple files for fisheye. `hashes` is a JSON string of a list of hash strings."""
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
            apply_fisheye(tmp_path, out_path, strength)
            
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

from utilities.util_color_picker import get_color_from_coords

@router.post("/color-picker")
async def api_color_picker(
    file_hash: str = Form(...),
    x: int = Form(...),
    y: int = Form(...)
):
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

from utilities.util_color_picker import get_color_palette

@router.post("/color-palette")
async def api_color_palette(
    file_hash: str = Form(...),
    num_colors: int = Form(5)
):
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

from utilities.util_code_image import generate_carbon_image
from pydantic import BaseModel

class CodeToImageRequest(BaseModel):
    code: str
    language: str
    theme: str
    bg_color: str

@router.post("/code-to-image")
def api_code_to_image(req: CodeToImageRequest):
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

from utilities.util_depth_estimation import process_image_depth, process_video_depth
from fastapi.responses import FileResponse
from fastapi.background import BackgroundTasks

def cleanup_files(*paths):
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
):
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

from utilities.util_webcam_fx import generate_depth_webcam_frames

@router.get("/depth-estimation/webcam-stream")
def api_depth_webcam(
    camera_index: int,
    colormap: str = "INFERNO",
    invert: bool = False
):
    try:
        return StreamingResponse(
            generate_depth_webcam_frames(
                camera_index=camera_index,
                colormap=colormap,
                invert=invert
            ),
            media_type="multipart/x-mixed-replace; boundary=frame"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/depth-video")
async def api_depth_video(
    background_tasks: BackgroundTasks,
    file_hash: str = Form(...),
    colormap: str = Form(...),
    invert: bool = Form(...),
    encoder: str = Form(...)
):
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
            progress_hook=None
        )
        if not success:
            pass # do not delete cached upload
            raise HTTPException(status_code=500, detail=msg)
            
        background_tasks.add_task(cleanup_files, out_path)
        
        return FileResponse(out_path, media_type="video/mp4")
    except Exception as e:
        pass # do not delete cached upload
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_ffmpeg import get_available_encoders

@router.get("/ffmpeg-encoders")
def api_get_ffmpeg_encoders():
    try:
        return {"encoders": get_available_encoders()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from utilities.util_object_detect import (
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
):
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
):
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
    ai_fps: float = Form(5.0)
):
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
            ai_fps=ai_fps
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
def api_od_cameras():
    return {"cameras": get_available_cameras()}

@router.post("/object-detect/webcam-config")
def api_od_webcam_config(camera_index: int = Form(...), ai_fps: float = Form(...), selected_classes: str = Form("")):
    from utilities.util_object_detect import update_webcam_config
    update_webcam_config(camera_index, ai_fps, selected_classes)
    return {"status": "ok"}

@router.get("/object-detect/webcam-stream")
def api_od_webcam_stream(
    conf_thresh: float,
    camera_index: int,
    use_extrapolation: bool = False
):
    config = load_all_config()
    model = config.get("object_detection", "yolov8n.pt")
    resolution = int(config.get("inference_resolution", 640))
    optimization = config.get("hardware_optimization", "PyTorch (Standard)")
    
    yolo, msg = load_yolo_model(optimization, resolution)
    if yolo is None:
        raise HTTPException(status_code=500, detail=msg)
        
    return StreamingResponse(
        generate_webcam_frames(
            model=yolo,
            camera_index=camera_index,
            resolution=resolution,
            conf_thresh=conf_thresh,
            target_height=600,
            use_extrapolation=use_extrapolation
        ),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

from utilities.util_face_blur import scan_faces, process_media_blur, save_frame_cache
import json

@router.post("/face-blur/scan")
async def api_fb_scan(
    file_hash: str = Form(...),
    fps_scan: float = Form(5.0),
    clustering_method: str = Form("None"),
    cluster_threshold: float = Form(0.50)
):
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
                from utilities.util_image_fx import encode_cv2_image_to_base64
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
):
    config = load_all_config()
    rec_model = config.get("face_blur", "buffalo_l")
    det_size = int(config.get("inference_resolution", 640))
    hw_opt = config.get("hardware_optimization", "PyTorch (Standard)")
    precision = "fp16" if "FP16" in hw_opt else ("int8" if "INT8" in hw_opt else "fp32")
    
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail="Invalid folder path")
        
    try:
        from utilities.util_face_blur_folder import scan_folder_faces
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
            
        from utilities.util_image_fx import encode_cv2_image_to_base64
        
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
def api_fb_serve_image(path: str):
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
):
    try:
        sel_faces = json.loads(selected_faces)
        if not sel_faces:
            raise HTTPException(status_code=400, detail="No faces selected.")
            
        from utilities.util_face_blur_folder import process_folder_blur
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

from utilities.util_webcam_fx import generate_face_blur_webcam_frames
from fastapi.responses import StreamingResponse

@router.get("/face-blur/webcam-stream")
def api_face_blur_webcam(
    conf_thresh: float,
    camera_index: int,
    blur_intensity: int = 50,
    blur_type: str = "Gaussian"
):
    try:
        return StreamingResponse(
            generate_face_blur_webcam_frames(
                camera_index=camera_index,
                conf_thresh=conf_thresh,
                blur_type=blur_type,
                blur_strength=blur_intensity
            ),
            media_type="multipart/x-mixed-replace; boundary=frame"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    output_method: str = Form("reencode")
):
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
            progress_hook=None
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

from utilities.util_censor import process_media_censor
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
):
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

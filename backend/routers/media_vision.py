import base64
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from utilities.util_code_image import generate_carbon_image
from utilities.util_bg_remove import remove_image_background
from utilities.util_ffmpeg import process_video
from utilities.util_image_compress import batch_compress_images
from fastapi import UploadFile, File, Form
import os
import tempfile
from utilities.util_config import load_all_config
from utilities.util_nlp import translate_text

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
async def api_remove_background(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    
    try:
        content = await file.read()
        success, result = remove_image_background(content)
        if not success:
            raise HTTPException(status_code=500, detail=result)
            
        img_b64 = base64.b64encode(result).decode('utf-8')
        return {"image_base64": img_b64}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/compress-video")
async def api_compress_video(
    file: UploadFile = File(...),
    output_dir: str = Form(...),
    start_time: float = Form(...),
    end_time: float = Form(...),
    target_res: str = Form(...),
    crf: int = Form(...),
    preset: str = Form(...),
    keep_audio: bool = Form(...),
    audio_codec: str = Form(...)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

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
        
        os.unlink(tmp_path)
        
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
    file: UploadFile = File(...)
):
    config = load_all_config()
    scale = int(config.get("image_upscaler_scale", 4))
    device_pref = config.get("device_preference", "Auto-Detect")
    device = "cuda" if device_pref == "GPU Preference" else "cpu"
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        success, result = upscale_image(tmp_path, scale=scale, device=device)
        os.unlink(tmp_path)

        if not success:
            raise HTTPException(status_code=500, detail=str(result))

        # Convert PIL Image to BytesIO and return as raw image response
        img_byte_arr = io.BytesIO()
        result.save(img_byte_arr, format='PNG')
        img_byte_arr = img_byte_arr.getvalue()
        
        return Response(content=img_byte_arr, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_bg_remove import remove_image_background
import base64

@router.post("/remove-background")
async def api_remove_background(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        content = await file.read()
        success, result = remove_image_background(content)
        
        if not success:
            raise HTTPException(status_code=500, detail=str(result))
            
        # result is PNG bytes. The frontend expects image_base64.
        b64_encoded = base64.b64encode(result).decode("utf-8")
        return {"image_base64": b64_encoded}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_color_picker import get_color_from_coords

@router.post("/color-picker")
async def api_color_picker(
    file: UploadFile = File(...),
    x: int = Form(...),
    y: int = Form(...)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        content = await file.read()
        success, result = get_color_from_coords(content, x, y)
        if not success:
            raise HTTPException(status_code=400, detail=str(result))
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from utilities.util_color_picker import get_color_palette

@router.post("/color-palette")
async def api_color_palette(
    file: UploadFile = File(...),
    num_colors: int = Form(5)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    try:
        content = await file.read()
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
    file: UploadFile = File(...),
    colormap: str = Form(...),
    invert: bool = Form(...)
):
    config = load_all_config()
    model_size = config.get("depth_estimation", "Base")
    engine = config.get("global_compute_engine", "cpu")
    hw_opt = config.get("hardware_optimization", "PyTorch (Standard)")
    precision = "fp16" if "FP16" in hw_opt else ("int8" if "INT8" in hw_opt else "fp32")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
        
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
            cleanup_files(tmp_path)
            raise HTTPException(status_code=500, detail=msg)
            
        # Add cleanup to run after response is sent
        background_tasks.add_task(cleanup_files, tmp_path, out_path)
        
        return FileResponse(out_path, media_type="image/jpeg")
    except Exception as e:
        cleanup_files(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/depth-video")
async def api_depth_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    colormap: str = Form(...),
    invert: bool = Form(...),
    encoder: str = Form(...)
):
    config = load_all_config()
    model_size = config.get("depth_estimation", "Base")
    engine = config.get("global_compute_engine", "cpu")
    hw_opt = config.get("hardware_optimization", "PyTorch (Standard)")
    precision = "fp16" if "FP16" in hw_opt else ("int8" if "INT8" in hw_opt else "fp32")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
        
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
            cleanup_files(tmp_path)
            raise HTTPException(status_code=500, detail=msg)
            
        background_tasks.add_task(cleanup_files, tmp_path, out_path)
        
        return FileResponse(out_path, media_type="video/mp4")
    except Exception as e:
        cleanup_files(tmp_path)
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

@router.post("/object-detect/image")
async def api_od_image(
    file: UploadFile = File(...),
    conf_thresh: float = Form(...),
    selected_ids: str = Form(...) # JSON string of IDs
):
    config = load_all_config()
    model = config.get("object_detection", "yolov8n.pt")
    resolution = int(config.get("inference_resolution", 640))
    optimization = config.get("hardware_optimization", "PyTorch (Standard)")
    
    try:
        import json
        sel_ids = json.loads(selected_ids)
        yolo, msg = load_yolo_model(optimization, resolution)
        if yolo is None:
            raise HTTPException(status_code=500, detail=msg)
            
        content = await file.read()
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
    file: UploadFile = File(...),
    conf_thresh: float = Form(...),
    output_method: str = Form(...),
    encoder: str = Form(...)
):
    config = load_all_config()
    model = config.get("object_detection", "yolov8n.pt")
    resolution = int(config.get("inference_resolution", 640))
    optimization = config.get("hardware_optimization", "PyTorch (Standard)")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
        
    try:
        yolo, msg = load_yolo_model(optimization, resolution)
        if yolo is None:
            cleanup_files(tmp_path)
            raise HTTPException(status_code=500, detail=msg)
            
        success, out_path = process_video_object_detection(
            input_path=tmp_path,
            model=yolo,
            resolution=resolution,
            conf_thresh=conf_thresh,
            output_method=output_method,
            progress_hook=None,
            encoder=encoder
        )
        if not success:
            cleanup_files(tmp_path)
            raise HTTPException(status_code=500, detail=out_path)
            
        background_tasks.add_task(cleanup_files, tmp_path, out_path)
        mime = "text/plain" if output_method == "subtitle" else "video/mp4"
        return FileResponse(out_path, media_type=mime)
    except Exception as e:
        cleanup_files(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/object-detect/cameras")
def api_od_cameras():
    return {"cameras": get_available_cameras()}

@router.get("/object-detect/webcam-stream")
def api_od_webcam_stream(
    conf_thresh: float,
    camera_index: int,
    use_extrapolation: bool = False,
    ai_fps: float = 30.0
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
            use_extrapolation=use_extrapolation,
            ai_fps=ai_fps
        ),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

from utilities.util_face_blur import scan_faces, process_media_blur, save_frame_cache
import json

@router.post("/face-blur/scan")
async def api_fb_scan(
    file: UploadFile = File(...),
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
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    suffix = os.path.splitext(file.filename)[1]
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
        
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
            cleanup_files(tmp_path)
            raise HTTPException(status_code=500, detail=msg)
            
        import cv2
        import base64
        
        # We need to base64 encode the crops in face_data so JSON can send them
        for face in face_data:
            if 'crop' in face:
                is_success, buffer = cv2.imencode(".jpg", cv2.cvtColor(face['crop'], cv2.COLOR_RGB2BGR))
                if is_success:
                    face['crop_b64'] = base64.b64encode(buffer).decode('utf-8')
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
        cleanup_files(tmp_path)
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
    file: UploadFile = File(...),
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
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    try:
        labels = json.loads(selected_labels)
        if not labels:
            raise HTTPException(status_code=400, detail="No labels selected.")
            
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
            
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
            cleanup_files(tmp_path)
            raise HTTPException(status_code=500, detail=out_path)
            
        # Clean up everything!
        paths_to_delete = [tmp_path, out_path]
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

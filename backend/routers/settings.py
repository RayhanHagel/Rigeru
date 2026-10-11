import json
import asyncio
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from utilities.core.util_huggingface import (
    load_hf_token, save_hf_token, list_cached_models,
    delete_cached_model, download_model, DOWNLOAD_PROGRESS
)
from utilities.core.util_config import load_all_config, save_all_config
from utilities.core.util_store import get_all_keys, get_data, set_data, delete_data

router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"]
)

@router.get("/hf/token")
async def get_hf_token() -> Dict[str, str]:
    """
    Retrieve the configured Hugging Face API access token.

    Returns:
        Dict[str, str]: Token payload (`{"token": str}`).
    """
    return {"token": load_hf_token()}

class TokenRequest(BaseModel):
    token: str = Field(..., description="Hugging Face personal access token.")

@router.post("/hf/token")
async def update_hf_token(req: TokenRequest) -> Dict[str, str]:
    """
    Persist a new Hugging Face API user access token to system configuration.

    Args:
        req (TokenRequest): Request containing API token string.

    Returns:
        Dict[str, str]: Confirmation status message.

    Raises:
        HTTPException: 500 if file write or encryption fails.
    """
    try:
        save_hf_token(req.token.strip())
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/hf/models")
async def get_hf_models() -> Dict[str, List[Dict[str, Any]]]:
    """
    List all cached Hugging Face repository models on local disk.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Mapping containing list of downloaded models and metadata.

    Raises:
        HTTPException: 500 if directory inspection fails.
    """
    try:
        models = list_cached_models()
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/hf/models/{model_id:path}")
async def delete_hf_model(model_id: str) -> Dict[str, str]:
    """
    Remove a cached model repository from local disk storage.

    Args:
        model_id (str): Hugging Face repository ID (e.g., 'openai/clip-vit-base-patch32').

    Returns:
        Dict[str, str]: Status message confirming deletion.

    Raises:
        HTTPException: 400 if model ID is missing or deletion fails.
    """
    clean_id = model_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="Model ID is required.")
    success = delete_cached_model(clean_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete model.")
    return {"status": "success"}

class DownloadRequest(BaseModel):
    repo_id: str = Field(..., min_length=1, description="Repository identifier to download.")

@router.post("/hf/models/download")
async def download_hf_model(req: DownloadRequest, background_tasks: BackgroundTasks) -> Dict[str, str]:
    """
    Initiate background download of a model repository from the Hugging Face Hub.

    Args:
        req (DownloadRequest): Target repo identifier.
        background_tasks (BackgroundTasks): Background worker queue.

    Returns:
        Dict[str, str]: Job kickoff status (`{"status": "started"}`).

    Raises:
        HTTPException: 400 if repo_id is empty.
    """
    clean_id = req.repo_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="Repository ID cannot be empty.")

    DOWNLOAD_PROGRESS[clean_id] = {"status": "starting", "progress": 0, "total": 100, "desc": "Queued download"}
    background_tasks.add_task(download_model, clean_id)
    return {"status": "started"}

@router.get("/hf/models/download/progress")
async def get_download_progress(repo_id: str) -> StreamingResponse:
    """
    Server-Sent Events stream providing real-time download percentage and speed updates.

    Args:
        repo_id (str): Hugging Face repository identifier being downloaded.

    Returns:
        StreamingResponse: Text/event-stream delivering progress events.
    """
    clean_id = repo_id.strip()
    async def event_stream():
        while True:
            progress_data = DOWNLOAD_PROGRESS.get(clean_id, {"status": "waiting", "progress": 0, "total": 100})
            yield f"data: {json.dumps(progress_data)}\n\n"
            if progress_data.get("status") in ["finished", "error"]:
                break
            await asyncio.sleep(0.5)
            
    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.get("/models/config")
async def get_model_config() -> Dict[str, Any]:
    """
    Fetch all active configuration defaults for AI models across vision, audio, and NLP.

    Returns:
        Dict[str, Any]: Complete model configuration object.

    Raises:
        HTTPException: 500 if config file reading fails.
    """
    try:
        config = load_all_config()
        return {"config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ModelConfigRequest(BaseModel):
    config: Dict[str, Any] = Field(..., description="Key-value mapping of updated model configurations.")

@router.post("/models/config")
async def update_model_config(req: ModelConfigRequest) -> Dict[str, str]:
    """
    Update and persist model configurations to disk.

    Args:
        req (ModelConfigRequest): Mapping of configuration keys and updated values.

    Returns:
        Dict[str, str]: Status message confirming update.

    Raises:
        HTTPException: 500 if persisting fails.
    """
    try:
        current = load_all_config()
        current.update(req.config)
        save_all_config(current)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _get_ollama_host() -> str:
    from utilities.core.util_config import get_model_config
    return get_model_config("ollama_host") or "http://localhost:11434"

@router.get("/ollama/status")
async def get_ollama_status() -> Dict[str, Any]:
    """
    Check connectivity to the local or remote Ollama daemon.
    """
    host = _get_ollama_host()
    try:
        import ollama
        client = ollama.Client(host=host)
        res = client.list()
        models_list = getattr(res, 'models', []) if hasattr(res, 'models') else (res.get("models", []) if isinstance(res, dict) else [])
        return {
            "connected": True,
            "host": host,
            "model_count": len(models_list),
            "message": "Connected to Ollama service"
        }
    except Exception as e:
        return {
            "connected": False,
            "host": host,
            "model_count": 0,
            "error": str(e)
        }

@router.get("/ollama/models")
async def get_ollama_models() -> Dict[str, List[Dict[str, Any]]]:
    """
    Query local Ollama instance for installed LLM models and sizes.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Array of installed Ollama models.
    """
    try:
        import ollama
        host = _get_ollama_host()
        client = ollama.Client(host=host)
        res = client.list()
        models = []
        models_list = getattr(res, 'models', []) if hasattr(res, 'models') else (res.get("models", []) if isinstance(res, dict) else [])
        for m in models_list:
            models.append({
                "name": getattr(m, 'model', m.get('model', m.get('name', ''))) if isinstance(m, dict) else getattr(m, 'model', getattr(m, 'name', '')),
                "size_bytes": getattr(m, 'size', m.get('size', 0)) if isinstance(m, dict) else getattr(m, 'size', 0)
            })
        return {"models": models}
    except Exception as e:
        print(f"Error fetching ollama models: {e}")
        return {"models": []}

@router.delete("/ollama/models/{model_name:path}")
async def delete_ollama_model(model_name: str) -> Dict[str, str]:
    """
    Delete a local model from the Ollama model storage.

    Args:
        model_name (str): Model name tag (e.g. 'llama3:latest').

    Returns:
        Dict[str, str]: Confirmation status message.

    Raises:
        HTTPException: 400 if deletion request fails.
    """
    clean_name = model_name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Model name is required.")
    try:
        import ollama
        host = _get_ollama_host()
        client = ollama.Client(host=host)
        client.delete(clean_name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

OLLAMA_PROGRESS: Dict[str, Dict[str, Any]] = {}

def _pull_ollama_worker(model_name: str, host: str) -> None:
    try:
        import ollama
        client = ollama.Client(host=host)
        OLLAMA_PROGRESS[model_name] = {"status": "downloading", "progress": 0, "total": 100, "desc": "Pulling model..."}
        for chunk in client.pull(model_name, stream=True):
            status = getattr(chunk, 'status', chunk.get('status', '')) if isinstance(chunk, dict) else getattr(chunk, 'status', '')
            completed = getattr(chunk, 'completed', chunk.get('completed', 0)) if isinstance(chunk, dict) else getattr(chunk, 'completed', 0)
            total = getattr(chunk, 'total', chunk.get('total', 100)) if isinstance(chunk, dict) else getattr(chunk, 'total', 100)
            OLLAMA_PROGRESS[model_name] = {
                "status": "downloading",
                "progress": completed,
                "total": total,
                "desc": status
            }
        OLLAMA_PROGRESS[model_name] = {"status": "finished", "progress": 100, "total": 100, "desc": "Pull complete"}
    except Exception as e:
        OLLAMA_PROGRESS[model_name] = {"status": "error", "desc": str(e)}

@router.post("/ollama/models/download")
async def download_ollama_model(req: DownloadRequest, background_tasks: BackgroundTasks) -> Dict[str, str]:
    """
    Pull a new model from the Ollama library as an asynchronous background worker.

    Args:
        req (DownloadRequest): Target Ollama model name.
        background_tasks (BackgroundTasks): Background worker queue.

    Returns:
        Dict[str, str]: Started status.
    """
    clean_name = req.repo_id.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Model name is required.")
    host = _get_ollama_host()
    OLLAMA_PROGRESS[clean_name] = {"status": "starting", "progress": 0, "total": 100, "desc": "Starting pull..."}
    background_tasks.add_task(_pull_ollama_worker, clean_name, host)
    return {"status": "started"}

@router.get("/ollama/models/download/progress")
async def get_ollama_download_progress(repo_id: str) -> StreamingResponse:
    """
    Server-Sent Events stream delivering real-time Ollama model pull updates.
    """
    clean_id = repo_id.strip()
    async def event_stream():
        while True:
            progress_data = OLLAMA_PROGRESS.get(clean_id, {"status": "waiting", "progress": 0, "total": 100})
            yield f"data: {json.dumps(progress_data)}\n\n"
            if progress_data.get("status") in ["finished", "error"]:
                break
            await asyncio.sleep(0.5)
            
    return StreamingResponse(event_stream(), media_type="text/event-stream")

class ModelTestRequest(BaseModel):
    category: str = Field(..., description="Feature category to test (e.g. 'object_detection', 'math_latex', 'face_blur', etc.)")
    model_id: Optional[str] = Field(None, description="Optional specific model identifier to test")

@router.post("/models/test")
async def test_model_readiness(req: ModelTestRequest) -> Dict[str, Any]:
    """
    Perform a quick live smoke test / verification on a machine learning model to verify it works according to documentation.
    """
    cat = req.category.strip()
    mid = req.model_id.strip() if req.model_id else ""
    try:
        if cat == "object_detection":
            from utilities.vision.util_object_detect import load_yolo_model
            model, msg = load_yolo_model()
            if not model:
                return {"status": "error", "message": f"Failed to load YOLO model: {msg}"}
            import numpy as np
            dummy_frame = np.zeros((320, 320, 3), dtype=np.uint8)
            res = model(dummy_frame, verbose=False)
            return {"status": "ok", "message": f"YOLO model verified successfully! ({len(model.names)} classes detected)"}

        elif cat == "face_blur":
            from utilities.vision.util_face_blur import load_face_detector
            detector, msg = load_face_detector()
            if not detector:
                return {"status": "error", "message": f"Face detector failed: {msg}"}
            return {"status": "ok", "message": "InsightFace FaceAnalysis pipeline initialized and ready!"}

        elif cat == "math_latex":
            import io
            from PIL import Image, ImageDraw
            from utilities.documents.util_math_latex import process_math_image
            # Generate a test image with simple content
            test_img = Image.new("RGB", (200, 60), color=(255, 255, 255))
            d = ImageDraw.Draw(test_img)
            d.text((10, 20), "x^2 + y^2 = r^2", fill=(0, 0, 0))
            buf = io.BytesIO()
            test_img.save(buf, format="PNG")
            ok, text = process_math_image(buf.getvalue())
            if not ok:
                return {"status": "error", "message": f"OCR extraction test failed: {text}"}
            return {"status": "ok", "message": f"Math LaTeX OCR verified! Extracted: {text[:60]}"}

        elif cat == "expense_tracker":
            from utilities.productivity_lifestyle.util_expense import load_receipt_model
            proc, model, dev, mtype = load_receipt_model()
            return {"status": "ok", "message": f"Receipt model loaded ({mtype}) on {dev} successfully!"}

        elif cat == "translation":
            from utilities.productivity_lifestyle.util_nlp import translate_text
            res = translate_text("Hello", "English", "French", model_id=mid or None)
            return {"status": "ok", "message": f"Translation pipeline verified! 'Hello' -> '{res}'"}

        elif cat == "background_removal":
            from utilities.vision.util_bg_remove import remove_image_background
            from PIL import Image
            import io
            test_img = Image.new("RGB", (40, 40), color=(255, 0, 0))
            buf = io.BytesIO()
            test_img.save(buf, format="PNG")
            ok, res = remove_image_background(buf.getvalue())
            if not ok:
                return {"status": "error", "message": f"Background removal failed: {res}"}
            return {"status": "ok", "message": "Background removal model executed successfully!"}

        elif cat == "depth_estimation":
            from utilities.vision.util_depth_estimation import load_depth_onnx
            from utilities.core.util_config import get_model_config
            model_name = mid or get_model_config("depth_estimation") or "small"
            session, ok, msg = load_depth_onnx(model_name, "cpu")
            if not ok:
                return {"status": "error", "message": f"Depth estimation failed: {msg}"}
            return {"status": "ok", "message": "Depth Anything ONNX session loaded and verified!"}

        elif cat == "image_upscaler":
            from utilities.vision.util_upscale import _load_upscale_model
            upsampler = _load_upscale_model(2, "cpu")
            return {"status": "ok", "message": "Real-ESRGAN super-resolution engine loaded successfully!"}

        elif cat == "voice_cloning_tts":
            from utilities.audio_video.util_tts import get_tts_model
            model = get_tts_model()
            return {"status": "ok", "message": "OmniVoice TTS zero-shot cloning model initialized successfully!"}

        elif cat == "audio_transcription":
            from utilities.core.util_config import get_model_config
            m_name = mid or get_model_config("audio_transcription") or "base"
            if m_name.startswith("Systran/faster-whisper-") or m_name.startswith("faster-whisper-"):
                from faster_whisper import WhisperModel
                import os
                models_dir = os.path.join(".", "cache", "models")
                local_dir = os.path.join(models_dir, m_name)
                src = local_dir if os.path.isdir(local_dir) else m_name
                WhisperModel(src, device="cpu", compute_type="int8", download_root=models_dir)
                return {"status": "ok", "message": f"Faster-Whisper ({m_name}) verified successfully!"}
            else:
                return {"status": "ok", "message": f"Whisper pipeline configured for {m_name}."}

        elif cat == "ollama":
            import ollama
            host = _get_ollama_host()
            client = ollama.Client(host=host)
            res = client.list()
            models_list = getattr(res, 'models', []) if hasattr(res, 'models') else (res.get("models", []) if isinstance(res, dict) else [])
            return {"status": "ok", "message": f"Ollama connection verified! {len(models_list)} models available on host."}

        else:
            return {"status": "error", "message": f"Unknown category: {cat}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.get("/configurations")
async def get_all_configurations() -> Dict[str, List[Dict[str, Any]]]:
    """
    Retrieve all custom user key-value configurations stored in SQLite store.

    Returns:
        Dict[str, List[Dict[str, Any]]]: List of key-value configuration objects.

    Raises:
        HTTPException: 500 if store lookup fails.
    """
    try:
        keys = get_all_keys()
        configs = []
        for k in keys:
            configs.append({
                "key": k,
                "value": get_data(k)
            })
        return {"configurations": configs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ConfigUpdateRequest(BaseModel):
    key: str = Field(..., min_length=1, description="Config parameter key.")
    value: Any = Field(..., description="JSON-serializable config value.")

@router.post("/configurations")
async def update_configuration(req: ConfigUpdateRequest) -> Dict[str, str]:
    """
    Store or update an arbitrary configuration key-value pair.

    Args:
        req (ConfigUpdateRequest): Key and value payload.

    Returns:
        Dict[str, str]: Status confirmation message.

    Raises:
        HTTPException: 500 if store write fails.
    """
    clean_key = req.key.strip()
    if not clean_key:
        raise HTTPException(status_code=400, detail="Configuration key cannot be empty.")
    try:
        set_data(clean_key, req.value)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/configurations/{key:path}")
async def delete_configuration(key: str) -> Dict[str, str]:
    """
    Delete a configuration entry from the store by key.

    Args:
        key (str): Storage key identifier.

    Returns:
        Dict[str, str]: Status confirmation message.

    Raises:
        HTTPException: 500 if deletion fails.
    """
    clean_key = key.strip()
    if not clean_key:
        raise HTTPException(status_code=400, detail="Configuration key cannot be empty.")
    try:
        delete_data(clean_key)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

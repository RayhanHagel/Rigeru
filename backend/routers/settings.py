from fastapi import APIRouter, HTTPException, Form, BackgroundTasks
from pydantic import BaseModel
import json
import asyncio
from fastapi.responses import StreamingResponse
from utilities.util_huggingface import load_hf_token, save_hf_token, list_cached_models, delete_cached_model, download_model, DOWNLOAD_PROGRESS
from utilities.util_config import load_all_config, save_all_config

router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"]
)

@router.get("/hf/token")
async def get_hf_token():
    return {"token": load_hf_token()}

class TokenRequest(BaseModel):
    token: str

@router.post("/hf/token")
async def update_hf_token(req: TokenRequest):
    try:
        save_hf_token(req.token)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/hf/models")
async def get_hf_models():
    try:
        models = list_cached_models()
        return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/hf/models/{model_id:path}")
async def delete_hf_model(model_id: str):
    success = delete_cached_model(model_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete model.")
    return {"status": "success"}

class DownloadRequest(BaseModel):
    repo_id: str

@router.post("/hf/models/download")
async def download_hf_model(req: DownloadRequest, background_tasks: BackgroundTasks):
    from utilities.util_huggingface import DOWNLOAD_PROGRESS
    # Initialize the progress dict so SSE can read it immediately
    DOWNLOAD_PROGRESS[req.repo_id] = {"status": "starting", "progress": 0, "total": 100, "desc": "Queued download"}
    # Run the blocking download function in a background thread
    background_tasks.add_task(download_model, req.repo_id)
    return {"status": "started"}

from fastapi.responses import StreamingResponse
import asyncio
from utilities.util_huggingface import DOWNLOAD_PROGRESS

@router.get("/hf/models/download/progress")
async def get_download_progress(repo_id: str):
    """SSE endpoint to stream download progress for a given repo_id."""
    async def event_stream():
        while True:
            progress_data = DOWNLOAD_PROGRESS.get(repo_id, {"status": "waiting", "progress": 0, "total": 100})
            yield f"data: {json.dumps(progress_data)}\n\n"
            if progress_data.get("status") in ["finished", "error"]:
                break
            await asyncio.sleep(0.5)
            
    return StreamingResponse(event_stream(), media_type="text/event-stream")

@router.get("/models/config")
async def get_model_config():
    try:
        config = load_all_config()
        return {"config": config}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ModelConfigRequest(BaseModel):
    config: dict

@router.post("/models/config")
async def update_model_config(req: ModelConfigRequest):
    try:
        # Validate that the config dict has the required keys? 
        # save_all_config handles merging partially but since we are replacing we can just pass the dict.
        # Actually save_all_config overrides it. It's safer to load, update, save.
        current = load_all_config()
        current.update(req.config)
        save_all_config(current)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import ollama

@router.get("/ollama/models")
async def get_ollama_models():
    try:
        client = ollama.Client(host="http://localhost:11434")
        res = client.list()
        models = []
        models_list = getattr(res, 'models', []) if hasattr(res, 'models') else res.get("models", [])
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
async def delete_ollama_model(model_name: str):
    try:
        client = ollama.Client(host="http://localhost:11434")
        client.delete(model_name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ollama/models/download")
def download_ollama_model(req: DownloadRequest):
    # Using DownloadRequest since it has repo_id
    try:
        import ollama
        # Note: ollama.pull is blocking and can take a long time. 
        # Running it in a threadpool prevents blocking the main event loop.
        client = ollama.Client(host="http://localhost:11434")
        client.pull(req.repo_id)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from utilities.util_store import get_all_keys, get_data, set_data, delete_data
from typing import Any

@router.get("/configurations")
async def get_all_configurations():
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
    key: str
    value: Any

@router.post("/configurations")
async def update_configuration(req: ConfigUpdateRequest):
    try:
        set_data(req.key, req.value)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/configurations/{key:path}")
async def delete_configuration(key: str):
    try:
        delete_data(key)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

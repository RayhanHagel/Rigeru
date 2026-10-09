import json
import asyncio
from typing import Dict, Any, List
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

@router.get("/ollama/models")
async def get_ollama_models() -> Dict[str, List[Dict[str, Any]]]:
    """
    Query local Ollama instance for installed LLM models and sizes.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Array of installed Ollama models.
    """
    try:
        import ollama
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
        client = ollama.Client(host="http://localhost:11434")
        client.delete(clean_name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ollama/models/download")
def download_ollama_model(req: DownloadRequest) -> Dict[str, str]:
    """
    Pull a new model from the Ollama library to the local Ollama instance.

    Args:
        req (DownloadRequest): Target Ollama model name.

    Returns:
        Dict[str, str]: Success confirmation message.

    Raises:
        HTTPException: 400 if pull fails.
    """
    clean_name = req.repo_id.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Model name is required.")
    try:
        import ollama
        client = ollama.Client(host="http://localhost:11434")
        client.pull(clean_name)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

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

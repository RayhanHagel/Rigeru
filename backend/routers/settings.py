from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel
from utilities.util_huggingface import load_hf_token, save_hf_token, list_cached_models, delete_cached_model, download_model
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

@router.delete("/hf/models/{model_id}")
async def delete_hf_model(model_id: str):
    success = delete_cached_model(model_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete model.")
    return {"status": "success"}

class DownloadRequest(BaseModel):
    repo_id: str

@router.post("/hf/models/download")
async def download_hf_model(req: DownloadRequest):
    success = download_model(req.repo_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to download model.")
    return {"status": "success"}

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

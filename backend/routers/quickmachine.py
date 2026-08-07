from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
import os
import uuid
from typing import List, Optional, Dict, Any

from .auth import get_current_user
from utilities.quickmachine.executor import run_ml_pipeline, JOB_STORE

router = APIRouter(
    prefix="/api/quickmachine",
    tags=["quickmachine"],
    dependencies=[Depends(get_current_user)]
)

class GraphPayload(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]

@router.get("/")
def get_status():
    return {"status": "ok"}

class VisualizePayload(BaseModel):
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    target_node_id: str

@router.post("/visualize")
def visualize_data(payload: VisualizePayload):
    from utilities.quickmachine.visualization import run_visualization
    try:
        b64_img = run_visualization(payload.nodes, payload.edges, payload.target_node_id)
        return {"image": b64_img}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/run")
def run_pipeline(payload: GraphPayload, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    
    # Initialize job in store
    JOB_STORE[job_id] = {
        "status": "starting",
        "progress": 0,
        "logs": [],
        "result": None
    }
    
    # Spawn background task
    background_tasks.add_task(run_ml_pipeline, job_id, payload.nodes, payload.edges)
    
    return {"job_id": job_id, "message": "Pipeline execution started in background."}

@router.get("/status/{job_id}")
def get_job_status(job_id: str):
    if job_id not in JOB_STORE:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = JOB_STORE[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "progress": job["progress"],
        "logs": job["logs"],
        "result": job["result"]
    }

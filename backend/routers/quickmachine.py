import os
import uuid
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from .auth import get_current_user
from utilities.quickmachine.executor import run_ml_pipeline, JOB_STORE

router = APIRouter(
    prefix="/api/quickmachine",
    tags=["quickmachine"],
    dependencies=[Depends(get_current_user)]
)

class GraphPayload(BaseModel):
    nodes: List[Dict[str, Any]] = Field(..., description="List of ML node definitions with parameters and types.")
    edges: List[Dict[str, Any]] = Field(..., description="List of directed connections between pipeline nodes.")

@router.get("/")
def get_status() -> Dict[str, str]:
    """
    Healthcheck endpoint for the QuickMachine pipeline runtime.

    Returns:
        Dict[str, str]: Operational status (`{"status": "ok"}`).
    """
    return {"status": "ok"}

class VisualizePayload(BaseModel):
    nodes: List[Dict[str, Any]] = Field(..., description="List of pipeline graph nodes.")
    edges: List[Dict[str, Any]] = Field(..., description="List of graph connections.")
    target_node_id: str = Field(..., min_length=1, description="ID of the node to generate intermediate visualization for.")

@router.post("/visualize")
def visualize_data(payload: VisualizePayload) -> Dict[str, str]:
    """
    Generate an intermediate data visualization image for a specific pipeline node.

    Args:
        payload (VisualizePayload): Nodes, edges, and target node identifier.

    Returns:
        Dict[str, str]: Base64-encoded PNG image representation.

    Raises:
        HTTPException: If data generation or matplotlib chart rendering fails.
    """
    if not payload.target_node_id.strip():
        raise HTTPException(status_code=400, detail="target_node_id cannot be empty.")

    from utilities.quickmachine.visualization import run_visualization
    try:
        b64_img = run_visualization(payload.nodes, payload.edges, payload.target_node_id)
        return {"image": b64_img}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/run")
def run_pipeline(payload: GraphPayload, background_tasks: BackgroundTasks) -> Dict[str, str]:
    """
    Compile and trigger background asynchronous execution of a machine learning workflow.

    Args:
        payload (GraphPayload): Directed acyclic graph specification with nodes and edges.
        background_tasks (BackgroundTasks): Background worker runner.

    Returns:
        Dict[str, str]: Created job UUID and status acknowledgment.

    Raises:
        HTTPException: If graph nodes list is empty.
    """
    if not payload.nodes:
        raise HTTPException(status_code=400, detail="Pipeline requires at least one node to execute.")

    job_id = str(uuid.uuid4())
    
    JOB_STORE[job_id] = {
        "status": "starting",
        "progress": 0,
        "logs": [],
        "result": None
    }
    
    background_tasks.add_task(run_ml_pipeline, job_id, payload.nodes, payload.edges)
    
    return {"job_id": job_id, "message": "Pipeline execution started in background."}

@router.get("/status/{job_id}")
def get_job_status(job_id: str) -> Dict[str, Any]:
    """
    Poll the execution status, logs, and evaluation metrics of a QuickMachine pipeline run.

    Args:
        job_id (str): UUID of the running or completed job.

    Returns:
        Dict[str, Any]: Job status dictionary with progress, logs, and evaluation results.

    Raises:
        HTTPException: If the job_id does not exist in the active store.
    """
    clean_id = job_id.strip()
    if not clean_id or clean_id not in JOB_STORE:
        raise HTTPException(status_code=404, detail="Job not found.")
    
    job = JOB_STORE[clean_id]
    return {
        "job_id": clean_id,
        "status": job["status"],
        "progress": job["progress"],
        "logs": job["logs"],
        "result": job["result"]
    }

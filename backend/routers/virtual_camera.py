import asyncio
from typing import Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel, Field
from utilities.vision.util_virtual_camera import check_obs_virtualcam, start_virtual_camera, stop_virtual_camera, send_frame
from backend.routers.auth import get_current_user

router = APIRouter(
    prefix="/api/virtual-camera",
    tags=["virtual-camera"]
)

@router.get("/status", dependencies=[Depends(get_current_user)])
async def get_status() -> Dict[str, bool]:
    """
    Check if the OBS virtual camera device driver is installed and accessible on Windows.

    Returns:
        Dict[str, bool]: Dictionary indicating availability status (`{"available": bool}`).
    """
    is_available = check_obs_virtualcam()
    return {"available": is_available}

class VirtualCameraToggleRequest(BaseModel):
    active: bool = Field(..., description="Whether to activate or deactivate the virtual camera.")
    width: int = Field(1280, ge=320, le=3840, description="Virtual camera frame width in pixels.")
    height: int = Field(720, ge=240, le=2160, description="Virtual camera frame height in pixels.")
    fps: int = Field(30, ge=1, le=120, description="Output frame rate.")

@router.post("/toggle-backend", dependencies=[Depends(get_current_user)])
async def toggle_backend_virtual_camera(request: VirtualCameraToggleRequest) -> Dict[str, str]:
    """
    Start or stop the backend pyvirtualcam stream output.

    Args:
        request (VirtualCameraToggleRequest): Configuration containing state, resolution, and framerate.

    Returns:
        Dict[str, str]: Status message indicating whether the camera started, stopped, or errored.
    """
    if request.active:
        success = start_virtual_camera(width=request.width, height=request.height, fps=request.fps)
        if success:
            return {"status": "started"}
        else:
            return {"status": "error", "message": "Failed to start virtual camera"}
    else:
        stop_virtual_camera()
        return {"status": "stopped"}

@router.websocket("/stream")
async def virtual_camera_stream(websocket: WebSocket) -> None:
    """
    WebSocket endpoint receiving packed raw RGB video frames from frontend to write into the virtual camera pipe.

    Args:
        websocket (WebSocket): Client websocket connection sending configuration and binary frames.

    Returns:
        None
    """
    await websocket.accept()
    
    # Wait for the initial configuration message
    try:
        config = await websocket.receive_json()
        width = int(config.get("width", 1280))
        height = int(config.get("height", 720))
        fps = int(config.get("fps", 30))
        
        if width <= 0 or height <= 0 or fps <= 0:
            await websocket.send_json({"error": "Invalid camera dimensions or framerate."})
            await websocket.close()
            return

        success = start_virtual_camera(width=width, height=height, fps=fps)
        if not success:
            await websocket.send_json({"error": "Failed to start virtual camera"})
            await websocket.close()
            return
            
        await websocket.send_json({"status": "ready"})
        
        # Stream loop
        while True:
            # Receive packed RGB frame from the frontend
            frame_bytes = await websocket.receive_bytes()
            # Run in thread pool: sleep_until_next_frame() is blocking and must
            # not run in the asyncio event loop or it will starve other coroutines
            await asyncio.get_event_loop().run_in_executor(None, send_frame, frame_bytes, width, height)
            
    except WebSocketDisconnect:
        print("Virtual camera client disconnected.")
    except Exception as e:
        print(f"Error in virtual camera stream: {e}")
    finally:
        stop_virtual_camera()

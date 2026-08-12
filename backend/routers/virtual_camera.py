import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict
from utilities.util_virtual_camera import check_obs_virtualcam, start_virtual_camera, stop_virtual_camera, send_frame
from backend.routers.auth import get_current_user

router = APIRouter(
    prefix="/api/virtual-camera",
    tags=["virtual-camera"]
)

@router.get("/status", dependencies=[Depends(get_current_user)])
async def get_status():
    """
    Check if the OBS virtual camera is installed/available.
    """
    is_available = check_obs_virtualcam()
    return {"available": is_available}
from pydantic import BaseModel

class VirtualCameraToggleRequest(BaseModel):
    active: bool
    width: int = 1280
    height: int = 720
    fps: int = 30

@router.post("/toggle-backend", dependencies=[Depends(get_current_user)])
async def toggle_backend_virtual_camera(request: VirtualCameraToggleRequest):
    """
    Start or stop the backend virtual camera.
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
async def virtual_camera_stream(websocket: WebSocket):
    """
    WebSocket endpoint to receive frames and send them to the virtual camera.
    """
    await websocket.accept()
    
    # Wait for the initial configuration message
    try:
        config = await websocket.receive_json()
        width = config.get("width", 1280)
        height = config.get("height", 720)
        fps = config.get("fps", 30)
        
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

import pyvirtualcam
import numpy as np
import base64
import cv2
import asyncio

# Global dictionary to hold active camera instances per client/session
# For a single user app, we can just use a single global camera instance
_active_camera = None

def check_obs_virtualcam() -> bool:
    """
    Checks if a virtual camera device is available by attempting to initialize one.
    """
    try:
        # Try to open a dummy camera
        with pyvirtualcam.Camera(width=100, height=100, fps=30, fmt=pyvirtualcam.PixelFormat.RGB) as cam:
            return True
    except Exception as e:
        print(f"Virtual camera check failed: {e}")
        return False

def start_virtual_camera(width: int = 1280, height: int = 720, fps: int = 30):
    global _active_camera
    if _active_camera is not None:
        stop_virtual_camera()
        
    try:
        # pyvirtualcam OBS backend on Windows doesn't natively support RGBA. We use RGB.
        _active_camera = pyvirtualcam.Camera(width=width, height=height, fps=fps, fmt=pyvirtualcam.PixelFormat.RGB)
        print(f"Started virtual camera: {_active_camera.device}")
        return True
    except Exception as e:
        print(f"Failed to start virtual camera: {e}")
        _active_camera = None
        return False

def stop_virtual_camera():
    global _active_camera
    if _active_camera is not None:
        _active_camera.close()
        _active_camera = None
        print("Stopped virtual camera.")

def send_frame_bgr(frame_bgr: np.ndarray):
    """
    Sends an OpenCV BGR numpy array directly to the virtual camera.
    """
    global _active_camera
    if _active_camera is None:
        return
        
    try:
        h, w = frame_bgr.shape[:2]
        cam_w, cam_h = _active_camera.width, _active_camera.height
        
        # We need the frame to match the virtual camera size exactly
        if w != cam_w or h != cam_h:
            frame_bgr = cv2.resize(frame_bgr, (cam_w, cam_h))
            
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        _active_camera.send(frame_rgb)
        # We don't sleep here since the AI loops (e.g., cap.read()) provide their own pacing
    except Exception as e:
        print(f"Error sending BGR frame to virtual camera: {e}")

def send_frame(frame_bytes: bytes, width: int, height: int):
    """
    Sends a raw RGB frame to the virtual camera.
    Expects 3 bytes per pixel (RGB) — alpha is stripped on the frontend.
    """
    global _active_camera
    if _active_camera is None:
        return
    
    try:
        # Expect raw RGB pixels from the frontend (width * height * 3) bytes
        if len(frame_bytes) != width * height * 3:
            print(f"Invalid frame size: {len(frame_bytes)} bytes for {width}x{height} RGB")
            return
            
        frame_rgb = np.frombuffer(frame_bytes, dtype=np.uint8).reshape((height, width, 3))
        
        # In case we need to resize to match camera size
        if _active_camera.width != width or _active_camera.height != height:
            frame_rgb = cv2.resize(frame_rgb, (_active_camera.width, _active_camera.height))
            
        _active_camera.send(frame_rgb)
        # _active_camera.sleep_until_next_frame()  # Removed to prevent freezing, relying on frontend pacing
    except Exception as e:
        print(f"Error sending frame to virtual camera: {e}")

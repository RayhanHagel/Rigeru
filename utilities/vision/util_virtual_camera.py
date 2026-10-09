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
    Check if a compatible OBS Virtual Camera driver device is installed and reachable.

    Returns:
        bool: True if virtual camera device can be opened, False otherwise.
    """
    try:
        # Try to open a dummy camera
        with pyvirtualcam.Camera(width=100, height=100, fps=30, fmt=pyvirtualcam.PixelFormat.RGB) as cam:
            return True
    except Exception as e:
        print(f"Virtual camera check failed: {e}")
        return False

def start_virtual_camera(width: int = 1280, height: int = 720, fps: int = 30) -> bool:
    """
    Initialize and open the virtual camera output device.

    Args:
        width (int, optional): Frame width resolution. Defaults to 1280.
        height (int, optional): Frame height resolution. Defaults to 720.
        fps (int, optional): Target frame rate. Defaults to 30.

    Returns:
        bool: True if virtual camera opened successfully, False otherwise.
    """
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

def stop_virtual_camera() -> None:
    """
    Close and release the active virtual camera output stream.

    Returns:
        None
    """
    global _active_camera
    if _active_camera is not None:
        _active_camera.close()
        _active_camera = None
        print("Stopped virtual camera.")

def send_frame_bgr(frame_bgr: np.ndarray) -> None:
    """
    Send an OpenCV BGR numpy array frame directly to the virtual camera device.

    Args:
        frame_bgr (np.ndarray): Source BGR image frame array.

    Returns:
        None
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

def send_frame(frame_bytes: bytes, width: int, height: int) -> None:
    """
    Send raw RGB binary byte frame payload to the virtual camera device.

    Args:
        frame_bytes (bytes): Packed raw binary RGB frame bytes.
        width (int): Source frame width.
        height (int): Source frame height.

    Returns:
        None
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

import cv2
import threading
from typing import Generator, Optional
from utilities.vision.util_image_fx import make_blur_fn, apply_blur_fn

def generate_face_blur_webcam_frames(
    camera_index: int,
    blur_type: str = "gaussian",
    blur_strength: int = 25,
    stop_event: Optional[threading.Event] = None
) -> Generator[bytes, None, None]:
    """
    Capture live webcam frames, run facial detection, and yield anonymized JPEG byte frames.

    Args:
        camera_index (int): Index of the physical webcam device.
        blur_type (str, optional): Anonymization style ('gaussian', 'pixelate', 'blackout'). Defaults to 'gaussian'.
        blur_strength (int, optional): Blur kernel radius. Defaults to 25.
        stop_event (Optional[threading.Event], optional): Thread event to terminate the stream. Defaults to None.

    Yields:
        bytes: Multipart JPEG video frame stream chunks.

    Returns:
        Generator[bytes, None, None]: Frame generator streaming video.
    """
    from utilities.vision.util_face_blur import load_face_detector
    detector, _ = load_face_detector()
    blur_fn = make_blur_fn(blur_strength, blur_type)

    cap = cv2.VideoCapture(camera_index)
    try:
        while not (stop_event and stop_event.is_set()):
            ret, frame = cap.read()
            if not ret:
                break
            if detector:
                faces = detector.get(frame)
                for face in faces:
                    x1, y1, x2, y2 = face.bbox.astype(int)
                    frame = apply_blur_fn(frame, x1, y1, x2 - x1, y2 - y1, blur_fn)
            is_success, buffer = cv2.imencode(".jpg", frame)
            if is_success:
                yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    finally:
        cap.release()

def generate_depth_webcam_frames(
    camera_index: int,
    colormap: str = "INFERNO",
    invert: bool = False,
    ai_fps: float = 5.0,
    stop_event: Optional[threading.Event] = None
) -> Generator[bytes, None, None]:
    """
    Capture live webcam video, run neural monocular depth estimation, and yield colorized JPEG frames.

    Args:
        camera_index (int): Hardware webcam device index.
        colormap (str, optional): Colormap palette name ('INFERNO', 'PLASMA', etc.). Defaults to 'INFERNO'.
        invert (bool, optional): Invert depth values so foreground is bright. Defaults to False.
        ai_fps (float, optional): Inference frame rate cap. Defaults to 5.0.
        stop_event (Optional[threading.Event], optional): Thread termination event. Defaults to None.

    Yields:
        bytes: Multipart JPEG video frame chunks.

    Returns:
        Generator[bytes, None, None]: Frame generator streaming depth video.
    """
    from utilities.vision.util_depth_estimation import load_depth_onnx, _preprocess_frame, apply_colormap_raw
    session, success, _ = load_depth_onnx("small", "cpu")
    cap = cv2.VideoCapture(camera_index)
    try:
        while not (stop_event and stop_event.is_set()):
            ret, frame = cap.read()
            if not ret:
                break
            if session:
                target_size = (frame.shape[1], frame.shape[0])
                inp = _preprocess_frame(frame, input_size=518)
                input_name = session.get_inputs()[0].name
                outs = session.run(None, {input_name: inp})
                depth_raw = outs[0].squeeze()
                frame = apply_colormap_raw(depth_raw, colormap, invert, target_size)
            is_success, buffer = cv2.imencode(".jpg", frame)
            if is_success:
                yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    finally:
        cap.release()

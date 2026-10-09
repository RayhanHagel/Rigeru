import os
import shutil
import subprocess
import threading
import logging
import queue
from typing import Tuple, Optional, Any, Callable
from functools import lru_cache
import numpy as np

# Import the refactored shared utilities
from utilities.core.util_huggingface import download_hf_file, quantize_onnx_model

CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")


def _ensure_paths() -> None:
    """
    Ensure that the cache, models, and temp directories exist on local disk.

    Returns:
        None
    """
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)
    os.makedirs(os.path.join(CACHE_DIR, "models"), exist_ok=True)

# ---------------------------------------------------------------------------
# ONNX Model Management
# ---------------------------------------------------------------------------

def _ensure_depth_model(model_size: str) -> str:
    """
    Download the ONNX version of Depth Anything V2 from the official ONNX Community if not cached.

    Args:
        model_size (str): Model footprint ('base' or 'small').

    Returns:
        str: Absolute filesystem path to downloaded ONNX model weight file.
    """
    size_key = "base" if "base" in str(model_size).lower() else "small"
    repo_id = f"onnx-community/depth-anything-v2-{size_key}"
    model_path = os.path.join(
        CACHE_DIR, "models", f"depth_anything_v2_{size_key}.onnx")

    success = download_hf_file(
        repo_id=repo_id, filename="onnx/model.onnx", output_path=model_path)
    return model_path if success else ""


@lru_cache(maxsize=2)
def load_depth_onnx(model_size: str, engine: str, precision: str = "fp32") -> Tuple[Optional[Any], bool, str]:
    """
    Load an ONNX Runtime inference session configured with specified hardware execution provider.

    Args:
        model_size (str): Model footprint ('base' or 'small').
        engine (str): Compute engine provider ('tensorrt', 'onnx', or 'cpu').
        precision (str, optional): Numerical precision ('fp32', 'fp16', 'int8'). Defaults to 'fp32'.

    Returns:
        Tuple[Optional[Any], bool, str]: Tuple containing the InferenceSession, success boolean, and message.
    """
    import onnxruntime as ort

    model_path = _ensure_depth_model(model_size)
    if not model_path:
        return None, False, "Failed to locate or download ONNX model."

    if precision == "int8":
        quant_path = model_path.replace(".onnx", "_int8.onnx")
        model_path = quantize_onnx_model(model_path, quant_path)

    providers = []
    if engine == "tensorrt":
        trt_options = {
            'trt_engine_cache_enable': True,
            'trt_engine_cache_path': os.path.join(CACHE_DIR, "models"),
            'trt_fp16_enable': True if precision == "fp16" else False
        }
        providers = [('TensorrtExecutionProvider', trt_options),
                     'CUDAExecutionProvider', 'CPUExecutionProvider']

    elif engine == "onnx":
        providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']

    else:
        providers = ['CPUExecutionProvider']

    try:
        session = ort.InferenceSession(model_path, providers=providers)
        return session, True, "Success"
    except Exception as e:
        return None, False, str(e)

# ---------------------------------------------------------------------------
# Pre/Post Processing Helpers
# ---------------------------------------------------------------------------

def _preprocess_frame(frame_bgr: np.ndarray, input_size: int = 518) -> np.ndarray:
    """
    Normalize and preprocess an input BGR OpenCV image array into an NCHW tensor for Depth Anything.

    Args:
        frame_bgr (np.ndarray): Source BGR image array.
        input_size (int, optional): Square spatial dimension for model input. Defaults to 518.

    Returns:
        np.ndarray: Preprocessed 4D float32 tensor shaped `(1, 3, input_size, input_size)`.
    """
    import cv2

    img = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (input_size, input_size),
                     interpolation=cv2.INTER_AREA)

    img = img.astype(np.float32) / 255.0

    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img = (img - mean) / std

    img = img.transpose(2, 0, 1)
    img = np.expand_dims(img, axis=0)

    return img


def apply_colormap_raw(depth_raw: np.ndarray, colormap_name: str, invert: bool, target_size: Tuple[int, int]) -> np.ndarray:
    """
    Convert a raw float depth prediction matrix into a false-color BGR visualization image.

    Args:
        depth_raw (np.ndarray): 2D float depth prediction map from model.
        colormap_name (str): Colormap identifier ('INFERNO', 'PLASMA', 'VIRIDIS', 'MAGMA', 'JET', 'GRAY').
        invert (bool): Invert depth values so foreground is bright.
        target_size (Tuple[int, int]): Output dimensions `(width, height)`.

    Returns:
        np.ndarray: Colorized 3-channel uint8 BGR image.
    """
    import cv2

    depth_resized = cv2.resize(
        depth_raw, target_size, interpolation=cv2.INTER_LANCZOS4)

    d_min, d_max = depth_resized.min(), depth_resized.max()
    if d_max - d_min > 0:
        depth_norm = 255.0 * (depth_resized - d_min) / (d_max - d_min)
    else:
        depth_norm = depth_resized

    depth_norm = depth_norm.astype(np.uint8)

    if invert:
        depth_norm = 255 - depth_norm

    if colormap_name == "GRAY":
        return cv2.cvtColor(depth_norm, cv2.COLOR_GRAY2BGR)

    cmap_mapping = {
        "INFERNO": cv2.COLORMAP_INFERNO, "PLASMA": cv2.COLORMAP_PLASMA,
        "VIRIDIS": cv2.COLORMAP_VIRIDIS, "MAGMA": cv2.COLORMAP_MAGMA,
        "JET": cv2.COLORMAP_JET
    }

    cmap = cmap_mapping.get(colormap_name, cv2.COLORMAP_INFERNO)
    return cv2.applyColorMap(depth_norm, cmap)

# ---------------------------------------------------------------------------
# Core Processing APIs
# ---------------------------------------------------------------------------

def process_image_depth(
    input_path: str,
    model_size: str,
    engine: str,
    precision: str,
    colormap: str,
    invert: bool
) -> Tuple[bool, Optional[str], str]:
    """
    Estimate monocular depth map for a single image and save the colorized result.

    Args:
        input_path (str): Filesystem path to source image.
        model_size (str): Model footprint size ('base' or 'small').
        engine (str): Execution provider engine ('tensorrt', 'onnx', or 'cpu').
        precision (str): Numerical precision format ('fp32', 'fp16', 'int8').
        colormap (str): Color palette name.
        invert (bool): Invert depth polarity.

    Returns:
        Tuple[bool, Optional[str], str]: Success boolean, output file path, and status message.
    """
    import cv2

    if not os.path.isfile(input_path):
        return False, None, f"Input image does not exist: {input_path}"

    _ensure_paths()

    session, success, msg = load_depth_onnx(model_size, engine, precision)
    if not success:
        return False, None, f"Failed to load ONNX model: {msg}"

    try:
        frame = cv2.imread(input_path)
        if frame is None:
            return False, None, "Could not open image file."

        target_size = (frame.shape[1], frame.shape[0])

        input_tensor = _preprocess_frame(frame, input_size=518)

        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: input_tensor})
        raw_depth = np.squeeze(outputs[0])

        colored_bgr = apply_colormap_raw(
            raw_depth, colormap, invert, target_size)

        filename = os.path.basename(input_path)
        out_path = os.path.join(TEMP_DIR, f"depth_{filename}")
        cv2.imwrite(out_path, colored_bgr)

        return True, out_path, "Success"

    except Exception as e:
        return False, None, str(e)


def process_video_depth(
    input_path: str,
    model_size: str,
    engine: str,
    precision: str,
    colormap: str,
    invert: bool,
    encoder: str = "libx264",
    progress_hook: Optional[Callable[[float], None]] = None,
    ai_fps: float = 5.0
) -> Tuple[bool, Optional[str], str]:
    """
    Process video stream to generate an aligned monocular depth estimation video.

    Args:
        input_path (str): Source video file path.
        model_size (str): Model footprint size ('base' or 'small').
        engine (str): Compute engine provider.
        precision (str): Numerical precision format.
        colormap (str): Color palette name.
        invert (bool): Invert depth values.
        encoder (str, optional): FFmpeg video encoder. Defaults to "libx264".
        progress_hook (Optional[Callable[[float], None]], optional): Progress callback. Defaults to None.
        ai_fps (float, optional): Rate of AI inference frames per second. Defaults to 5.0.

    Returns:
        Tuple[bool, Optional[str], str]: Success boolean, output video path, and status message.
    """
    import cv2

    if not os.path.isfile(input_path):
        return False, None, f"Input video file does not exist: {input_path}"

    _ensure_paths()

    session, success, msg = load_depth_onnx(model_size, engine, precision)
    if not success:
        return False, None, f"Failed to load ONNX model: {msg}"

    input_name = session.get_inputs()[0].name
    filename = os.path.basename(input_path)
    final_out_path = os.path.join(TEMP_DIR, f"depth_{filename}")

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        return False, None, "Could not open video file."

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    target_size = (width, height)

    from utilities.audio_video.util_video_stream import VideoPipeWriter
    writer = VideoPipeWriter(final_out_path, width, height, fps, input_path=input_path, encoder=encoder)

    frames_processed = 0
    last_inference_idx = -9999
    inference_interval_frames = fps / ai_fps if ai_fps > 0 else 0
    last_raw_depth = None

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frames_processed - last_inference_idx >= inference_interval_frames or last_raw_depth is None:
                input_tensor = _preprocess_frame(frame, input_size=518)
                outputs = session.run(None, {input_name: input_tensor})
                last_raw_depth = np.squeeze(outputs[0])
                last_inference_idx = frames_processed

            colored_bgr = apply_colormap_raw(
                last_raw_depth, colormap, invert, target_size)
            writer.write_frame(colored_bgr)

            frames_processed += 1
            if progress_hook:
                update_interval = max(1, int(total_frames / 100))
                if frames_processed % update_interval == 0:
                    progress_hook(
                        min(1.0, frames_processed / max(1, total_frames)))

    except Exception as e:
        return False, None, str(e)
    finally:
        cap.release()
        writer.close()

    if progress_hook:
        progress_hook(1.0)
    return True, final_out_path, "Success"

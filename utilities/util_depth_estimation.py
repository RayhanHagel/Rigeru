import os
import shutil
import subprocess
import threading
import logging
import queue
from functools import lru_cache

# Import the refactored shared utilities
from utilities.util_huggingface import download_hf_file, quantize_onnx_model

CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")


def _ensure_paths():
    """Ensures that the cache and models directories exist."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)
    os.makedirs(os.path.join(CACHE_DIR, "models"), exist_ok=True)

# ---------------------------------------------------------------------------
# ONNX Model Management
# ---------------------------------------------------------------------------


def _ensure_depth_model(model_size: str) -> str:
    """Downloads the ONNX version of Depth Anything V2 from the official ONNX Community."""
    repo_map = {
        "Small": "onnx-community/depth-anything-v2-small",
        "Base": "onnx-community/depth-anything-v2-base"
    }
    repo_id = repo_map.get(
        model_size, "onnx-community/depth-anything-v2-small")

    model_path = os.path.join(
        CACHE_DIR, "models", f"depth_anything_v2_{model_size.lower()}.onnx")

    success = download_hf_file(
        repo_id=repo_id, filename="onnx/model.onnx", output_path=model_path)
    return model_path if success else ""


@lru_cache(maxsize=2)
def load_depth_onnx(model_size: str, engine: str, precision: str = "fp32"):
    """Loads the ONNX Runtime session using the selected hardware provider and precision."""
    import onnxruntime as ort

    # 1. Get Base FP32 Model
    model_path = _ensure_depth_model(model_size)
    if not model_path:
        return None, False, "Failed to locate or download ONNX model."

    # 2. Apply INT8 Quantization if requested using shared utility
    if precision == "int8":
        quant_path = model_path.replace(".onnx", "_int8.onnx")
        model_path = quantize_onnx_model(model_path, quant_path)

    # 3. Configure Execution Providers and FP16 Flags
    providers = []
    if engine == "tensorrt":
        # TensorRT automatically casts to FP16 inside the execution engine if told to
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

def _preprocess_frame(frame_bgr, input_size=518):
    """Replicates the Hugging Face DPTImageProcessor in pure NumPy/OpenCV."""
    import cv2
    import numpy as np

    # Convert BGR to RGB and resize
    img = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (input_size, input_size),
                     interpolation=cv2.INTER_AREA)

    # Scale to 0-1
    img = img.astype(np.float32) / 255.0

    # ImageNet Normalization
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img = (img - mean) / std

    # HWC to CHW format for ONNX
    img = img.transpose(2, 0, 1)
    # Add batch dimension (NCHW)
    img = np.expand_dims(img, axis=0)

    return img


def apply_colormap_raw(depth_raw, colormap_name: str, invert: bool, target_size: tuple):
    """Processes the raw float array from ONNX directly into a colored frame."""
    import cv2
    import numpy as np

    # Resize raw depth map back to original video resolution
    depth_resized = cv2.resize(
        depth_raw, target_size, interpolation=cv2.INTER_LANCZOS4)

    # Min-Max normalization to 0-255
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

def process_image_depth(input_path: str, model_size: str, engine: str, precision: str, colormap: str, invert: bool):
    """Processes a single image to estimate depth and applies a colormap."""
    import cv2
    import numpy as np

    _ensure_paths()

    session, success, msg = load_depth_onnx(model_size, engine, precision)
    if not success:
        return False, None, f"Failed to load ONNX model: {msg}"

    try:
        # Read Image using OpenCV
        frame = cv2.imread(input_path)
        if frame is None:
            return False, None, "Could not open image file."

        target_size = (frame.shape[1], frame.shape[0])

        # 1. CPU Pre-processing
        input_tensor = _preprocess_frame(frame, input_size=518)

        # 2. ONNX Inference
        input_name = session.get_inputs()[0].name
        outputs = session.run(None, {input_name: input_tensor})
        raw_depth = np.squeeze(outputs[0])

        # 3. Apply visual styles
        colored_bgr = apply_colormap_raw(
            raw_depth, colormap, invert, target_size)

        # Save output
        filename = os.path.basename(input_path)
        out_path = os.path.join(TEMP_DIR, f"depth_{filename}")
        cv2.imwrite(out_path, colored_bgr)

        return True, out_path, "Success"

    except Exception as e:
        return False, None, str(e)


def process_video_depth(input_path: str, model_size: str, engine: str, precision: str, colormap: str, invert: bool, encoder: str = "libx264", progress_hook=None, ai_fps: float = 5.0):
    """Processes a video to estimate depth frame by frame and encodes the output."""
    import cv2
    import numpy as np

    _ensure_paths()

    session, success, msg = load_depth_onnx(model_size, engine, precision)
    if not success:
        return False, None, f"Failed to load ONNX model: {msg}"

    input_name = session.get_inputs()[0].name
    filename = os.path.basename(input_path)
    final_out_path = os.path.join(TEMP_DIR, f"depth_{filename}")
    has_ffmpeg = shutil.which("ffmpeg") is not None

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        return False, None, "Could not open video file."

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    target_size = (width, height)

    if has_ffmpeg:
        cmd = [
            "ffmpeg", "-y",
            "-f", "rawvideo", "-vcodec", "rawvideo", "-s", f"{width}x{height}", "-pix_fmt", "bgr24", "-r", str(
                fps),
            "-i", "-",
            "-c:v", encoder, "-pix_fmt", "yuv420p",
            final_out_path
        ]
        writer_proc = subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer_cv2 = cv2.VideoWriter(
            final_out_path, fourcc, fps, (width, height))

    # Background Post-Processing Thread
    write_queue = queue.Queue(maxsize=30)

    def post_process_and_write():
        while True:
            item = write_queue.get()
            if item is None:
                break

            raw_depth = item
            colored_bgr = apply_colormap_raw(
                raw_depth, colormap, invert, target_size)

            if has_ffmpeg:
                writer_proc.stdin.write(colored_bgr.tobytes())
            else:
                writer_cv2.write(colored_bgr)

            write_queue.task_done()

    writer_thread = threading.Thread(
        target=post_process_and_write, daemon=True)
    writer_thread.start()

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
                # 1. CPU Pre-processing
                input_tensor = _preprocess_frame(frame, input_size=518)

                # 2. ONNX GPU Inference
                outputs = session.run(None, {input_name: input_tensor})
                last_raw_depth = np.squeeze(outputs[0])
                last_inference_idx = frames_processed

            # 3. Offload CPU Post-processing and Disk I/O to background thread
            write_queue.put(last_raw_depth)

            frames_processed += 1
            if progress_hook:
                # Smooth 1% UI update mapping
                update_interval = max(1, int(total_frames / 100))
                if frames_processed % update_interval == 0:
                    progress_hook(
                        min(1.0, frames_processed / max(1, total_frames)))

    except Exception as e:
        return False, None, str(e)
    finally:
        cap.release()
        write_queue.put(None)
        writer_thread.join()

        if has_ffmpeg:
            writer_proc.stdin.close()
            writer_proc.wait()
        else:
            writer_cv2.release()

    if progress_hook:
        progress_hook(1.0)
    return True, final_out_path, "Success"

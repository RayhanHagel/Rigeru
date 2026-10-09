import os
import shutil
import subprocess
import threading
import queue
import tempfile
from typing import Tuple, Optional, Any, Callable, List
from functools import lru_cache

# Import shared utilities
from utilities.core.util_huggingface import download_hf_file, quantize_onnx_model
from utilities.core.util_time_format import format_ass_time
from utilities.vision.util_image_fx import make_blur_fn, apply_blur_fn

CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")


def _ensure_paths() -> None:
    """
    Ensure that required cache and temporary directories exist on local disk.

    Returns:
        None
    """
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Download & Model Loading
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def load_nsfw_detector(model_type: str = "default", engine: str = "cpu", precision: str = "fp32") -> Tuple[Optional[Any], bool]:
    """
    Load and cache the NudeNet model instance for neural NSFW detection.

    Args:
        model_type (str, optional): Detector size variant ('default', '320', or '640'). Defaults to "default".
        engine (str, optional): Execution provider ('tensorrt', 'onnx', or 'cpu'). Defaults to "cpu".
        precision (str, optional): Inference precision ('fp32', 'fp16', 'int8'). Defaults to "fp32".

    Returns:
        Tuple[Optional[Any], bool]: Tuple of (NudeDetector instance or None, success boolean).
    """
    try:
        from nudenet import NudeDetector

        if engine == "tensorrt":
            providers = ['TensorrtExecutionProvider',
                         'CUDAExecutionProvider', 'CPUExecutionProvider']
        elif engine == "onnx":
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        else:
            providers = ['CPUExecutionProvider']

        actual_name = "320n.onnx" if (
            model_type == "default" or "320" in model_type) else "640m.onnx"
        model_path = os.path.join(CACHE_DIR, "models", actual_name)

        if "640" in actual_name:
            success = download_hf_file(
                "xxparthparekhxx/NudeNet-FastAPI", "640m.onnx", model_path, repo_type="space")
        else:
            success = download_hf_file(
                "deepghs/nudenet_onnx", "320n.onnx", model_path)

        final_model_path = model_path if success else "default"

        if precision == "int8" and final_model_path != "default":
            quant_path = final_model_path.replace(".onnx", "_int8.onnx")
            final_model_path = quantize_onnx_model(
                final_model_path, quant_path)

        if final_model_path != "default" and os.path.exists(final_model_path):
            return NudeDetector(model_path=final_model_path, providers=providers), True
        else:
            return NudeDetector(providers=providers), True

    except ImportError:
        return None, False
    except Exception as e:
        print(f"Warning loading detector: {e}")
        try:
            from nudenet import NudeDetector
            return NudeDetector(providers=['CPUExecutionProvider']), True
        except Exception:
            return None, False


# ---------------------------------------------------------------------------
# Core Processing
# ---------------------------------------------------------------------------

def process_media_censor(
    input_path: str,
    target_classes: List[str],
    scan_fps: float = 2.0,
    method: str = "subtitle",
    model_type: str = "default",
    engine: str = "cpu",
    precision: str = "fp32",
    blur_intensity: int = 50,
    blur_type: str = "Gaussian",
    encoder: str = "libx264",
    progress_hook: Optional[Callable[[float], None]] = None
) -> Tuple[bool, str]:
    """
    Process image or video to censor specified NSFW classes via blurring or ASS subtitle overlay.

    Args:
        input_path (str): Path to input image or video file.
        target_classes (List[str]): List of NSFW class names to detect and censor.
        scan_fps (float, optional): Sampling frequency for video inference. Defaults to 2.0.
        method (str, optional): Censor method ('subtitle' for ASS overlay, 'reencode' for pixel blur). Defaults to "subtitle".
        model_type (str, optional): NudeNet model variant ('default', '320', '640'). Defaults to "default".
        engine (str, optional): Compute engine provider. Defaults to "cpu".
        precision (str, optional): Model numerical precision. Defaults to "fp32".
        blur_intensity (int, optional): Blur strength kernel value. Defaults to 50.
        blur_type (str, optional): Visual blur style ('Gaussian', 'Pixelate', 'Solid'). Defaults to "Gaussian".
        encoder (str, optional): Video encoder. Defaults to "libx264".
        progress_hook (Optional[Callable[[float], None]], optional): Progress callback. Defaults to None.

    Returns:
        Tuple[bool, str]: Success boolean and path to output censored file or error description.
    """
    import cv2
    import numpy as np

    if not os.path.isfile(input_path):
        return False, f"File not found: {input_path}"

    _ensure_paths()
    filename = os.path.basename(input_path)
    is_video = filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))

    detector, is_loaded = load_nsfw_detector(model_type, engine, precision)
    if not is_loaded:
        return False, "Missing dependency. Please run: `pip install nudenet opencv-python numpy onnxruntime-gpu`"

    # --- Image Processing ---
    if not is_video:
        img = cv2.imread(input_path)
        if img is None:
            return False, "Could not open image file."

        blur_fn = make_blur_fn(blur_intensity, blur_type)
        try:
            detections = detector.detect(img)
            for det in detections:
                if det.get('class') in target_classes and det.get('score', 0) > 0.4:
                    x, y, w, h = [int(v) for v in det['box']]
                    img = apply_blur_fn(img, x, y, w, h, blur_fn)
        except Exception:
            pass

        out_path = os.path.join(TEMP_DIR, f"censored_{filename}")
        cv2.imwrite(out_path, img)
        if progress_hook:
            progress_hook(1.0)
        return True, out_path

    # --- Video Processing ---
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        return False, "Could not open video file."

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_step = max(1, int(fps / scan_fps)) if scan_fps > 0 else 1

    try:
        # METHOD A: Fast Subtitle Overlay
        if method == "subtitle":
            ass_header = f"""[Script Info]
Title: AI Censor Overlay
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: CensorBox,Arial,20,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"""
            ass_events = []
            current_frame = 0

            while current_frame < total_frames:
                cap.set(cv2.CAP_PROP_POS_FRAMES, current_frame)
                ret, frame = cap.read()
                if not ret:
                    break

                start_str = format_ass_time(current_frame / fps)
                end_str = format_ass_time((current_frame + frame_step) / fps)

                try:
                    detections = detector.detect(frame)
                    for det in detections:
                        if det.get('class') in target_classes and det.get('score', 0) > 0.4:
                            x, y, w, h = [int(v) for v in det['box']]
                            roi = frame[max(0, y):min(
                                height, y+h), max(0, x):min(width, x+w)]
                            if roi.size > 0:
                                avg_color = np.average(
                                    np.average(roi, axis=0), axis=0)
                                b, g, r = int(avg_color[0]), int(
                                    avg_color[1]), int(avg_color[2])
                                hex_color = f"&H00{b:02X}{g:02X}{r:02X}&"
                            else:
                                hex_color = "&H00000000&"

                            vector_cmd = f"{{\\pos({x},{y})}}{{\\blur20}}{{\\1a&H00&}}{{\\1c{hex_color}}}{{\\p1}}m 0 0 l {w} 0 l {w} {h} l 0 {h} l 0 0{{\\p0}}"
                            ass_events.append(
                                f"Dialogue: 0,{start_str},{end_str},CensorBox,,0,0,0,,{vector_cmd}")
                except Exception:
                    pass

                current_frame += frame_step
                if progress_hook:
                    progress_hook(min(1.0, current_frame / max(1, total_frames)))

            cap.release()
            out_path = os.path.join(
                TEMP_DIR, os.path.splitext(filename)[0] + "_censor.ass")
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(ass_header + "\n".join(ass_events))
            return True, out_path

        # METHOD B: Hard Re-encode (FFmpeg + Multithreading)
        elif method == "reencode":
            from utilities.audio_video.util_video_stream import VideoPipeWriter
            blur_fn = make_blur_fn(blur_intensity, blur_type)
            final_out_path = os.path.join(
                TEMP_DIR, f"final_censored_{filename}")

            pipe_writer = VideoPipeWriter(
                final_out_path, width, height, fps, input_path=input_path, encoder=encoder
            )

            read_queue: queue.Queue = queue.Queue(maxsize=32)
            write_queue = {}
            write_lock = threading.Lock()
            write_cond = threading.Condition(write_lock)
            frames_written = 0
            WINDOW_SIZE = 64

            def producer():
                cap_prod = cv2.VideoCapture(input_path)
                current_boxes = []
                for i in range(total_frames):
                    ret, frame = cap_prod.read()
                    if not ret:
                        break

                    if i % frame_step == 0:
                        try:
                            detections = detector.detect(frame)
                            current_boxes = [
                                det['box'] for det in detections if det.get('class') in target_classes and det.get('score', 0) > 0.4]
                        except Exception:
                            pass

                    read_queue.put((i, frame, current_boxes))
                read_queue.put(None)
                cap_prod.release()

            def worker():
                while True:
                    item = read_queue.get()
                    if item is None:
                        read_queue.put(None)
                        break

                    idx, frame, boxes = item

                    with write_cond:
                        while idx > frames_written + WINDOW_SIZE:
                            write_cond.wait(timeout=0.1)
                            if not any(w.is_alive() for w in workers if w is not threading.current_thread()):
                                break

                    for box in boxes:
                        x, y, w, h = [int(v) for v in box]
                        frame = apply_blur_fn(frame, x, y, w, h, blur_fn)

                    with write_cond:
                        write_queue[idx] = frame
                        write_cond.notify_all()

            def consumer():
                nonlocal frames_written
                while frames_written < total_frames:
                    with write_cond:
                        while frames_written not in write_queue:
                            write_cond.wait(timeout=0.5)
                            if not any(w.is_alive() for w in workers) and frames_written not in write_queue:
                                return

                        if frames_written in write_queue:
                            frame = write_queue.pop(frames_written)

                    pipe_writer.write_frame(frame)

                    frames_written += 1
                    if progress_hook and frames_written % 2 == 0:
                        progress_hook(min(1.0, frames_written / max(1, total_frames)))

            t_prod = threading.Thread(target=producer)
            t_cons = threading.Thread(target=consumer)
            num_workers = max(2, (os.cpu_count() or 2) - 1)
            workers = [threading.Thread(target=worker)
                       for _ in range(num_workers)]

            t_prod.start()
            t_cons.start()
            for w in workers:
                w.start()

            t_prod.join()
            for w in workers:
                w.join()
            t_cons.join()

            pipe_writer.close()
            if progress_hook:
                progress_hook(1.0)
            return True, final_out_path

        else:
            return False, f"Unknown censor method: {method}"

    finally:
        if cap.isOpened():
            cap.release()

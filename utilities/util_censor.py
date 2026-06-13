import os
import shutil
import subprocess
import threading
import queue
import streamlit as st
from streamlit.runtime.scriptrunner import add_script_run_ctx

CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")


def _ensure_paths():
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Hardware & Encoder Probing
# ---------------------------------------------------------------------------


@st.cache_data
def get_available_encoders():
    """Probes local FFmpeg for available hardware accelerated encoders."""
    if not shutil.which("ffmpeg"):
        return ["cv2 (No FFmpeg / Fallback)"]

    try:
        res = subprocess.run(["ffmpeg", "-encoders"],
                             capture_output=True, text=True)
        hw_candidates = {
            'h264_nvenc':        'h264_nvenc (Nvidia GPU)',
            'hevc_nvenc':        'hevc_nvenc (Nvidia GPU H.265)',
            'h264_videotoolbox': 'h264_videotoolbox (Apple Silicon)',
            'h264_qsv':          'h264_qsv (Intel QuickSync)',
            'h264_amf':          'h264_amf (AMD GPU)'
        }

        available = ["libx264 (CPU Standard)"]
        for enc, label in hw_candidates.items():
            if enc in res.stdout:
                available.append(label)
        return available
    except Exception:
        return ["libx264 (CPU Standard)"]

# ---------------------------------------------------------------------------
# Download & Model Loading
# ---------------------------------------------------------------------------


def _ensure_nudenet_model(model_name: str) -> str:
    if model_name == "default" or "320" in model_name:
        return "default"

    model_path = os.path.join(CACHE_DIR, "models", model_name)
    if os.path.exists(model_path):
        return model_path

    print(f"Downloading {model_name} from Hugging Face...")
    os.makedirs(os.path.dirname(model_path), exist_ok=True)

    try:
        # LAZY IMPORT
        from huggingface_hub import hf_hub_download
        if "640" in model_name:
            downloaded_path = hf_hub_download(
                repo_id="xxparthparekhxx/NudeNet-FastAPI",
                filename="640m.onnx",
                repo_type="space"
            )
        else:
            downloaded_path = hf_hub_download(
                repo_id="deepghs/nudenet_onnx", filename="320n.onnx")

        shutil.copy2(downloaded_path, model_path)
        return model_path
    except Exception as e:
        print(f"Failed to download {model_name} from Hugging Face: {e}")
        return "default"


def _quantize_nudenet_model(model_name: str) -> str:
    actual_name = "320n.onnx" if (
        model_name == "default" or "320" in model_name) else model_name
    base_model_path = _ensure_nudenet_model(actual_name)

    if base_model_path == "default":
        print("Could not locate base model for quantization. Falling back to default FP32.")
        return "default"

    quant_path = base_model_path.replace(".onnx", "_int8.onnx")

    if os.path.exists(quant_path):
        return quant_path

    try:
        # LAZY IMPORT
        from onnxruntime.quantization import quantize_dynamic, QuantType
        print(f"Quantizing {actual_name} to INT8. This only happens once...")
        quantize_dynamic(base_model_path, quant_path,
                         weight_type=QuantType.QUInt8)
        return quant_path
    except Exception as e:
        print(f"Quantization failed: {e}. Falling back to FP32.")
        return base_model_path


@st.cache_resource(show_spinner=False)
def load_nsfw_detector(model_type: str = "default", engine: str = "cpu", precision: str = "fp32"):
    try:
        # LAZY IMPORT
        from nudenet import NudeDetector
        if engine == "tensorrt":
            providers = ['TensorrtExecutionProvider',
                         'CUDAExecutionProvider', 'CPUExecutionProvider']
        elif engine == "onnx":
            providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
        else:
            providers = ['CPUExecutionProvider']

        if precision == "int8":
            final_model_path = _quantize_nudenet_model(model_type)
        else:
            final_model_path = _ensure_nudenet_model(model_type)

        if final_model_path != "default" and os.path.exists(final_model_path):
            return NudeDetector(model_path=final_model_path, providers=providers), True
        else:
            return NudeDetector(providers=providers), True

    except ImportError:
        return None, False
    except Exception as e:
        print(f"Warning loading detector: {e}")
        # LAZY IMPORT
        from nudenet import NudeDetector
        return NudeDetector(providers=['CPUExecutionProvider']), True


def format_ass_time(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centisecs = int((seconds * 100) % 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"

# ---------------------------------------------------------------------------
# Blur Helpers
# ---------------------------------------------------------------------------


def _make_blur_fn(blur_intensity: int, blur_type: str):
    # LAZY IMPORT
    import cv2
    if blur_type == "Gaussian":
        k = int(blur_intensity) * 2 + 1
        return lambda roi: cv2.GaussianBlur(roi, (k, k), 30)
    else:
        ratio = max(1, 100 - blur_intensity) / 100.0

        def _blur(roi):
            h, w = roi.shape[:2]
            sw, sh = max(1, int(w * ratio)), max(1, int(h * ratio))
            return cv2.resize(cv2.resize(roi, (sw, sh), interpolation=cv2.INTER_LINEAR), (w, h), interpolation=cv2.INTER_NEAREST)
        return _blur


def _apply_blur_fn(image, x, y, w, h, blur_fn):
    ih, iw = image.shape[:2]
    x, y, x2, y2 = max(0, x), max(0, y), min(iw, x + w), min(ih, y + h)
    if x2 > x and y2 > y:
        image[y:y2, x:x2] = blur_fn(image[y:y2, x:x2])
    return image

# ---------------------------------------------------------------------------
# Core Processing
# ---------------------------------------------------------------------------


def process_media_censor(
    input_path: str,
    target_classes: list[str],
    scan_fps: float = 2.0,
    method: str = "subtitle",
    model_type: str = "default",
    engine: str = "cpu",
    precision: str = "fp32",
    blur_intensity: int = 50,
    blur_type: str = "Gaussian",
    encoder: str = "libx264",
    progress_hook=None
) -> tuple[bool, str]:

    # LAZY IMPORTS: Only loaded when the pipeline actually starts running
    import cv2
    import numpy as np

    _ensure_paths()
    filename = os.path.basename(input_path)
    is_video = filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))

    detector, is_loaded = load_nsfw_detector(model_type, engine, precision)
    if not is_loaded:
        return False, "Missing dependency. Please run: `pip install nudenet opencv-python numpy onnxruntime-gpu`"

    if not os.path.exists(input_path):
        return False, "File not found."

    # --- Image Processing ---
    if not is_video:
        img = cv2.imread(input_path)
        if img is None:
            return False, "Could not open image file."

        blur_fn = _make_blur_fn(blur_intensity, blur_type)
        try:
            detections = detector.detect(img)
            for det in detections:
                if det['class'] in target_classes and det['score'] > 0.4:
                    x, y, w, h = [int(v) for v in det['box']]
                    img = _apply_blur_fn(img, x, y, w, h, blur_fn)
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

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_step = max(1, int(fps / scan_fps))

    try:
        # ==========================================
        # METHOD A: Fast Subtitle Overlay
        # ==========================================
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
                        if det['class'] in target_classes and det['score'] > 0.4:
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
                    progress_hook(min(1.0, current_frame / total_frames))

            cap.release()
            out_path = os.path.join(
                TEMP_DIR, os.path.splitext(filename)[0] + "_censor.ass")
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(ass_header + "\n".join(ass_events))
            return True, out_path

        # ==========================================
        # METHOD B: Hard Re-encode (FFmpeg + Multithreading)
        # ==========================================
        elif method == "reencode":
            blur_fn = _make_blur_fn(blur_intensity, blur_type)
            final_out_path = os.path.join(
                TEMP_DIR, f"final_censored_{filename}")
            has_ffmpeg = shutil.which("ffmpeg") is not None

            if has_ffmpeg:
                cmd = [
                    "ffmpeg", "-y",
                    "-f", "rawvideo", "-vcodec", "rawvideo", "-s", f"{width}x{height}", "-pix_fmt", "bgr24", "-r", str(
                        fps),
                    "-i", "-",
                    "-i", input_path,
                    "-map", "0:v:0", "-map", "1:a?", "-map", "1:s?", "-map_chapters", "1",
                    "-c:v", encoder, "-pix_fmt", "yuv420p", "-c:a", "copy", "-c:s", "copy",
                    final_out_path
                ]
                writer_proc = subprocess.Popen(
                    cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                out_path = os.path.join(TEMP_DIR, f"censored_{filename}")
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                writer_cv2 = cv2.VideoWriter(
                    out_path, fourcc, fps, (width, height))

            read_queue = queue.Queue(maxsize=32)
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
                                det['box'] for det in detections if det['class'] in target_classes and det['score'] > 0.4]
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
                        frame = _apply_blur_fn(frame, x, y, w, h, blur_fn)

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

                    if has_ffmpeg:
                        writer_proc.stdin.write(frame.tobytes())
                    else:
                        writer_cv2.write(frame)

                    frames_written += 1
                    if progress_hook and frames_written % 2 == 0:
                        progress_hook(min(1.0, frames_written / total_frames))

            t_prod = threading.Thread(target=producer)
            t_cons = threading.Thread(target=consumer)
            num_workers = max(2, (os.cpu_count() or 2) - 1)
            workers = [threading.Thread(target=worker)
                       for _ in range(num_workers)]

            add_script_run_ctx(t_prod)
            add_script_run_ctx(t_cons)
            for w in workers:
                add_script_run_ctx(w)

            t_prod.start()
            t_cons.start()
            for w in workers:
                w.start()

            t_prod.join()
            for w in workers:
                w.join()
            t_cons.join()

            if has_ffmpeg:
                writer_proc.stdin.close()
                writer_proc.wait()
                if progress_hook:
                    progress_hook(1.0)
                return True, final_out_path
            else:
                writer_cv2.release()
                if progress_hook:
                    progress_hook(1.0)
                return True, out_path

    finally:
        if cap.isOpened():
            cap.release()

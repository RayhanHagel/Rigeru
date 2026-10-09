import os
import time
import queue
import threading
import warnings
import shutil
import subprocess
import random as _random
import json
import math

import functools
from typing import Any, Optional

# Import shared utilities
from utilities.core.util_time_format import format_ass_time
from utilities.core.util_store import get_data, set_data

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", module="ultralytics")
os.environ['YOLO_VERBOSE'] = 'False'

CACHE_DIR = os.path.join(".", "cache", "models")
TEMP_DIR = os.path.join(".", "temp")

os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

_color_cache: dict[int, tuple] = {}


def load_cached_settings() -> dict[str, Any]:
    """

        Retrieve cached object detection runtime hardware preferences from the SQLite store.

        Returns:
            dict[str, Any]: Settings dictionary.
        
    """
    data = get_data("object_detect") or {}
    return data


def save_cached_settings(key: str, value: Any) -> None:
    """

        Persist hardware acceleration settings to the store.

        Args:
            key (str): Setting property name.
            value (Any): Setting value.

        Returns:
            None
        
    """
    settings = load_cached_settings()
    settings[key] = value
    set_data("object_detect", settings)


def get_class_color(cls_id: int) -> tuple[int, int, int]:
    """

        Generate and cache a deterministic pseudo-random RGB color tuple for an object class ID.

        Args:
            cls_id (int): Integer class identifier.

        Returns:
            tuple[int, int, int]: RGB color tuple (r, g, b).
        
    """
    cls_id = int(cls_id)
    if cls_id not in _color_cache:
        rng = _random.Random(cls_id * 812)
        _color_cache[cls_id] = (rng.randint(50, 255), rng.randint(50, 255), rng.randint(50, 255))
    return _color_cache[cls_id]


@functools.lru_cache(maxsize=1)
def get_available_cameras() -> list[int]:
    """

        Detect available webcam capture devices.

        Returns:
            list[int]: Array of device camera indices.
        
    """
    return [0]


# ─────────────────────────────────────────────
# OPTIMIZED MODEL LOADER (WITH EXPORT PROGRESS)
# ─────────────────────────────────────────────
@functools.lru_cache(maxsize=1)
def load_yolo_model(compute_engine: str = "cpu", resolution: int = 640) -> tuple[Any, str]:
    """

        Load or compile a YOLO detection model with hardware optimizations (TensorRT, ONNX, CPU).

        Args:
            compute_engine (str, optional): Target compute backend ('cpu', 'cuda', 'tensorrt', 'onnx'). Defaults to "cpu".
            resolution (int, optional): Square inference spatial dimension. Defaults to 640.

        Returns:
            tuple[Any, str]: Tuple containing the loaded YOLO model instance (or None) and status message.
        
    """
    from utilities.core.util_config import get_model_config
    model_name = get_model_config("object_detection")
    try:
        from ultralytics import YOLO
    except ImportError:
        return None, "Ultralytics is not installed."

    base_model_path = os.path.join(CACHE_DIR, model_name)
    model_name_base = os.path.splitext(model_name)[0]

    try:
        model = YOLO(base_model_path)
        
        if compute_engine in ["cpu", "cuda", "Auto-Detect"]:
            return model, "Success"

        export_kwargs = {'imgsz': resolution, 'workspace': 4}
        if compute_engine == "tensorrt":
            target_format = 'engine'
            export_kwargs['half'] = True
            expected_path = os.path.join(CACHE_DIR, f"{model_name_base}_{resolution}.engine")
        elif compute_engine == "onnx":
            target_format = 'onnx'
            expected_path = os.path.join(CACHE_DIR, f"{model_name_base}_{resolution}.onnx")
        else:
            return model, "Success"
            
        if os.path.exists(expected_path):
            return YOLO(expected_path, task="detect"), "Success"

        print(f"Exporting {model_name} to {target_format.upper()} (This takes a few minutes)...")
        exported_path = model.export(format=target_format, **export_kwargs)
        
        if os.path.exists(exported_path):
            shutil.move(exported_path, expected_path)
            
        print("Compilation complete!")

        return YOLO(expected_path, task="detect"), "Success"

    except Exception as e:
        return YOLO(base_model_path), f"Export failed, falling back to PyTorch base. Error: {str(e)}"


# ─────────────────────────────────────────────
# MEMORY OPTIMIZED IMAGE ANALYSIS
# ─────────────────────────────────────────────
def analyze_image(image_bytes: bytes, model: Any, resolution: int, conf_thresh: float) -> tuple[bool, Any, list[dict[str, Any]], str]:
    """

        Run YOLO object detection on an image buffer and extract detected entities, labels, and bounding boxes.

        Args:
            image_bytes (bytes): Raw binary image payload.
            model (Any): Loaded YOLO model instance.
            resolution (int): Square inference resolution.
            conf_thresh (float): Minimum confidence threshold.

        Returns:
            tuple[bool, Any, list[dict[str, Any]], str]: Success flag, base RGB image, object data records, and message.
        
    """
    import cv2
    import numpy as np
    
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        bgr_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR) 
        
        results = model(bgr_img, imgsz=resolution, conf=conf_thresh, verbose=False)
        boxes = results[0].boxes

        rgb_img = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)
        
        obj_data = []
        if len(boxes):
            all_xyxy = boxes.xyxy.cpu().numpy().astype(int)
            all_conf, all_cls = boxes.conf.cpu().numpy(), boxes.cls.cpu().numpy().astype(int)
            img_h, img_w = rgb_img.shape[:2]

            for i, (xyxy, conf, cls_id) in enumerate(zip(all_xyxy, all_conf, all_cls)):
                x1, y1, x2, y2 = max(0, xyxy[0]), max(0, xyxy[1]), min(xyxy[2], img_w), min(xyxy[3], img_h)
                crop = rgb_img[y1:y2, x1:x2].copy()
                if crop.size > 0:
                    ch, cw = crop.shape[:2]
                    max_dim = 150
                    if max(ch, cw) > max_dim:
                        scale = max_dim / float(max(ch, cw))
                        crop = cv2.resize(crop, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
                        
                    obj_data.append({
                        "id": i, "label": model.names[cls_id], "cls_id": int(cls_id),
                        "conf": int(conf * 100), "box": (int(x1), int(y1), int(x2), int(y2)),
                        "crop": crop
                    })
        return True, rgb_img, obj_data, ""
    except Exception as e:
        return False, None, None, str(e)


def render_image_boxes(rgb_img: Any, obj_data: list[dict[str, Any]], selected_ids: list[Any]) -> Any:
    """

        Draw labeled bounding boxes onto an RGB image for the selected entity detections.

        Args:
            rgb_img (Any): Source RGB numpy image.
            obj_data (list[dict[str, Any]]): Detection records with box, label, and confidence.
            selected_ids (list[Any]): Target object IDs to render.

        Returns:
            Any: Annotated RGB numpy image.
        
    """
    import cv2
    
    out_img = rgb_img.copy()
    overlay = rgb_img.copy()
    selected_set = set(selected_ids)

    # Draw transparent fills
    for obj in obj_data:
        if obj['id'] in selected_set:
            x1, y1, x2, y2 = obj['box']
            color = get_class_color(obj['cls_id'])
            cv2.rectangle(overlay, (x1, y1), (x2, y2), color, -1)

    alpha = 0.25
    cv2.addWeighted(overlay, alpha, out_img, 1 - alpha, 0, out_img)

    # Draw solid borders and dynamic labels
    for obj in obj_data:
        if obj['id'] in selected_set:
            x1, y1, x2, y2 = obj['box']
            color = get_class_color(obj['cls_id'])
            
            cv2.rectangle(out_img, (x1, y1), (x2, y2), color, 2)
            
            label = f"{obj['label']} {obj['conf']}%"
            font = cv2.FONT_HERSHEY_DUPLEX
            font_scale, thickness = 0.5, 1
            
            (tw, th), baseline = cv2.getTextSize(label, font, font_scale, thickness)
            label_y = max(th + 10, y1)
            
            cv2.rectangle(out_img, (x1, label_y - th - 10), (x1 + tw + 10, label_y), color, -1)
            
            r, g, b = color
            brightness = (r * 299 + g * 587 + b * 114) / 1000
            text_color = (0, 0, 0) if brightness > 140 else (255, 255, 255)
            
            cv2.putText(out_img, label, (x1 + 5, label_y - 4), font, font_scale, text_color, thickness, cv2.LINE_AA)

    return out_img


# ─────────────────────────────────────────────
# FAST VIDEO PROCESSING (USING NATIVE BYTETRACK)
# ─────────────────────────────────────────────
def process_video_object_detection(
    input_path: str,
    model: Any,
    resolution: int,
    conf_thresh: float,
    output_method: str,
    progress_hook: Any = None,
    encoder: str = "libx264",
    selected_classes: list[str] | None = None,
    ai_fps: float = 5.0,
    use_extrapolation: bool = True
) -> tuple[bool, str | None, str]:
    """

        Process a video file with YOLO object detection, tracking objects across frames and rendering boxes.

        Args:
            input_path (str): Video file path.
            model (Any): Loaded YOLO model instance.
            resolution (int): Spatial inference dimension.
            conf_thresh (float): Minimum detection confidence.
            output_method (str): Output format choice.
            progress_hook (Any, optional): Progress callback. Defaults to None.
            encoder (str, optional): FFmpeg video encoder. Defaults to "libx264".
            selected_classes (Any, optional): Filter class names. Defaults to None.
            ai_fps (float, optional): Inference frame rate limit. Defaults to 5.0.
            use_extrapolation (bool, optional): Smooth trajectories between AI frames. Defaults to True.

        Returns:
            tuple[bool, str | None, str]: Success flag, output video path, and status message.
        
    """
    import cv2
    import numpy as np
    
    filename = os.path.basename(input_path)
    cap = cv2.VideoCapture(input_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    is_ass = (output_method == "subtitle")
    out_path = os.path.join(TEMP_DIR, f"detect_{filename}")

    pipe_writer = None
    ass_events = []

    if is_ass:
        out_path = os.path.splitext(out_path)[0] + ".ass"
        ass_header = f"[Script Info]\nTitle: YOLO Detection Overlay\nScriptType: v4.00+\nPlayResX: {width}\nPlayResY: {height}\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Box,Arial,24,&H00FFFFFF,&H00000000,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,2,0,7,0,0,0,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    else:
        from utilities.audio_video.util_video_stream import VideoPipeWriter
        pipe_writer = VideoPipeWriter(
            out_path, width, height, fps, input_path=input_path, encoder=encoder
        )

    try:
        frame_idx = 0
        font = cv2.FONT_HERSHEY_DUPLEX
        last_inference_idx = -9999
        inference_interval_frames = fps / ai_fps if ai_fps > 0 else 0
        active_tracks = {}
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            start_str = format_ass_time(frame_idx / fps)
            end_str = format_ass_time((frame_idx + 1) / fps)

            if frame_idx - last_inference_idx >= inference_interval_frames:
                # Run YOLO tracking
                results = model.track(frame, persist=True, imgsz=resolution, conf=conf_thresh, tracker="bytetrack.yaml", verbose=False)
                boxes = results[0].boxes
                
                new_tracks = {}
                if len(boxes) > 0 and boxes.id is not None:
                    all_xyxy = boxes.xyxy.cpu().numpy().astype(float)
                    all_conf = boxes.conf.cpu().numpy()
                    all_cls = boxes.cls.cpu().numpy().astype(int)
                    all_ids = boxes.id.cpu().numpy().astype(int)
                    
                    for xyxy, conf, cls_id, tid in zip(all_xyxy, all_conf, all_cls, all_ids):
                        label_name = model.names[cls_id].lower()
                        if selected_classes and label_name not in selected_classes:
                            continue
                            
                        box = list(xyxy)
                        v = [0, 0, 0, 0]
                        dt_frames = frame_idx - last_inference_idx
                        if use_extrapolation and tid in active_tracks and dt_frames > 0:
                            old_box = active_tracks[tid]["box"]
                            v = [(box[i] - old_box[i]) / dt_frames for i in range(4)]
                            
                        new_tracks[tid] = {"cls_id": int(cls_id), "conf": float(conf), "box": box, "v": v}
                        
                active_tracks = new_tracks
                last_inference_idx = frame_idx
                frames_since_inference = 0
            else:
                frames_since_inference = frame_idx - last_inference_idx

            if not is_ass:
                overlay = frame.copy()

            for tid, info in active_tracks.items():
                if use_extrapolation:
                    e_box = [info["box"][i] + (info["v"][i] * frames_since_inference) for i in range(4)]
                else:
                    e_box = info["box"]
                    
                x1, y1, x2, y2 = [int(v) for v in e_box]
                h_img, w_img = frame.shape[:2]
                x1 = max(0, min(x1, w_img - 2))
                y1 = max(0, min(y1, h_img - 2))
                x2 = max(x1 + 1, min(x2, w_img - 1))
                y2 = max(y1 + 1, min(y2, h_img - 1))
                
                cls_id = info["cls_id"]
                conf = info["conf"]
                label = model.names[cls_id]
                color_rgb = get_class_color(cls_id)
                
                if is_ass:
                    w, h_box = x2 - x1, y2 - y1
                    r, g, b_col = color_rgb
                    hex_color = f"&H00{b_col:02X}{g:02X}{r:02X}&"
                    lbl = f"{label} #{tid} {int(conf*100)}%"
                    vector = f"{{\\pos({x1},{y1})}}{{\\1a&HFF&}}{{\\3c{hex_color}}}{{\\bord3}}{{\\p1}}m 0 0 l {w} 0 l {w} {h_box} l 0 {h_box} l 0 0{{\\p0}}"
                    ass_events.extend([
                        f"Dialogue: 0,{start_str},{end_str},Box,,0,0,0,,{vector}",
                        f"Dialogue: 1,{start_str},{end_str},Box,,0,0,0,,{{\\pos({x1},{y1-5})}}{{\\c{hex_color}}}{lbl}"
                    ])
                else:
                    color_bgr = color_rgb[::-1]
                    cv2.rectangle(overlay, (x1, y1), (x2, y2), color_bgr, -1)

            if not is_ass:
                cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, frame)

                for tid, info in active_tracks.items():
                    if use_extrapolation:
                        e_box = [info["box"][i] + (info["v"][i] * frames_since_inference) for i in range(4)]
                    else:
                        e_box = info["box"]
                        
                    x1, y1, x2, y2 = [int(v) for v in e_box]
                    h_img, w_img = frame.shape[:2]
                    x1 = max(0, min(x1, w_img - 2))
                    y1 = max(0, min(y1, h_img - 2))
                    x2 = max(x1 + 1, min(x2, w_img - 1))
                    y2 = max(y1 + 1, min(y2, h_img - 1))
                    
                    cls_id = info["cls_id"]
                    conf = info["conf"]
                    label = model.names[cls_id]
                    color_rgb = get_class_color(cls_id)
                    color_bgr = color_rgb[::-1]
                    
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color_bgr, 2)
                    
                    text = f"{label} #{tid} {int(conf*100)}%"
                    (tw, th), baseline = cv2.getTextSize(text, font, 0.5, 1)
                    label_y = max(th + 10, y1)
                    
                    cv2.rectangle(frame, (x1, label_y - th - 10), (x1 + tw + 10, label_y), color_bgr, -1)
                    
                    r, g, b = color_rgb
                    brightness = (r * 299 + g * 587 + b * 114) / 1000
                    text_color = (0, 0, 0) if brightness > 140 else (255, 255, 255)
                    
                    cv2.putText(frame, text, (x1 + 5, label_y - 4), font, 0.5, text_color, 1, cv2.LINE_AA)

            if not is_ass:
                pipe_writer.write_frame(frame)

            frame_idx += 1
            if progress_hook and frame_idx % 10 == 0:
                progress_hook(min(1.0, frame_idx / max(1, total_frames)))

    finally:
        cap.release()
        if is_ass:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(ass_header + "\n".join(ass_events))
        else:
            pipe_writer.close()

    return True, (out_path if is_ass else pipe_writer.output_path)


WEBCAM_CONFIG = {}

def update_webcam_config(camera_index: int, ai_fps: float, selected_classes: str) -> None:
    """

        Dynamically update active webcam detection parameters at runtime.

        Args:
            camera_index (int): Hardware camera index.
            ai_fps (float): AI inference frame rate.
            selected_classes (list[str]): Active class filter labels.

        Returns:
            None
        
    """
    import json
    try:
        classes = json.loads(selected_classes)
    except:
        classes = []
    WEBCAM_CONFIG[camera_index] = {
        "ai_fps": ai_fps,
        "classes": set(classes) if classes else None
    }

# ─────────────────────────────────────────────
# HYBRID WEBCAM (NATIVE GPU OR CPU EXTRAPOLATION)
# ─────────────────────────────────────────────
def generate_webcam_frames(
    model: Any,
    camera_index: int,
    resolution: int,
    conf_thresh: float,
    target_height: int = 600,
    use_extrapolation: bool = False,
    stop_event: Any = None
) -> Any:
    """

        Capture webcam frames, execute real-time YOLO object detection, and yield multipart JPEG byte chunks.

        Args:
            model (Any): YOLO model instance.
            camera_index (int): Hardware camera device index.
            resolution (int): Inference resolution.
            conf_thresh (float): Detection confidence threshold.
            target_height (int, optional): Rendered stream height. Defaults to 480.
            use_extrapolation (bool, optional): Interpolate between AI frames. Defaults to True.
            stop_event (Any, optional): Thread termination event. Defaults to None.

        Yields:
            bytes: Multipart JPEG video frame stream chunks.

        Returns:
            Any: Video stream generator.
        
    """
    import cv2
    
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        return

    ret, first_frame = cap.read()
    if not ret:
        cap.release()
        return
        
    target_width = int(target_height * (first_frame.shape[1] / first_frame.shape[0]))

    frame_queue = queue.Queue(maxsize=3)
    thread_stop_event = threading.Event()

    def frame_producer():
        while not thread_stop_event.is_set():
            ret, f = cap.read()
            if not ret:
                break
            f = cv2.resize(f, (target_width, target_height))
            if frame_queue.full():
                try:
                    frame_queue.get_nowait()
                except queue.Empty:
                    pass
            try:
                frame_queue.put(f, timeout=0.1)
            except queue.Full:
                pass

    producer_thread = threading.Thread(target=frame_producer, daemon=True)
    producer_thread.start()

    font = cv2.FONT_HERSHEY_DUPLEX
    last_inference_time = 0
    active_tracks = {}

    try:
        while True:
            if stop_event and stop_event.is_set():
                break

            # Read dynamic config
            config = WEBCAM_CONFIG.get(camera_index, {"ai_fps": 30.0, "classes": None})
            current_fps = config["ai_fps"]
            allowed_classes = config["classes"]
            inference_interval = 1.0 / current_fps if current_fps > 0 else 0

            try:
                frame = frame_queue.get(timeout=0.2)
            except queue.Empty:
                continue

            current_time = time.time()
            dt = current_time - last_inference_time
            res_plotted = frame.copy()
            overlay = frame.copy()

            if not use_extrapolation or dt >= inference_interval:
                results = model.track(frame, imgsz=resolution, conf=conf_thresh, persist=True, tracker="bytetrack.yaml", verbose=False)
                boxes = results[0].boxes
                
                new_tracks = {}
                if len(boxes) > 0 and boxes.id is not None:
                    all_xyxy = boxes.xyxy.cpu().numpy().astype(float)
                    all_conf = boxes.conf.cpu().numpy()
                    all_cls = boxes.cls.cpu().numpy().astype(int)
                    all_ids = boxes.id.cpu().numpy().astype(int)
                    
                    for xyxy, conf, cls_id, track_id in zip(all_xyxy, all_conf, all_cls, all_ids):
                        if allowed_classes is not None and model.names[cls_id] not in allowed_classes:
                            continue
                        
                        box = list(xyxy)
                        v = [0, 0, 0, 0]
                        
                        if use_extrapolation and track_id in active_tracks and dt > 0:
                            old_box = active_tracks[track_id]['box']
                            v = [(box[i] - old_box[i]) / dt for i in range(4)]
                            
                        new_tracks[track_id] = {
                            'box': box, 'v': v, 'cls': cls_id, 'conf': conf, 'label': model.names[cls_id]
                        }
                
                active_tracks = new_tracks
                last_inference_time = current_time
                time_since_inference = 0
            else:
                time_since_inference = current_time - last_inference_time

            for track_id, data in active_tracks.items():
                if use_extrapolation:
                    e_box = [data['box'][i] + (data['v'][i] * time_since_inference) for i in range(4)]
                else:
                    e_box = data['box']
                
                x1, y1, x2, y2 = [int(v) for v in e_box]
                color_rgb = get_class_color(data['cls'])
                color_bgr = color_rgb[::-1]
                
                cv2.rectangle(overlay, (x1, y1), (x2, y2), color_bgr, -1)
                
            cv2.addWeighted(overlay, 0.25, res_plotted, 0.75, 0, res_plotted)

            for track_id, data in active_tracks.items():
                if use_extrapolation:
                    e_box = [data['box'][i] + (data['v'][i] * time_since_inference) for i in range(4)]
                else:
                    e_box = data['box']
                
                x1, y1, x2, y2 = [int(v) for v in e_box]
                color_rgb = get_class_color(data['cls'])
                color_bgr = color_rgb[::-1]
                
                cv2.rectangle(res_plotted, (x1, y1), (x2, y2), color_bgr, 2)
                
                text = f"{data['label']} #{track_id}"
                (tw, th), baseline = cv2.getTextSize(text, font, 0.5, 1)
                label_y = max(th + 10, y1)
                
                cv2.rectangle(res_plotted, (x1, label_y - th - 10), (x1 + tw + 10, label_y), color_bgr, -1)
                
                r, g, b = color_rgb
                brightness = (r * 299 + g * 587 + b * 114) / 1000
                text_color = (0, 0, 0) if brightness > 140 else (255, 255, 255)
                
                cv2.putText(res_plotted, text, (x1 + 5, label_y - 4), font, 0.5, text_color, 1, cv2.LINE_AA)
                
            from utilities.vision.util_virtual_camera import _active_camera, send_frame_bgr
            if _active_camera is not None:
                send_frame_bgr(res_plotted)

            ret_enc, buffer = cv2.imencode('.jpg', res_plotted)
            if ret_enc:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

    except Exception as e:
        print(f"DEBUG generator: exception {repr(e)}")
        pass
    finally:
        print("DEBUG generator: finally block starting")
        thread_stop_event.set()
        producer_thread.join(timeout=1.0)
        print("DEBUG generator: releasing cap")
        cap.release()
        print("DEBUG generator: cap released")

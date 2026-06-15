import os
import time
import queue
import threading
import warnings
import shutil
import subprocess
import random as _random

import streamlit as st
from streamlit.runtime.scriptrunner import add_script_run_ctx

# Import shared utilities
from utilities.util_subtitles import format_ass_time

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", module="ultralytics")
os.environ['YOLO_VERBOSE'] = 'False'

CACHE_DIR = os.path.join(".", "cache", "models")
TEMP_DIR = os.path.join(".", "cache", "temp")
os.makedirs(CACHE_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

_color_cache: dict[int, tuple] = {}


def get_class_color(cls_id: int) -> tuple:
    cls_id = int(cls_id)
    if cls_id not in _color_cache:
        rng = _random.Random(cls_id * 812)
        _color_cache[cls_id] = (rng.randint(50, 255), rng.randint(50, 255), rng.randint(50, 255))
    return _color_cache[cls_id]


@st.cache_data(show_spinner=False, ttl=30)
def get_available_cameras() -> list[int]:
    import cv2
    try:
        cv2.setLogLevel(0)
    except AttributeError:
        pass
    available = [i for i in range(5) if cv2.VideoCapture(i).isOpened() and not cv2.VideoCapture(i).release()]
    try:
        cv2.setLogLevel(3)
    except AttributeError:
        pass
    return available if available else [0]


# ─────────────────────────────────────────────
# OPTIMIZED MODEL LOADER (WITH EXPORT PROGRESS)
# ─────────────────────────────────────────────
@st.cache_resource(show_spinner=False)
def load_yolo_model(model_name: str = "yolov8n.pt", optimization: str = "PyTorch", resolution: int = 640):
    try:
        from ultralytics import YOLO
    except ImportError:
        return None, "Ultralytics is not installed."

    base_model_path = os.path.join(CACHE_DIR, model_name)
    model_name_base = os.path.splitext(model_name)[0]

    try:
        model = YOLO(base_model_path)
        
        if "PyTorch" in optimization:
            return model, "Success"

        export_kwargs = {'imgsz': resolution, 'workspace': 4}
        if "FP16" in optimization:
            target_format = 'engine'
            export_kwargs['half'] = True
            expected_path = os.path.join(CACHE_DIR, f"{model_name_base}_{resolution}.engine")
        elif "INT8" in optimization:
            target_format = 'onnx'
            export_kwargs['int8'] = True
            expected_path = os.path.join(CACHE_DIR, f"{model_name_base}_{resolution}_int8.onnx")
        elif "OpenVINO" in optimization:
            target_format = 'openvino'
            expected_path = os.path.join(CACHE_DIR, f"{model_name_base}_{resolution}_openvino_model")
            
        if os.path.exists(expected_path):
            return YOLO(expected_path, task="detect"), "Success"

        with st.status(f"⚙️ First-time compilation to {optimization}...", expanded=True) as status:
            prog = st.progress(0.1, text="Initializing export pipeline...")
            st.write(f"Exporting {model_name} to {target_format.upper()} (This takes a few minutes)...")
            
            prog.progress(0.4, text="Compiling network graph and optimizing weights...")
            exported_path = model.export(format=target_format, **export_kwargs)
            
            prog.progress(0.8, text="Moving optimized model to cache...")
            if os.path.exists(exported_path):
                shutil.move(exported_path, expected_path)
                
            prog.progress(1.0, text="Complete!")
            status.update(label="Compilation complete!", state="complete", expanded=False)

        return YOLO(expected_path, task="detect"), "Success"

    except Exception as e:
        return YOLO(base_model_path), f"Export failed, falling back to PyTorch base. Error: {str(e)}"


# ─────────────────────────────────────────────
# MEMORY OPTIMIZED IMAGE ANALYSIS
# ─────────────────────────────────────────────
def analyze_image(image_bytes: bytes, model, resolution: int, conf_thresh: float):
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
                    obj_data.append({
                        "id": i, "label": model.names[cls_id], "cls_id": int(cls_id),
                        "conf": int(conf * 100), "box": (x1, y1, x2, y2),
                        "crop": cv2.resize(crop, (150, 150), interpolation=cv2.INTER_AREA)
                    })
        return True, rgb_img, obj_data, ""
    except Exception as e:
        return False, None, None, str(e)


def render_image_boxes(rgb_img, obj_data, selected_ids: list):
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
    input_path: str, model, resolution: int, conf_thresh: float,
    output_method: str, progress_hook, encoder: str = "libx264"
) -> tuple:
    import cv2
    
    filename = os.path.basename(input_path)
    cap = cv2.VideoCapture(input_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    is_ass = (output_method == "subtitle")
    out_path = os.path.join(TEMP_DIR, f"detect_{filename}")

    has_ffmpeg = shutil.which("ffmpeg") is not None
    writer_proc, writer_cv2 = None, None
    ass_events = []

    if is_ass:
        out_path = os.path.splitext(out_path)[0] + ".ass"
        ass_header = f"[Script Info]\nTitle: YOLO Detection Overlay\nScriptType: v4.00+\nPlayResX: {width}\nPlayResY: {height}\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Box,Arial,24,&H00FFFFFF,&H00000000,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,2,0,7,0,0,0,1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    else:
        if has_ffmpeg and encoder != "cv2":
            cmd = ["ffmpeg", "-y", "-f", "rawvideo", "-vcodec", "rawvideo", "-s", f"{width}x{height}", "-pix_fmt", "bgr24", "-r", str(fps), "-i", "-", "-i", input_path, "-map", "0:v:0", "-map", "1:a?", "-map", "1:s?", "-map_chapters", "1", "-c:v", encoder, "-pix_fmt", "yuv420p", "-c:a", "copy", "-c:s", "copy", out_path]
            writer_proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer_cv2 = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

    # Threaded Writer Implementation
    write_queue = queue.Queue(maxsize=30)
    
    def post_process_and_write():
        while True:
            frame = write_queue.get()
            if frame is None: 
                break
            if writer_proc:
                writer_proc.stdin.write(frame.tobytes())
            elif writer_cv2:
                writer_cv2.write(frame)
            write_queue.task_done()

    if not is_ass:
        writer_thread = threading.Thread(target=post_process_and_write, daemon=True)
        add_script_run_ctx(writer_thread)
        writer_thread.start()

    try:
        frame_idx = 0
        font = cv2.FONT_HERSHEY_DUPLEX
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            results = model.track(frame, imgsz=resolution, conf=conf_thresh, persist=True, tracker="bytetrack.yaml", verbose=False)
            boxes = results[0].boxes
            
            start_str = format_ass_time(frame_idx / fps)
            end_str = format_ass_time((frame_idx + 1) / fps)

            if len(boxes) > 0 and boxes.id is not None:
                all_xyxy = boxes.xyxy.cpu().numpy().astype(int)
                all_conf = boxes.conf.cpu().numpy()
                all_cls = boxes.cls.cpu().numpy().astype(int)
                all_ids = boxes.id.cpu().numpy().astype(int)

                if not is_ass:
                    overlay = frame.copy()

                for xyxy, conf, cls_id, track_id in zip(all_xyxy, all_conf, all_cls, all_ids):
                    x1, y1, x2, y2 = xyxy
                    label = model.names[cls_id]
                    color_rgb = get_class_color(cls_id)
                    
                    if is_ass:
                        w, h_box = x2 - x1, y2 - y1
                        r, g, b_col = color_rgb
                        hex_color = f"&H00{b_col:02X}{g:02X}{r:02X}&"
                        lbl = f"{label} #{track_id} {int(conf*100)}%"
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

                    for xyxy, conf, cls_id, track_id in zip(all_xyxy, all_conf, all_cls, all_ids):
                        x1, y1, x2, y2 = xyxy
                        label = model.names[cls_id]
                        color_rgb = get_class_color(cls_id)
                        color_bgr = color_rgb[::-1]
                        
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color_bgr, 2)
                        
                        text = f"{label} #{track_id} {int(conf*100)}%"
                        (tw, th), baseline = cv2.getTextSize(text, font, 0.5, 1)
                        label_y = max(th + 10, y1)
                        
                        cv2.rectangle(frame, (x1, label_y - th - 10), (x1 + tw + 10, label_y), color_bgr, -1)
                        
                        r, g, b = color_rgb
                        brightness = (r * 299 + g * 587 + b * 114) / 1000
                        text_color = (0, 0, 0) if brightness > 140 else (255, 255, 255)
                        
                        cv2.putText(frame, text, (x1 + 5, label_y - 4), font, 0.5, text_color, 1, cv2.LINE_AA)

            if not is_ass:
                # Delegate I/O to background thread
                write_queue.put(frame)

            frame_idx += 1
            if progress_hook and frame_idx % 10 == 0:
                progress_hook(min(1.0, frame_idx / max(1, total_frames)))

    finally:
        cap.release()
        if is_ass:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(ass_header + "\n".join(ass_events))
        else:
            write_queue.put(None)
            writer_thread.join()
            if writer_proc:
                writer_proc.stdin.close()
                writer_proc.wait()
            elif writer_cv2:
                writer_cv2.release()

    return True, out_path


# ─────────────────────────────────────────────
# HYBRID WEBCAM (NATIVE GPU OR CPU EXTRAPOLATION)
# ─────────────────────────────────────────────
def run_webcam_stream(placeholder, fps_placeholder, model, camera_index: int, stop_flag_func, resolution: int, conf_thresh: float, target_height: int = 600, use_extrapolation: bool = False, ai_fps: float = 30.0):
    import cv2
    
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        placeholder.error(f"Could not access Camera {camera_index}.")
        return

    ret, first_frame = cap.read()
    if not ret:
        return cap.release()
        
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
            frame_queue.put(f)

    producer_thread = threading.Thread(target=frame_producer, daemon=True)
    add_script_run_ctx(producer_thread)
    producer_thread.start()

    frame_count, start_time = 0, time.time()
    font = cv2.FONT_HERSHEY_DUPLEX
    
    inference_interval = 1.0 / ai_fps if ai_fps > 0 else 0
    last_inference_time = 0
    active_tracks = {}

    try:
        while not stop_flag_func():
            try:
                frame = frame_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            current_time = time.time()
            dt = current_time - last_inference_time
            res_plotted = frame.copy()
            overlay = frame.copy()

            # 1. AI Inference (Throttle based on ai_fps if extrapolating)
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

            # 2. Rendering & Extrapolation
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

            placeholder.image(cv2.cvtColor(res_plotted, cv2.COLOR_BGR2RGB), channels="RGB", width="stretch")

            frame_count += 1
            if frame_count % 15 == 0:
                fps_placeholder.metric("Display Pipeline Speed", f"{round(15 / (time.time() - start_time), 1)} FPS")
                start_time = time.time()

    finally:
        thread_stop_event.set()
        producer_thread.join(timeout=1.0)
        cap.release()
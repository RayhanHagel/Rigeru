import os
import pickle
import numpy as np
import shutil
import subprocess
import threading
import queue
import json
import warnings
from collections import defaultdict

import streamlit as st
from streamlit.runtime.scriptrunner import add_script_run_ctx

# Import shared utilities
from utilities.util_huggingface import download_hf_file, quantize_onnx_model
from utilities.util_subtitles import format_ass_time
from utilities.util_image_fx import make_blur_fn, apply_blur_fn

# Silence underlying library warnings and ONNX GPU fallback warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning, module="onnxruntime")

CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")

_CLUSTER_SIM_THRESHOLD = 0.60
_MATCH_SIM_THRESHOLD = 0.50
_FACE_PADDING_RATIO = 0.2


def _ensure_paths():
    os.makedirs(TEMP_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Caching & Model Quantization Helpers
# ---------------------------------------------------------------------------


def save_frame_cache(frame_cache: dict, input_path: str) -> str:
    cache_path = input_path + ".facecache.pkl"
    with open(cache_path, "wb") as f:
        pickle.dump(frame_cache, f, protocol=pickle.HIGHEST_PROTOCOL)
    return cache_path


def load_frame_cache(cache_path: str) -> dict:
    with open(cache_path, "rb") as f:
        return pickle.load(f)


def _quantize_insightface_model(model_name: str) -> str:
    """Dynamically quantizes an InsightFace model directory to INT8."""
    base_dir = os.path.join(CACHE_DIR, "models", model_name)
    quant_dir = os.path.join(CACHE_DIR, "models", f"{model_name}_int8")

    if os.path.exists(quant_dir) and len(os.listdir(quant_dir)) > 0:
        return f"{model_name}_int8"

    os.makedirs(quant_dir, exist_ok=True)
    print(f"Quantizing {model_name} to INT8. This only happens once...")

    for f in os.listdir(base_dir):
        src_file = os.path.join(base_dir, f)
        dst_file = os.path.join(quant_dir, f)

        # Only quantize detection models. Recognition models degrade heavily in int8.
        if f.endswith('.onnx') and not any(x in f for x in ['w600k', 'recognition']):
            quantize_onnx_model(src_file, dst_file)
        else:
            shutil.copy2(src_file, dst_file)

    return f"{model_name}_int8"


def _ensure_hf_model(model_name: str, precision: str = "fp32"):
    models_dir = os.path.join(CACHE_DIR, "models")
    model_path = os.path.join(models_dir, model_name)

    if not os.path.exists(model_path) or not any(f.endswith('.onnx') for f in os.listdir(model_path)):
        cred_path = os.path.join(CACHE_DIR, "hf_creds.json")
        hf_token = None
        if os.path.exists(cred_path):
            with open(cred_path, 'r') as f:
                hf_token = json.load(f).get("hf_token")

        hf_sources = {
            "buffalo_l":  {"repo_id": "vladmandic/insightface-faceanalysis", "filename": "buffalo_l.zip"},
            "buffalo_m":  {"repo_id": "vladmandic/insightface-faceanalysis", "filename": "buffalo_m.zip"},
            "buffalo_s":  {"repo_id": "vladmandic/insightface-faceanalysis", "filename": "buffalo_s.zip"},
            "antelopev2": {"repo_id": "vladmandic/insightface-faceanalysis", "filename": "antelopev2.zip"}
        }

        if model_name in hf_sources:
            source = hf_sources[model_name]
            # Since util_huggingface automatically extracts .zips, we just point output_path to a temp zip file inside models_dir
            zip_target = os.path.join(models_dir, source["filename"])
            success = download_hf_file(
                source["repo_id"], source["filename"], zip_target, token=hf_token)

            if not success:
                return False, f"Hugging Face Download Failed for {model_name}", model_name

            # Clean up the downloaded zip file after extraction
            if os.path.exists(zip_target):
                os.remove(zip_target)

    final_model_name = model_name
    if precision == "int8":
        final_model_name = _quantize_insightface_model(model_name)

    return True, "Success", final_model_name


def _build_custom_model_pack(det_pack: str, rec_pack: str = None) -> str:
    if rec_pack:
        custom_name = f"optim_{det_pack}_det_{rec_pack}_rec"
    else:
        custom_name = f"optim_{det_pack}_det_only"

    custom_dir = os.path.join(CACHE_DIR, "models", custom_name)

    if os.path.exists(custom_dir) and len(os.listdir(custom_dir)) >= (2 if rec_pack else 1):
        return custom_name

    os.makedirs(custom_dir, exist_ok=True)
    _ensure_hf_model(det_pack)
    base_det_dir = os.path.join(CACHE_DIR, "models", det_pack)

    for f in os.listdir(base_det_dir):
        if f.startswith('det') and f.endswith('.onnx'):
            shutil.copy2(os.path.join(base_det_dir, f),
                         os.path.join(custom_dir, f))

    if rec_pack:
        _ensure_hf_model(rec_pack)
        base_rec_dir = os.path.join(CACHE_DIR, "models", rec_pack)
        for f in os.listdir(base_rec_dir):
            if any(x in f.lower() for x in ['w600k', 'recognition', 'glintr']) and f.endswith('.onnx'):
                shutil.copy2(os.path.join(base_rec_dir, f),
                             os.path.join(custom_dir, f))

    return custom_name


class RealFace:
    def __init__(self, bbox, emb):
        self.bbox = np.array(bbox)
        self.embedding = emb


@st.cache_resource(max_entries=2, show_spinner=False)
def load_face_detector(det_model: str = "buffalo_l", rec_model: str = None, precision: str = "fp32", det_size: int = 640):
    if det_model in ["cv2", "mtcnn"] or (rec_model is not None and rec_model in ["cv2", "mtcnn"]):
        return None, "Fallback models removed for brevity. Please use InsightFace models."

    try:
        custom_pack_name = _build_custom_model_pack(det_model, rec_model)
        final_model_name = custom_pack_name
        if precision == "int8" and rec_model is not None:
            final_model_name = _quantize_insightface_model(custom_pack_name)

        from insightface.app import FaceAnalysis
        import onnxruntime as ort

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = os.cpu_count() or 4
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC

        available_providers = ort.get_available_providers()
        requested_providers = ['TensorrtExecutionProvider',
                               'CUDAExecutionProvider', 'CPUExecutionProvider']
        active_providers = [
            p for p in requested_providers if p in available_providers]

        app = FaceAnalysis(
            name=final_model_name,
            providers=active_providers,
            root=CACHE_DIR,
            sess_options=opts
        )
        app.prepare(ctx_id=0, det_size=(det_size, det_size))
        return app, "Success"
    except Exception as e:
        return None, f"Model Error: {str(e)}"

# ---------------------------------------------------------------------------
# Maths Helpers
# ---------------------------------------------------------------------------


def _padded_crop(img_rgb, box, pad_ratio=_FACE_PADDING_RATIO, out_size=150):
    import cv2
    ih, iw = img_rgb.shape[:2]
    x, y, x2, y2 = box
    pad_x, pad_y = int((x2 - x) * pad_ratio), int((y2 - y) * pad_ratio)
    cx, cy, cx2, cy2 = max(0, x - pad_x), max(0, y -
                                              pad_y), min(iw, x2 + pad_x), min(ih, y2 + pad_y)

    if cx2 > cx and cy2 > cy:
        return cv2.resize(img_rgb[cy:cy2, cx:cx2].copy(), (out_size, out_size), interpolation=cv2.INTER_AREA)
    return np.zeros((out_size, out_size, 3), dtype=np.uint8)


def _precompute_targets(selected_faces: list) -> np.ndarray:
    raw = np.atleast_2d(np.array([f['embedding'] for f in selected_faces if f.get(
        'embedding') is not None], dtype=np.float32))
    if raw.size == 0:
        return np.array([])
    norms = np.linalg.norm(raw, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return raw / norms


def _match_cache_to_targets(frame_cache: dict, targets_normed: np.ndarray, match_threshold: float) -> dict:
    if targets_normed.size == 0:
        return {}

    all_frame_idxs, all_boxes, all_embs = [], [], []
    for fidx, cached_faces in frame_cache.items():
        for face in cached_faces:
            if face.get('embedding') is not None:
                all_frame_idxs.append(fidx)
                all_boxes.append(face['box'])
                all_embs.append(face['embedding'])

    if not all_embs:
        return {}

    sims = np.array(all_embs, dtype=np.float32) @ targets_normed.T
    best_target_idx = np.argmax(sims, axis=1)
    best_sim = sims[np.arange(len(all_embs)), best_target_idx]

    results = defaultdict(list)
    for i, (fidx, box) in enumerate(zip(all_frame_idxs, all_boxes)):
        if best_sim[i] >= match_threshold:
            results[fidx].append((box, int(best_target_idx[i])))

    return results

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def scan_faces(input_path: str, det_model: str = "buffalo_l", rec_model: str = None, precision: str = "fp32",
               sample_fps: float = 1.0, clustering_method: str = "Global", cluster_threshold: float = _CLUSTER_SIM_THRESHOLD,
               det_size: int = 640, progress_hook=None):
    import cv2
    _ensure_paths()
    detector, status = load_face_detector(
        det_model, rec_model, precision, det_size)
    if detector is None:
        return False, None, None, None, status

    is_video = input_path.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))
    face_data, frame_cache = [], {}

    if not is_video:
        img = cv2.imread(input_path)
        if img is None:
            return False, None, None, None, "Failed to read image."
        rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        for idx, face in enumerate(detector.get(img)):
            box = face.bbox.astype(int).tolist()
            face_data.append(
                {"id": idx + 1, "box": box, "crop": _padded_crop(rgb_img, box), "embedding": None})

        if progress_hook:
            progress_hook(1.0)
        return True, rgb_img, face_data, frame_cache, "Success"

    try:
        import decord
        decord.bridge.set_bridge('native')
        vr = decord.VideoReader(input_path, ctx=decord.cpu(0))
        fps = vr.get_avg_fps()
        total_frames = len(vr)
    except Exception:
        cap = cv2.VideoCapture(input_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        cap.release()
        vr = None

    frame_step = max(1, int(fps / sample_fps))
    indices = list(range(0, total_frames, frame_step))

    if vr:
        preview_img = vr[0].asnumpy()
    else:
        cap = cv2.VideoCapture(input_path)
        ret, f = cap.read()
        preview_img = cv2.cvtColor(f, cv2.COLOR_BGR2RGB) if ret else np.zeros(
            (100, 100, 3), dtype=np.uint8)
        cap.release()

    unique_id = 1
    all_extracted_faces = []
    known_matrix = None

    if vr:
        batch_size = 32
        for b_start in range(0, len(indices), batch_size):
            batch_indices = indices[b_start: b_start + batch_size]
            frames_rgb = vr.get_batch(batch_indices).asnumpy()

            for j, frame_rgb in enumerate(frames_rgb):
                idx = batch_indices[j]
                frame_bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
                faces = detector.get(frame_bgr)
                frame_cache[idx] = []

                if faces:
                    for face in faces:
                        if getattr(face, 'embedding', None) is None:
                            continue
                        emb_arr = np.asarray(face.embedding, dtype=np.float32)
                        emb_norm = emb_arr / (np.linalg.norm(emb_arr) or 1.0)
                        emb = emb_norm.tolist()
                        box = face.bbox.astype(int).tolist()
                        frame_cache[idx].append({"box": box, "embedding": emb})

                        if clustering_method == "Global":
                            all_extracted_faces.append(
                                {"frame": idx, "box": box, "embedding": emb})
                        else:
                            if known_matrix is None or len(known_matrix) == 0:
                                known_matrix = np.array(
                                    [emb_norm], dtype=np.float32)
                                face_data.append({"id": unique_id, "box": box, "crop": _padded_crop(
                                    frame_rgb, box), "embedding": emb, "_emb_sum": emb_arr, "_emb_count": 1})
                                unique_id += 1
                            else:
                                sims = known_matrix @ emb_norm
                                best_idx = int(np.argmax(sims))
                                best_sim = float(sims[best_idx])

                                if best_sim >= cluster_threshold:
                                    matched = face_data[best_idx]
                                    matched['_emb_sum'] += emb_arr
                                    matched['_emb_count'] += 1
                                    new_centroid = matched['_emb_sum'] / \
                                        matched['_emb_count']
                                    new_centroid_norm = new_centroid / \
                                        (np.linalg.norm(new_centroid) or 1.0)
                                    matched['embedding'] = new_centroid_norm.tolist()
                                    known_matrix[best_idx] = new_centroid_norm
                                else:
                                    known_matrix = np.vstack(
                                        [known_matrix, emb_norm])
                                    face_data.append({"id": unique_id, "box": box, "crop": _padded_crop(
                                        frame_rgb, box), "embedding": emb, "_emb_sum": emb_arr, "_emb_count": 1})
                                    unique_id += 1
                if progress_hook and j % 2 == 0:
                    current_progress_idx = b_start + j + 1
                    progress_hook(
                        min(0.90, current_progress_idx / len(indices)))
    else:
        cap = cv2.VideoCapture(input_path)
        frames_seen = 0
        for i in range(total_frames):
            ret = cap.grab()
            if not ret:
                break
            if i % frame_step == 0:
                ret, frame_bgr = cap.retrieve()
                if ret:
                    frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                    faces = detector.get(frame_bgr)
                    frame_cache[i] = []

                    if faces:
                        for face in faces:
                            if getattr(face, 'embedding', None) is None:
                                continue
                            emb_arr = np.asarray(
                                face.embedding, dtype=np.float32)
                            emb_norm = emb_arr / \
                                (np.linalg.norm(emb_arr) or 1.0)
                            emb = emb_norm.tolist()
                            box = face.bbox.astype(int).tolist()
                            frame_cache[i].append(
                                {"box": box, "embedding": emb})

                            if clustering_method == "Global":
                                all_extracted_faces.append(
                                    {"frame": i, "box": box, "embedding": emb})
                            else:
                                if known_matrix is None or len(known_matrix) == 0:
                                    known_matrix = np.array(
                                        [emb_norm], dtype=np.float32)
                                    face_data.append({"id": unique_id, "box": box, "crop": _padded_crop(
                                        frame_rgb, box), "embedding": emb, "_emb_sum": emb_arr, "_emb_count": 1})
                                    unique_id += 1
                                else:
                                    sims = known_matrix @ emb_norm
                                    best_idx = int(np.argmax(sims))
                                    best_sim = float(sims[best_idx])
                                    if best_sim >= cluster_threshold:
                                        matched = face_data[best_idx]
                                        matched['_emb_sum'] += emb_arr
                                        matched['_emb_count'] += 1
                                        new_centroid = matched['_emb_sum'] / \
                                            matched['_emb_count']
                                        new_centroid_norm = new_centroid / \
                                            (np.linalg.norm(new_centroid) or 1.0)
                                        matched['embedding'] = new_centroid_norm.tolist(
                                        )
                                        known_matrix[best_idx] = new_centroid_norm
                                    else:
                                        known_matrix = np.vstack(
                                            [known_matrix, emb_norm])
                                        face_data.append({"id": unique_id, "box": box, "crop": _padded_crop(
                                            frame_rgb, box), "embedding": emb, "_emb_sum": emb_arr, "_emb_count": 1})
                                        unique_id += 1
                frames_seen += 1
                if progress_hook:
                    progress_hook(min(0.90, frames_seen / len(indices)))
        cap.release()

    if clustering_method == "Global" and all_extracted_faces:
        try:
            from sklearn.cluster import DBSCAN
            embs_matrix = np.array([f['embedding']
                                   for f in all_extracted_faces], dtype=np.float32)
            distance_threshold = max(0.01, 1.0 - cluster_threshold)

            clustering = DBSCAN(eps=distance_threshold,
                                min_samples=1, metric='cosine').fit(embs_matrix)

            label_to_indices = defaultdict(list)
            for i, label in enumerate(clustering.labels_):
                if label != -1:
                    label_to_indices[label].append(i)

            for label, cluster_indices in label_to_indices.items():
                cluster_embs = embs_matrix[cluster_indices]
                centroid = np.mean(cluster_embs, axis=0)
                centroid = (
                    centroid / (np.linalg.norm(centroid) or 1)).tolist()

                rep_face = all_extracted_faces[cluster_indices[0]]
                rep_frame_idx = rep_face['frame']
                rep_box = rep_face['box']

                if vr:
                    rgb_frame = vr[rep_frame_idx].asnumpy()
                else:
                    cap = cv2.VideoCapture(input_path)
                    cap.set(cv2.CAP_PROP_POS_FRAMES, rep_frame_idx)
                    ret, bgr_frame = cap.read()
                    rgb_frame = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB) if ret else np.zeros(
                        (10, 10, 3), dtype=np.uint8)
                    cap.release()

                face_data.append({
                    "id": unique_id,
                    "box": rep_box,
                    "crop": _padded_crop(rgb_frame, rep_box),
                    "embedding": centroid
                })
                unique_id += 1

        except ImportError:
            return False, None, None, None, "scikit-learn is required for Global processing. Run: pip install scikit-learn"

    for fd in face_data:
        fd.pop('_emb_sum', None)
        fd.pop('_emb_count', None)

    if progress_hook:
        progress_hook(1.0)
    return True, preview_img, face_data, frame_cache, "Success"


def process_media_blur(input_path: str, blur_intensity: int = 50, blur_type: str = "Gaussian",
                       selected_faces: list = None, scan_fps: float = 5.0, drop_limit_sec: float = 1.0,
                       match_threshold: float = _MATCH_SIM_THRESHOLD, encoder: str = "libx264",
                       output_method: str = "reencode", frame_cache=None, progress_hook=None) -> tuple:
    import cv2
    _ensure_paths()
    if not selected_faces:
        return False, "No faces selected."
    filename = os.path.basename(input_path)
    is_video = filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))
    out_path = os.path.join(TEMP_DIR, f"blurred_{filename}")

    if not is_video:
        img = cv2.imread(input_path)
        blur_fn = make_blur_fn(blur_intensity, blur_type)
        for target in selected_faces:
            x, y, x2, y2 = target['box']
            img = apply_blur_fn(img, x, y, x2 - x, y2 - y, blur_fn)
        cv2.imwrite(out_path, img)
        if progress_hook:
            progress_hook(1.0)
        return True, out_path

    if frame_cache is None:
        return False, "Frame cache missing."
    if isinstance(frame_cache, str):
        frame_cache = load_frame_cache(frame_cache)

    cap = cv2.VideoCapture(input_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(
        cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    targets_normed = _precompute_targets(selected_faces)
    target_ids = [f['id'] for f in selected_faces]
    track_data = {f['id']: {} for f in selected_faces}
    matched_cache = _match_cache_to_targets(
        frame_cache, targets_normed, match_threshold)

    for fidx, hits in matched_cache.items():
        for box, t_idx in hits:
            track_data[target_ids[t_idx]][fidx] = box

    interpolated = defaultdict(list)
    for f_id, frames_dict in track_data.items():
        sorted_frames = sorted(frames_dict)
        for i, f_curr in enumerate(sorted_frames):
            interpolated[f_curr].append(frames_dict[f_curr])
            if i < len(sorted_frames) - 1:
                f_next = sorted_frames[i + 1]
                if (f_next - f_curr) / fps <= drop_limit_sec:
                    bc, bn = np.array(frames_dict[f_curr]), np.array(
                        frames_dict[f_next])
                    ratios = np.linspace(
                        0, 1, (f_next - f_curr) + 1)[1:-1, np.newaxis]
                    boxes_mid = (bc + (bn - bc) * ratios).astype(int)
                    for k, f_mid in enumerate(range(f_curr + 1, f_next)):
                        interpolated[f_mid].append(boxes_mid[k].tolist())

    frames_needing_blur = set(interpolated.keys())

    # ==========================================
    # EARLY EXIT: SUBTITLE OVERLAY LOGIC
    # ==========================================
    if output_method == "subtitle":
        out_path = os.path.join(TEMP_DIR, os.path.splitext(
            filename)[0] + "_faceblur.ass")
        ass_header = f"""[Script Info]
Title: AI Face Blur Overlay
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: CensorBox,Arial,20,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"""

        ass_events = []
        cap_sub = cv2.VideoCapture(input_path)
        current_frame = 0

        while True:
            ret, frame = cap_sub.read()
            if not ret:
                break

            if current_frame in frames_needing_blur:
                start_str = format_ass_time(current_frame / fps)
                end_str = format_ass_time((current_frame + 1) / fps)

                for box in interpolated[current_frame]:
                    x, y, x2, y2 = box
                    w_box, h_box = x2 - x, y2 - y
                    x_c, y_c, x2_c, y2_c = max(0, x), max(
                        0, y), min(width, x2), min(height, y2)

                    if x2_c > x_c and y2_c > y_c:
                        roi = frame[y_c:y2_c, x_c:x2_c]
                        if roi.size > 0:
                            avg_color = np.average(
                                np.average(roi, axis=0), axis=0)
                            b, g, r = int(avg_color[0]), int(
                                avg_color[1]), int(avg_color[2])
                            hex_color = f"&H00{b:02X}{g:02X}{r:02X}&"
                        else:
                            hex_color = "&H00000000&"

                        vector_cmd = f"{{\\pos({x},{y})}}{{\\1a&H00&}}{{\\1c{hex_color}}}{{\\p1}}m 0 0 l {w_box} 0 l {w_box} {h_box} l 0 {h_box} l 0 0{{\\p0}}"
                        ass_events.append(
                            f"Dialogue: 0,{start_str},{end_str},CensorBox,,0,0,0,,{vector_cmd}")

            current_frame += 1
            if progress_hook and current_frame % max(1, int(fps)) == 0:
                progress_hook(min(1.0, current_frame / total_frames))

        cap_sub.release()
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(ass_header + "\n".join(ass_events))

        if progress_hook:
            progress_hook(1.0)
        return True, out_path

    # ==========================================
    # EXISTING RE-ENCODE LOGIC
    # ==========================================
    blur_fn = make_blur_fn(blur_intensity, blur_type)
    final_out_path = os.path.join(TEMP_DIR, f"final_{filename}")
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
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer_cv2 = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

    read_queue = queue.Queue(maxsize=32)
    write_queue = {}
    write_lock = threading.Lock()
    write_cond = threading.Condition(write_lock)
    frames_written = 0
    WINDOW_SIZE = 64

    def producer():
        cap = cv2.VideoCapture(input_path)
        for i in range(total_frames):
            ret, frame = cap.read()
            if not ret:
                break
            read_queue.put((i, frame))
        read_queue.put(None)
        cap.release()

    def worker():
        while True:
            item = read_queue.get()
            if item is None:
                read_queue.put(None)
                break

            idx, frame = item

            with write_cond:
                while idx > frames_written + WINDOW_SIZE:
                    write_cond.wait(timeout=0.1)
                    if not any(w.is_alive() for w in workers if w is not threading.current_thread()):
                        break

            if idx in frames_needing_blur:
                for box in interpolated[idx]:
                    x, y, x2, y2 = box
                    frame = apply_blur_fn(frame, x, y, x2 - x, y2 - y, blur_fn)

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
    workers = [threading.Thread(target=worker) for _ in range(num_workers)]

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

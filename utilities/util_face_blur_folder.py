import os
import cv2
import numpy as np
from collections import defaultdict
from utilities.util_face_blur import load_face_detector, _padded_crop, process_media_blur, _match_cache_to_targets, _precompute_targets, scan_faces

def scan_folder_faces(folder_path: str, rec_model: str = None, precision: str = "fp32",
               sample_fps: float = 1.0, cluster_threshold: float = 0.50,
               det_size: int = 640, progress_hook=None):
    detector, status = load_face_detector(rec_model, precision, det_size)
    if detector is None:
        return False, None, status

    all_extracted_faces = []
    
    valid_exts = ('.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.avi', '.mkv')
    files = [os.path.join(folder_path, f) for f in os.listdir(folder_path) if f.lower().endswith(valid_exts)]
    
    if not files:
        return False, None, "No supported media files found in folder."

    total_files = len(files)
    
    for file_idx, fpath in enumerate(files):
        is_video = fpath.lower().endswith(('.mp4', '.avi', '.mov', '.mkv'))
        
        if not is_video:
            img = cv2.imread(fpath)
            if img is not None:
                faces = detector.get(img)
                if faces:
                    rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                    for face in faces:
                        if getattr(face, 'embedding', None) is not None:
                            emb = face.embedding / (np.linalg.norm(face.embedding) or 1.0)
                            all_extracted_faces.append({
                                'file': fpath,
                                'box': face.bbox.astype(int).tolist(),
                                'embedding': emb.astype(np.float32),
                                'crop': _padded_crop(rgb_img, face.bbox.astype(int).tolist())
                            })
        else:
            cap = cv2.VideoCapture(fpath)
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            frame_step = max(1, int(fps / sample_fps))
            
            for i in range(total_frames):
                ret = cap.grab()
                if not ret: break
                if i % frame_step == 0:
                    ret, frame_bgr = cap.retrieve()
                    if ret:
                        faces = detector.get(frame_bgr)
                        if faces:
                            rgb_img = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                            for face in faces:
                                if getattr(face, 'embedding', None) is not None:
                                    emb = face.embedding / (np.linalg.norm(face.embedding) or 1.0)
                                    all_extracted_faces.append({
                                        'file': fpath,
                                        'box': face.bbox.astype(int).tolist(),
                                        'embedding': emb.astype(np.float32),
                                        'crop': _padded_crop(rgb_img, face.bbox.astype(int).tolist())
                                    })
            cap.release()
            
        if progress_hook:
            progress_hook(min(0.90, (file_idx + 1) / total_files))

    face_data = []
    if all_extracted_faces:
        from sklearn.cluster import DBSCAN
        embs_matrix = np.array([f['embedding'] for f in all_extracted_faces], dtype=np.float32)
        distance_threshold = max(0.01, 1.0 - cluster_threshold)

        clustering = DBSCAN(eps=distance_threshold, min_samples=1, metric='cosine').fit(embs_matrix)

        label_to_indices = defaultdict(list)
        for i, label in enumerate(clustering.labels_):
            if label != -1:
                label_to_indices[label].append(i)

        for label, indices in label_to_indices.items():
            group = [all_extracted_faces[i] for i in indices]
            if not group: continue
            
            sum_emb = np.sum([f['embedding'] for f in group], axis=0)
            centroid = sum_emb / len(group)
            centroid_norm = centroid / (np.linalg.norm(centroid) or 1.0)

            middle_idx = len(group) // 2
            
            occurrences = []
            for face_entry in group:
                occurrences.append({
                    "file": face_entry['file'],
                    "box": face_entry['box']
                })
            
            face_data.append({
                "id": int(label),
                "box": group[middle_idx]['box'],
                "crop": group[middle_idx]['crop'],
                "embedding": centroid_norm.tolist(),
                "_emb_count": len(group),
                "occurrences": occurrences
            })

    return True, face_data, "Success"

def process_folder_blur(folder_path: str, selected_faces: list, blur_intensity: int, blur_style: str, fps_scan: float, gap_limit: float, match_threshold: float, encoder: str, output_method: str):
    import os
    out_dir = os.path.join(folder_path, "blurred")
    os.makedirs(out_dir, exist_ok=True)
    
    valid_exts = ('.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.avi', '.mkv')
    files = [f for f in os.listdir(folder_path) if f.lower().endswith(valid_exts)]
    
    success_count = 0
    for f in files:
        fpath = os.path.join(folder_path, f)
        
        # Scan to get frame cache
        success, preview, f_data, frame_cache, msg = scan_faces(
            input_path=fpath,
            sample_fps=fps_scan,
            clustering_method="None",
            progress_hook=None
        )
        
        if success:
            out_file = os.path.join(out_dir, f)
            s, res_path = process_media_blur(
                input_path=fpath,
                frame_cache=frame_cache,
                selected_faces=selected_faces,
                blur_intensity=blur_intensity,
                blur_style=blur_style,
                gap_limit=gap_limit,
                match_threshold=match_threshold,
                encoder=encoder,
                output_method=output_method
            )
            
            if s:
                # Rename output file to out_file
                if os.path.exists(res_path):
                    import shutil
                    final_ext = ".ass" if output_method == "subtitle" else ""
                    shutil.move(res_path, out_file + final_ext)
                success_count += 1
                
    return True, out_dir

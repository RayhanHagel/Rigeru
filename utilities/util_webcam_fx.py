import cv2
import time
import threading
import queue

def generate_face_blur_webcam_frames(camera_index: int, conf_thresh: float, blur_type: str, blur_strength: int, ai_fps: float = 5.0, use_extrapolation: bool = True, stop_event=None):
    from utilities.util_face_blur import load_face_detector, _padded_crop, make_blur_fn, apply_blur_fn
    import time
    import sys
    
    if sys.platform == 'win32':
        cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
    else:
        cap = cv2.VideoCapture(camera_index)
        
    if not cap.isOpened():
        yield b""
        return
        
    try:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        detector, status = load_face_detector(None, "fp32", 640)
        if detector is None:
            yield b""
            return
            
        blur_fn = make_blur_fn(blur_strength, blur_type)
        last_inference_time = 0
        inference_interval = 1.0 / ai_fps if ai_fps > 0 else 0
        active_faces = []
        
        while True:
            if stop_event and stop_event.is_set():
                break

            ret, frame = cap.read()
            if not ret:
                break
                
            current_time = time.time()
            dt = current_time - last_inference_time

            if dt >= inference_interval:
                faces = detector.get(frame)
                active_faces = []
                if faces:
                    for face in faces:
                        if face.det_score < conf_thresh:
                            continue
                        active_faces.append(face.bbox.astype(int).tolist())
                last_inference_time = current_time
                
            for bbox in active_faces:
                frame = apply_blur_fn(frame, bbox, blur_fn)
            from utilities.util_virtual_camera import _active_camera, send_frame_bgr
            if _active_camera is not None:
                send_frame_bgr(frame)
            
            ret_enc, buffer = cv2.imencode('.jpg', frame)
            if ret_enc:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    except Exception as e:
        print(f"Face blur webcam error: {e}")
    finally:
        cap.release()

def generate_depth_webcam_frames(camera_index: int, colormap: str, invert: bool, ai_fps: float = 5.0, stop_event=None):
    from utilities.util_depth_estimation import load_depth_model, predict_depth, apply_colormap
    import time
    
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        yield b""
        return
        
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    depth_model, status = load_depth_model("Base", "cpu", "fp32")
    if depth_model is None:
        yield b""
        return
        
    last_inference_time = 0
    inference_interval = 1.0 / ai_fps if ai_fps > 0 else 0
    last_colored_depth = None

    try:
        while True:
            if stop_event and stop_event.is_set():
                break

            ret, frame = cap.read()
            if not ret:
                break
                
            current_time = time.time()
            dt = current_time - last_inference_time

            if dt >= inference_interval or last_colored_depth is None:
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                depth_map = predict_depth(depth_model, rgb_frame)
                
                # Apply colormap
                last_colored_depth = apply_colormap(depth_map, colormap, invert)
                last_inference_time = current_time
                
            colored_depth = last_colored_depth
            
            # Resize colored depth to match frame size if needed
            colored_depth = cv2.resize(colored_depth, (frame.shape[1], frame.shape[0]))
            from utilities.util_virtual_camera import _active_camera, send_frame_bgr
            if _active_camera is not None:
                send_frame_bgr(colored_depth)
            
            ret_enc, buffer = cv2.imencode('.jpg', colored_depth)
            if ret_enc:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    except Exception as e:
        print(f"Depth webcam error: {e}")
    finally:
        cap.release()

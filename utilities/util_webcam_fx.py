import cv2
import time
import threading
import queue

def generate_face_blur_webcam_frames(camera_index: int, conf_thresh: float, blur_type: str, blur_strength: int):
    from utilities.util_face_blur import load_face_detector, _padded_crop, make_blur_fn, apply_blur_fn
    
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        yield b""
        return
        
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    
    detector, status = load_face_detector(None, "fp32", 640)
    if detector is None:
        yield b""
        return
        
    blur_fn = make_blur_fn(blur_type, blur_strength)
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            faces = detector.get(frame)
            if faces:
                for face in faces:
                    if face.det_score < conf_thresh:
                        continue
                    
                    bbox = face.bbox.astype(int).tolist()
                    frame = apply_blur_fn(frame, bbox, blur_fn)
            
            ret_enc, buffer = cv2.imencode('.jpg', frame)
            if ret_enc:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    except Exception as e:
        print(f"Face blur webcam error: {e}")
    finally:
        cap.release()

def generate_depth_webcam_frames(camera_index: int, colormap: str, invert: bool):
    from utilities.util_depth_estimation import load_depth_model, predict_depth, apply_colormap
    
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
        
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            depth_map = predict_depth(depth_model, rgb_frame)
            
            # Apply colormap
            colored_depth = apply_colormap(depth_map, colormap, invert)
            
            # Resize colored depth to match frame size if needed
            colored_depth = cv2.resize(colored_depth, (frame.shape[1], frame.shape[0]))
            
            ret_enc, buffer = cv2.imencode('.jpg', colored_depth)
            if ret_enc:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    except Exception as e:
        print(f"Depth webcam error: {e}")
    finally:
        cap.release()

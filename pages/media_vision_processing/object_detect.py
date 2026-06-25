import os
import streamlit as st

# We do NOT import get_available_cameras or get_available_encoders here globally anymore.
from utilities.util_object_detect import (
    load_yolo_model, 
    analyze_image,
    render_image_boxes,
    process_video_object_detection,
    run_webcam_stream, 
    TEMP_DIR,
    load_cached_settings,
    save_cached_settings
)

st.header(":material/troubleshoot: Local Object Detection")
st.markdown("Run fast object detection using YOLO on Images, Videos, or Webcams.")

# ─────────────────────────────────────────────
# Session State Initialization
# ─────────────────────────────────────────────
_defaults = {
    'od_webcam_active': False,
    'od_scanned_img': False,
    'od_img_data': [],
    'od_base_img': None,
    'od_img_filename': "",
    'od_vid_filename': ""
}
for k, v in _defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

tab_config, tab_image, tab_video, tab_webcam = st.tabs(["Model Config", "Image Upload", "Video Upload", "Webcam"])

# ─────────────────────────────────────────────
# TAB 1 — Configuration
# ─────────────────────────────────────────────
with tab_config:
    with st.container(border=True):
        st.subheader(":material/settings: Model Settings")
        
        col_mod, col_opt = st.columns(2)
        with col_mod:
            model_labels = {
                "yolov8n.pt": "YOLOv8n (Standard Nano)",
                "yolov8s.pt": "YOLOv8s (Standard Small)",
                "yolo11n.pt": "YOLO11n (New SOTA - Nano)",
                "yolo11s.pt": "YOLO11s (New SOTA - Small)",
                "yolov10n.pt": "YOLOv10n (Ultra-low latency)",
                "rtdetr-l.pt": "RT-DETR Large (Transformer - High Accuracy)"
            }
            selected_model_name = st.selectbox(
                "1. YOLO Model Type", 
                options=list(model_labels.keys()),
                format_func=lambda x: model_labels[x],
                index=0
            )
            
            resolution = st.selectbox(
                "2. Inference Resolution", 
                options=[320, 640, 1280], 
                index=1, 
                help="Lower resolution increases speed significantly but reduces small object detection."
            )

        with col_opt:
            export_format = st.selectbox(
                "3. Hardware Optimization / Export",
                options=[
                    "PyTorch (Standard)", 
                    "FP16 (GPU Speedup)", 
                    "INT8 (CPU Speedup - ONNX)", 
                    "OpenVINO (Intel CPU Max Speed)"
                ],
                index=0,
                help="Exports the model to a highly optimized format on the first run."
            )
            
            conf_threshold = st.slider("4. Confidence Threshold", min_value=0.1, max_value=0.9, value=0.3, step=0.05)


# ─────────────────────────────────────────────
# TAB 2 — Image Upload & Selection
# ─────────────────────────────────────────────
@st.cache_data(show_spinner=False)
def get_encoded_image(img_arr):
    import cv2
    is_success, buffer = cv2.imencode(".jpg", cv2.cvtColor(img_arr, cv2.COLOR_RGB2BGR))
    if is_success: 
        return buffer.tobytes()
    return None

with tab_image:
    img_file = st.file_uploader("Upload an Image", type=["jpg", "jpeg", "png", "webp"], key="img_uploader")
    
    if img_file and img_file.name != st.session_state.od_img_filename:
        st.session_state.od_scanned_img = False
        st.session_state.od_img_filename = img_file.name
        st.session_state.od_img_data = []

    if img_file:
        if not st.session_state.od_scanned_img:
            if st.button("Process Image", icon=":material/rocket_launch:", type="primary", width="stretch"):
                model, load_msg = load_yolo_model(selected_model_name, export_format, resolution)
                if model is None:
                    st.error(load_msg)
                else:
                    with st.spinner("Analyzing image..."):
                        success, base_img, obj_data, err = analyze_image(img_file.getvalue(), model, resolution, conf_threshold)
                        if success:
                            st.session_state.od_base_img = base_img
                            st.session_state.od_img_data = obj_data
                            st.session_state.od_scanned_img = True
                            st.rerun()
                        else:
                            st.error(err)
        
        if st.session_state.od_scanned_img:
            st.success(f"Detected {len(st.session_state.od_img_data)} objects.")
            
            selected_ids = []
            if st.session_state.od_img_data:
                st.markdown("### Select Objects to Outline")
                cols = st.columns(6)
                for idx, obj in enumerate(st.session_state.od_img_data):
                    with cols[idx % 6]:
                        with st.container(border=True):
                            st.image(obj['crop'], width="stretch")
                            if st.checkbox(f"{obj['label']} {obj['conf']}%", value=True, key=f"img_chk_{obj['id']}"):
                                selected_ids.append(obj['id'])
            
            st.markdown("### Final Result")
            final_img = render_image_boxes(st.session_state.od_base_img, st.session_state.od_img_data, selected_ids)
            
            encoded_img_bytes = get_encoded_image(final_img)
            
            if encoded_img_bytes:
                st.image(encoded_img_bytes, width="stretch")
                st.download_button("Download Image", icon=":material/save:", data=encoded_img_bytes, file_name="detected.jpg", mime="image/jpeg", type="primary", width="stretch")


# ─────────────────────────────────────────────
# TAB 3 — Video Upload (Optimized Lazy Load)
# ─────────────────────────────────────────────
with tab_video:
    with st.container(border=True):
        vid_file = st.file_uploader("Upload a Video", type=["mp4", "mov", "avi", "mkv"], key="vid_uploader")
        
        if vid_file:
            st.subheader("Video Process Settings", icon=":material/settings:")
            
            col_v1, col_v2 = st.columns(2)
            with col_v1:
                out_method = st.radio(
                    "Output Method", 
                    ["Subtitle Overlay (.ass)", "Re-encode Video (Hard burned)"], 
                    help="Subtitle is instant and non-destructive. Re-encode modifies the actual pixels."
                )
                
            with col_v2:
                # Lazy Load Encoders
                cached_settings = load_cached_settings()
                encoders = cached_settings.get("encoders")

                if encoders is None:
                    st.warning("Video encoders not scanned yet.", icon=":material/warning:")
                    if st.button("Scan for System Encoders", icon=":material/search:"):
                        with st.spinner("Polling FFmpeg..."):
                            from utilities.util_media import get_available_encoders
                            new_encoders = get_available_encoders()
                            save_cached_settings("encoders", new_encoders)
                            st.rerun()
                    chosen_encoder_str = "cv2 (CPU Fallback)"
                    chosen_encoder = "cv2"
                else:
                    chosen_encoder_str = st.selectbox(
                        "FFmpeg Video Encoder",
                        options=encoders,
                        help="Select a hardware encoder (like nvenc) for drastically faster processing."
                    )
                    chosen_encoder = chosen_encoder_str.split(" ")[0]
                    
                    if "Re-encode" in out_method and not encoders[0].startswith("libx") and chosen_encoder == "cv2":
                        st.warning("FFmpeg not found. Falling back to slow CPU OpenCV encoding.", icon=":material/warning:")

            st.divider()
            
            if st.button("Process Video", icon=":material/rocket_launch:", type="primary", width="stretch"):
                model, load_msg = load_yolo_model(selected_model_name, export_format, resolution)
                
                if model is None:
                    st.error(load_msg)
                else:
                    input_path = os.path.join(TEMP_DIR, vid_file.name)
                    
                    with open(input_path, "wb") as f:
                        while chunk := vid_file.read(8192 * 1024):
                            f.write(chunk)
                        
                    prog_bar = st.progress(0.0, text="Preparing video... 0%")
                    
                    def _update_prog(p):
                        safe_p = min(max(p, 0.0), 1.0)
                        prog_bar.progress(safe_p, text=f"Processing Tracks... {int(safe_p * 100)}%")
                        
                    method_str = "subtitle" if "Subtitle" in out_method else "reencode"
                    
                    with st.spinner("Processing video with native ByteTrack..."):
                        success, out_path = process_video_object_detection(
                            input_path=input_path, 
                            model=model, 
                            resolution=resolution, 
                            conf_thresh=conf_threshold, 
                            output_method=method_str, 
                            progress_hook=_update_prog, 
                            encoder=chosen_encoder
                        )
                        
                    if success:
                        prog_bar.progress(1.0, text="Processing... 100%")
                        st.success("Complete!")
                        
                        with open(out_path, "rb") as f:
                            mime_type = "text/plain" if method_str == "subtitle" else "video/mp4"
                            st.download_button(f"Download {os.path.basename(out_path)}", icon=":material/save:", data=f, file_name=os.path.basename(out_path), mime=mime_type, type="primary", width="stretch")
                        
                        if method_str == "subtitle":
                            st.info("Open your original video in VLC, then drag and drop this `.ass` file onto it to see the tracking boxes.", icon=":material/lightbulb:")
                    else:
                        st.error(f"Failed: {out_path}")

# ─────────────────────────────────────────────
# TAB 4 — Real-time Webcam (Optimized Lazy Load)
# ─────────────────────────────────────────────
with tab_webcam:
    st.markdown("Click **Start** to begin tracking via multithreaded stream.")
    
    col_w1, col_w2 = st.columns(2)
    with col_w1:
        tracking_mode = st.radio(
            "Webcam Performance Strategy", 
            ["Native GPU (Every Frame)", "CPU Extrapolation (Smooth)"],
            index=1,
            help="Extrapolation calculates object speed and animates them smoothly while the CPU catches up."
        )
        use_tracking = "Extrapolation" in tracking_mode
        
    with col_w2:
        inference_fps = st.slider("AI Inference Rate (FPS)", min_value=1.0, max_value=30.0, value=6.0, step=1.0) if use_tracking else 30.0
        
        # Lazy Load Cameras
        cached_settings = load_cached_settings()
        cameras = cached_settings.get("cameras")
        
        can_start = False
        if cameras is None:
            st.warning("Cameras not scanned. Please scan to enable the webcam tracker.", icon=":material/warning:")
            if st.button("Scan for Cameras", icon=":material/search:"):
                with st.spinner("Polling system for webcams..."):
                    # Inline import prevents loading cv2 globally
                    from utilities.util_object_detect import get_available_cameras
                    new_cameras = get_available_cameras()
                    save_cached_settings("cameras", new_cameras)
                    st.rerun()
            selected_camera = 0
        else:
            can_start = True
            c1, c2 = st.columns([3,1])
            with c1:
                selected_camera = st.selectbox("Select Camera Index", cameras, index=0, format_func=lambda x: f"Camera {x}")
            with c2:
                if st.button("Rescan", icon=":material/refresh:"):
                    from utilities.util_object_detect import get_available_cameras
                    save_cached_settings("cameras", get_available_cameras())
                    st.rerun()

    col_start, col_stop = st.columns(2)
    
    # Disable start button until hardware is actually verified 
    if can_start:
        if col_start.button("Start Webcam", icon=":material/play_circle:", width="stretch", type="primary"):
            st.session_state.od_webcam_active = True
    else:
        col_start.button("Start Webcam", icon=":material/play_circle:", width="stretch", disabled=True)
        
    if col_stop.button("Stop Webcam", icon=":material/stop_circle:", width="stretch"):
        st.session_state.od_webcam_active = False

    fps_placeholder = st.empty()
    frame_placeholder = st.empty()

    if st.session_state.od_webcam_active:
        model, load_msg = load_yolo_model(selected_model_name, export_format, resolution)
        if model is None:
            st.error(load_msg)
            st.session_state.od_webcam_active = False
            st.rerun()
        else:
            run_webcam_stream(
                placeholder=frame_placeholder, 
                fps_placeholder=fps_placeholder, 
                model=model, 
                camera_index=selected_camera, 
                stop_flag_func=lambda: not st.session_state.od_webcam_active, 
                resolution=resolution,
                conf_thresh=conf_threshold,
                target_height=600,
                use_extrapolation=use_tracking,
                ai_fps=inference_fps
            )
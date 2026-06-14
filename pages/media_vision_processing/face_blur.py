import os
import time
import shutil
import streamlit as st
from utilities.util_face_blur import (
    scan_faces,
    process_media_blur,
    save_frame_cache,
    get_available_encoders,
    TEMP_DIR
)
from utilities.util_persistent import apply_footer

try:
    from streamlit_image_comparison import image_comparison
except ImportError:
    image_comparison = None

st.header("👤 AI Face Blurring")
st.markdown(
    "Automatically detect and selectively blur faces in images and videos.")

# Helper at module scope so every tab can safely call it


def _model_arg(label: str) -> str:
    if "buffalo_s" in label:
        return "buffalo_s"
    if "buffalo_m" in label:
        return "buffalo_m"
    if "antelopev2" in label:
        return "antelopev2"
    if "mtcnn" in label:
        return "mtcnn"
    if "cv2" in label:
        return "cv2"
    return "buffalo_l"


# ─────────────────────────────────────────────
# Session State Initialisation
# ─────────────────────────────────────────────
_defaults = {
    'fb_scanned':          False,
    'fb_face_data':        [],
    'fb_preview':          None,
    'fb_filename':         "",
    'fb_model':            "buffalo_l",
    'fb_frame_cache_path': None,
    'fb_output_method':    "reencode",
}
for k, v in _defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

tab_config, tab_select, tab_dl = st.tabs(
    ["⚙️ 1. Configuration", "🔍 2. Select Faces", "💾 3. Download"])

# ─────────────────────────────────────────────
# TAB 1 — Configuration & Upload
# ─────────────────────────────────────────────
with tab_config:
    with st.container(border=True):
        media_file = st.file_uploader(
            "Upload Image or Video",
            type=["jpg", "jpeg", "png", "mp4", "mov", "avi", "mkv"],
        )

        if media_file and media_file.name != st.session_state.fb_filename:
            st.session_state.fb_scanned = False
            st.session_state.fb_face_data = []
            st.session_state.fb_preview = None
            st.session_state.fb_frame_cache_path = None
            st.session_state.fb_filename = media_file.name

        is_video = media_file and media_file.name.lower().endswith(
            ('.mp4', '.mov', '.avi', '.mkv'))
        is_image = media_file and media_file.name.lower().endswith(('.jpg', '.jpeg', '.png'))

        st.subheader("⚙️ Settings")
        col_eng, col_type = st.columns(2)

        with col_eng:
            model_labels = {
                "buffalo_l": "buffalo_l (High Accuracy)",
                "buffalo_m": "buffalo_m (Balanced)",
                "buffalo_s": "buffalo_s (Fast/Lightweight)",
                "antelopev2": "antelopev2 (Latest/Experimental)",
                "mtcnn": "mtcnn (Deep Learning - Detection only)",
                "cv2": "cv2 (Haar Cascade - Fast, basic)"
            }

            detection_model = st.selectbox(
                "1. Face Detector (Finds the faces)",
                options=list(model_labels.keys()),
                format_func=lambda x: model_labels[x],
                index=0,
                help="buffalo_l or antelopev2 are highly recommended here."
            )

            if not is_image:
                rec_options = [k for k in model_labels.keys() if k not in [
                    "cv2", "mtcnn"]]
                rec_model = st.selectbox(
                    "2. Face Recognizer (Generates the fingerprint)",
                    options=rec_options,
                    format_func=lambda x: model_labels[x],
                    index=2,
                    help="buffalo_s is highly recommended here for fast fingerprinting."
                )

                precision_mode = st.selectbox(
                    "AI Model Precision (InsightFace only)",
                    options=["FP32 (Default Accuracy)",
                             "INT8 (Fastest, High RAM savings)"],
                    help="INT8 dynamically quantizes the model. It cuts RAM usage in half."
                )
                precision_val = "int8" if "INT8" in precision_mode else "fp32"
            else:
                rec_model = None
                precision_val = "fp32"

            det_res_str = st.selectbox(
                "Detection Resolution",
                options=[
                    "640x640 (High Accuracy, Slow CPU)",
                    "320x320 (Balanced)",
                    "160x160 (Fast, Prominent Faces Only)"
                ],
                index=0
            )
            det_size = int(det_res_str.split("x")[0])

        with col_type:
            if not is_image:
                method_sel = st.radio(
                    "Output Method",
                    options=["Re-encode (Hard Blur)",
                             "Subtitle (.ass) Overlay"],
                    help="Re-encode permanently blurs the video. Subtitle creates a lightning-fast, non-destructive overlay matching the skin tone."
                )
                st.session_state.fb_output_method = "subtitle" if "Subtitle" in method_sel else "reencode"
            else:
                st.session_state.fb_output_method = "reencode"

            blur_style = st.radio("Blur Style", options=[
                                  "Gaussian", "Pixelate"])
            intensity = st.slider(
                "Blur Intensity", min_value=1, max_value=100, value=50)

        if not is_image:
            st.divider()
            st.subheader("🎯 Clustering & Similarity")

            clustering_method = st.radio(
                "Clustering Strategy (How faces are grouped)",
                options=["Global (Immich-style, High Accuracy)",
                         "Sequential (Fast, Low RAM)"],
                horizontal=True,
            )

            col_t1, col_t2 = st.columns(2)
            with col_t1:
                cluster_threshold = st.slider(
                    "Clustering Threshold",
                    min_value=0.10, max_value=0.99, value=0.50, step=0.01,
                    help="Used during Scan to group faces."
                )
            with col_t2:
                match_threshold = st.slider(
                    "Recognition Threshold",
                    min_value=0.10, max_value=0.99, value=0.50, step=0.01,
                    help="Used during Process to confirm a face matches your selection."
                )
        else:
            clustering_method = "None"
            cluster_threshold = 0.50
            match_threshold = 0.50

        fps_scan, gap_limit, chosen_encoder = 5.0, 1.0, "libx264"

        if is_video:
            st.divider()
            st.subheader("🎞️ Video Process Settings")

            if not shutil.which("ffmpeg"):
                st.warning(
                    "⚠️ **FFmpeg not found.** Hardware encoding is disabled.")

            col_v1, col_v2 = st.columns(2)
            with col_v1:
                fps_scan = st.slider(
                    "Scan FPS", min_value=1.0, max_value=30.0, value=5.0, step=1.0,
                    help="Frames per second the AI analyses. Missing frames are interpolated."
                )
            with col_v2:
                gap_limit = st.slider(
                    "Max Interpolation Gap (sec)", min_value=0.1, max_value=5.0, value=1.0, step=0.1)

            encoders = get_available_encoders()
            chosen_encoder_str = st.selectbox(
                "FFmpeg Video Encoder",
                options=encoders,
                help="Select a hardware encoder (like nvenc) for drastically faster processing."
            )
            chosen_encoder = chosen_encoder_str.split(" ")[0]

        st.divider()

        if media_file:
            if st.button("🔍 Step 1: Scan & Detect Faces", type="primary", width="stretch"):
                os.makedirs(TEMP_DIR, exist_ok=True)
                input_path = os.path.join(TEMP_DIR, media_file.name)
                with open(input_path, "wb") as f:
                    f.write(media_file.getbuffer())

                model_arg = _model_arg(detection_model)
                scan_prog = st.progress(0.0)
                scan_status = st.empty()
                scan_status.text(
                    f"Scanning with {model_arg} at {det_size}x{det_size}…")

                time.sleep(0.1)

                def _step1_progress(p: float):
                    scan_prog.progress(min(p, 1.0))
                    scan_status.text(
                        f"Scanning unique faces… {int(p * 100)}% complete.")

                spinner_text = f"Scanning with {detection_model}…" if is_image else f"Scanning with {detection_model} + {rec_model}…"

                with st.spinner(spinner_text):
                    success, preview_img, face_data, frame_cache, msg = scan_faces(
                        input_path,
                        det_model=detection_model,
                        rec_model=rec_model,
                        precision=precision_val,
                        sample_fps=fps_scan,
                        clustering_method=clustering_method.split(
                            " ")[0] if clustering_method != "None" else "None",
                        cluster_threshold=cluster_threshold,
                        det_size=det_size,
                        progress_hook=_step1_progress,
                    )

                if success:
                    st.session_state.fb_scanned = True
                    st.session_state.fb_preview = preview_img
                    st.session_state.fb_face_data = face_data
                    st.session_state.fb_model = model_arg

                    if frame_cache:
                        cache_path = save_frame_cache(frame_cache, input_path)
                        st.session_state.fb_frame_cache_path = cache_path
                    else:
                        st.session_state.fb_frame_cache_path = None

                    scan_prog.progress(1.0)

                    if not face_data:
                        scan_status.warning("No faces detected in the media.")
                    else:
                        scan_status.success(
                            f"Scan complete! Found {len(face_data)} unique individual(s). "
                            "Proceed to the '2. Select Faces' tab above."
                        )
                else:
                    scan_prog.empty()
                    scan_status.error(msg)

# ─────────────────────────────────────────────
# TAB 2 — Visual Selection Grid
# ─────────────────────────────────────────────
selected_faces = []

with tab_select:
    if not st.session_state.fb_scanned:
        st.info("Please upload a file and run 'Step 1: Scan & Detect Faces' first.")
    else:
        st.markdown("### Original Media Preview")
        st.image(st.session_state.fb_preview, width="stretch")

        st.markdown("### Choose Faces to Blur")
        if not st.session_state.fb_face_data:
            st.info("No faces detected in the media.")
        else:
            cols = st.columns(6)
            for idx, face in enumerate(st.session_state.fb_face_data):
                with cols[idx % 6]:
                    with st.container(border=True):
                        st.image(face['crop'], width="stretch")
                        if st.checkbox(f"Face {face['id']}", value=True, key=f"chk_face_{face['id']}"):
                            selected_faces.append(face)

# ─────────────────────────────────────────────
# TAB 3 — Process & Download
# ─────────────────────────────────────────────
with tab_dl:
    if not st.session_state.fb_scanned:
        st.info("Please complete the scanning and selection steps first.")
    else:
        st.markdown("### Apply Blur")

        if st.button("🚀 Step 2: Process Media", type="primary", width="stretch"):
            if not selected_faces:
                st.warning(
                    "Please select at least one face in the 'Select Faces' tab.")
            else:
                input_path = os.path.join(
                    TEMP_DIR, st.session_state.fb_filename)

                progress_bar = st.progress(0.0)
                status_text = st.empty()
                status_text.text("Initialising render pipeline…")

                def _update_progress(p: float):
                    progress_bar.progress(min(p, 1.0))
                    status_text.text(f"Processing… {int(p * 100)}% complete.")

                with st.spinner("Rendering final file…"):
                    success, result_path = process_media_blur(
                        input_path=input_path,
                        blur_intensity=intensity,
                        blur_type=blur_style,
                        selected_faces=selected_faces,
                        scan_fps=fps_scan,
                        drop_limit_sec=gap_limit,
                        match_threshold=match_threshold,
                        encoder=chosen_encoder if is_video else None,
                        output_method=st.session_state.fb_output_method,
                        frame_cache=st.session_state.fb_frame_cache_path,
                        progress_hook=_update_progress,
                    )

                if success:
                    progress_bar.progress(1.0)
                    status_text.success("Face blurring complete!")
                    st.divider()

                    # Handle Subtitle Output
                    if result_path.endswith('.ass'):
                        st.info(
                            "💡 **Success!** No video re-encoding was necessary. Your original video remains completely untouched.")
                        st.markdown("### How to use:")
                        st.markdown(
                            "1. Open your **original** video in VLC Media Player.\n2. Drag and drop the downloaded `.ass` file onto the video player to see the face blurs.")

                        with open(result_path, "rb") as f:
                            st.download_button(
                                label="💾 Download Subtitle File (.ass)",
                                data=f,
                                file_name=os.path.basename(result_path),
                                mime="text/plain",
                                width="stretch",
                                type="primary",
                            )

                    # Handle Image Output
                    elif result_path.lower().endswith(('.png', '.jpg', '.jpeg')):
                        if image_comparison:
                            image_comparison(
                                img1=input_path, img2=result_path, label1="Original", label2="Blurred", in_memory=True)
                        else:
                            st.image(
                                result_path, caption="Blurred Output", width="stretch")

                        with open(result_path, "rb") as f:
                            st.download_button(
                                label="💾 Download Blurred Image",
                                data=f,
                                file_name=os.path.basename(result_path),
                                mime="image/jpeg",
                                width="stretch",
                                type="primary",
                            )

                    # Handle Re-encoded Video Output
                    else:
                        st.video(result_path)
                        with open(result_path, "rb") as f:
                            st.download_button(
                                label="💾 Download Blurred Video",
                                data=f,
                                file_name=os.path.basename(result_path),
                                mime="video/mp4",
                                width="stretch",
                                type="primary",
                            )
                else:
                    progress_bar.empty()
                    status_text.error(result_path)

apply_footer()

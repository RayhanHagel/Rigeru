import os
import tempfile
import streamlit as st
from utilities.util_media import process_video, batch_compress_images


# --- State Initialization ---
if "media_vid_out" not in st.session_state:
    st.session_state.media_vid_out = os.path.join(os.path.expanduser('~'), 'Videos')
if "media_img_in" not in st.session_state:
    st.session_state.media_img_in = ""
if "media_img_out" not in st.session_state:
    st.session_state.media_img_out = os.path.join(os.path.expanduser('~'), 'Pictures')

st.header("🎞️ Visual Media Compressor")
st.markdown("Locally trim videos and batch-compress images to save hard drive space.")

tab1, tab2 = st.tabs(["🎥 Video Trimmer & Compressor", "🖼️ Image Batch Compressor"])

# --- TAB 1: VIDEO COMPRESSOR ---
with tab1:
    with st.container(border=True):
        uploaded_video = st.file_uploader(
            "1. Select Input Video File",
            type=["mp4", "mkv", "mov", "avi", "wmv", "flv", "webm", "m4v"],
            key="video_uploader"
        )
        if uploaded_video:
            st.caption(f"📎 `{uploaded_video.name}`")

        st.text_input(
            "2. Output Folder",
            value=st.session_state.media_vid_out,
            key="vid_out_display",
            help="Type the full path where the compressed video should be saved."
        )
        st.session_state.media_vid_out = st.session_state.get("vid_out_display", st.session_state.media_vid_out)

    st.subheader("Trimming & Profile")
    col_t1, col_t2 = st.columns(2)
    start_t = col_t1.number_input("Start Time (seconds)", min_value=0.0, value=0.0, step=1.0, key="vid_start")
    end_t = col_t2.number_input("End Time (seconds)", min_value=0.0, value=99999.0, step=1.0, key="vid_end")

    # Handbrake Presets Logic
    profile = st.selectbox(
        "Compression Profile", 
        ["Custom Configuration", "Handbrake: Fast 1080p", "Handbrake: High Quality 1080p", "Handbrake: Web Optimized 720p"]
    )

    if profile == "Custom Configuration":
        target_res = st.selectbox("Max Resolution", ["Keep Original", "1080p", "720p", "480p"], index=1)
        col_crf, col_preset = st.columns(2)
        crf_val = col_crf.slider("CRF Quality (Lower = Better/Larger File)", 0, 51, 23)
        enc_preset = col_preset.selectbox("Encoding Speed Preset", ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"], index=4)

        col_a1, col_a2 = st.columns(2)
        keep_all_audio = col_a1.checkbox("Keep All Audio Tracks (Multi-track)", value=True)
        audio_codec = col_a2.selectbox("Audio Codec", ["aac", "copy"], help="AAC recompresses audio, Copy keeps original quality.")
    else:
        if profile == "Handbrake: Fast 1080p":
            target_res = "1080p"; crf_val = 22; enc_preset = "fast"; keep_all_audio = False; audio_codec = "aac"
        elif profile == "Handbrake: High Quality 1080p":
            target_res = "1080p"; crf_val = 18; enc_preset = "slow"; keep_all_audio = True; audio_codec = "copy"
        elif profile == "Handbrake: Web Optimized 720p":
            target_res = "720p"; crf_val = 28; enc_preset = "veryfast"; keep_all_audio = False; audio_codec = "aac"
        
        st.info(f"**Loaded Preset:** Max Res: {target_res} | CRF: {crf_val} | Speed: {enc_preset} | Audio: {audio_codec.upper()}")

    # Fixed Invalid width parameter
    if st.button("🚀 Process Video", type="primary", width="stretch", key="btn_process_video"):
        if not uploaded_video:
            st.error("Please upload a video file.")
        elif not os.path.isdir(st.session_state.media_vid_out):
            st.error("Output folder does not exist. Please enter a valid path.")
        else:
            suffix = os.path.splitext(uploaded_video.name)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(uploaded_video.read())
                tmp_path = tmp.name

            with st.spinner("Processing video... This might take a while."):
                success, msg = process_video(
                    tmp_path, st.session_state.media_vid_out, 
                    start_t, end_t, target_res, 
                    crf=crf_val, preset=enc_preset, 
                    keep_all_audio=keep_all_audio, audio_codec=audio_codec
                )

            os.unlink(tmp_path)

            if success:
                st.success(msg)
            else:
                st.error(msg)

# --- TAB 2: IMAGE COMPRESSOR ---
with tab2:
    with st.container(border=True):
        st.text_input(
            "1. Input Image Folder",
            value=st.session_state.media_img_in,
            key="img_in_display",
            help="Full path to the folder containing images to compress."
        )
        st.session_state.media_img_in = st.session_state.get("img_in_display", st.session_state.media_img_in)

        st.text_input(
            "2. Output Image Folder",
            value=st.session_state.media_img_out,
            key="img_out_display",
            help="Full path to the folder where compressed images will be saved."
        )
        st.session_state.media_img_out = st.session_state.get("img_out_display", st.session_state.media_img_out)

    st.subheader("Compression Settings")
    img_quality = st.slider("JPEG Quality", min_value=10, max_value=100, value=80, key="img_quality")
    
    col_w, col_h = st.columns(2)
    img_width = col_w.number_input("Target Box Width (px)", min_value=0, value=1920, help="Set to 0 to ignore")
    img_height = col_h.number_input("Target Box Height (px)", min_value=0, value=1080, help="Set to 0 to ignore")
    
    fit_mode = st.selectbox(
        "Resizing Mode (If dimensions provided)",
        ["Maintain Aspect Ratio (Fit Inside)", "Stretch to Fit", "Pad with Black Bars", "Pad with White Bars", "Pad with Blurred Background"]
    )

    # Fixed Invalid width parameter
    if st.button("🚀 Batch Compress Images", type="primary", width="stretch", key="btn_compress_images"):
        if not os.path.isdir(st.session_state.media_img_in):
            st.error("Input folder not found. Please enter a valid path.")
        elif not os.path.isdir(st.session_state.media_img_out):
            st.error("Output folder not found. Please enter a valid path.")
        else:
            with st.spinner("Compressing images..."):
                success, msg = batch_compress_images(
                    st.session_state.media_img_in,
                    st.session_state.media_img_out,
                    img_quality,
                    img_width,
                    img_height,
                    fit_mode
                )
            if success:
                st.success(msg)
            else:
                st.error(msg)


import os
import streamlit as st
from utilities.util_censor import TEMP_DIR, get_available_encoders
from utilities.util_persistent import apply_footer

try:
    from streamlit_image_comparison import image_comparison
except ImportError:
    image_comparison = None

st.header("🛡️ AI Media De-Nudifier")
st.markdown("Upload an image or video. The AI will scan and block NSFW content.")

ALL_LABELS = [
    "FEMALE_GENITALIA_COVERED", "FACE_FEMALE", "BUTTOCKS_EXPOSED",
    "FEMALE_BREAST_EXPOSED", "FEMALE_GENITALIA_EXPOSED", "MALE_BREAST_EXPOSED",
    "ANUS_EXPOSED", "FEET_EXPOSED", "BELLY_COVERED", "FEET_COVERED",
    "ARMPITS_COVERED", "ARMPITS_EXPOSED", "FACE_MALE", "BELLY_EXPOSED",
    "MALE_GENITALIA_EXPOSED", "ANUS_COVERED", "FEMALE_BREAST_COVERED", "BUTTOCKS_COVERED"
]

DEFAULT_LABELS = [
    "FEMALE_GENITALIA_EXPOSED", "MALE_GENITALIA_EXPOSED", 
    "FEMALE_BREAST_EXPOSED", "BUTTOCKS_EXPOSED", "ANUS_EXPOSED"
]

with st.container(border=True):
    media_file = st.file_uploader("🎬 Upload Image or Video", type=["mp4", "mkv", "avi", "mov", "jpg", "jpeg", "png", "webp"])
    
    is_video = media_file and media_file.name.lower().endswith(('.mp4', '.mkv', '.avi', '.mov'))
    is_image = media_file and media_file.name.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))
    
    with st.expander("🎯 Target Labels Configuration", expanded=False):
        st.markdown("Select which anatomical features the AI should detect and blur.")
        selected_labels = []
        cols = st.columns(3)
        
        for idx, label in enumerate(ALL_LABELS):
            with cols[idx % 3]:
                is_checked = st.checkbox(label, value=(label in DEFAULT_LABELS))
                if is_checked:
                    selected_labels.append(label)
                    
    # --- Processing Configuration ---
    st.subheader("⚙️ Processing Engine")
    st.markdown(
        """
        * **OpenCV / Pure CPU:** Works on all computers. Very slow for video.
        * **ONNXRuntime (CUDA):** Uses an NVIDIA GPU. Fast and highly recommended.
        * **TensorRT:** Maximum performance. Requires specialized NVIDIA TensorRT libraries to be installed.
        """
    )
    
    engine_selection = st.radio(
        "Select Hardware Acceleration",
        options=["OpenCV / Pure CPU", "ONNXRuntime (CUDA)", "TensorRT"],
        horizontal=True,
        label_visibility="collapsed"
    )
    
    st.divider()
    
    col_meth, col_mod = st.columns(2)
    with col_meth:
        if not is_image:
            censor_method = st.radio(
                "Censorship Output Method",
                options=["Re-encode (Hard Blur)", "Subtitle (.ass) Skin-Tone Overlay"],
                help="Re-encode permanently blurs the frames. Subtitle creates a fast overlay matching the skin tone with a soft edge."
            )
            method_arg = "reencode" if "Re-encode" in censor_method else "subtitle"
            
            if method_arg == "reencode":
                encoders = get_available_encoders()
                chosen_encoder_str = st.selectbox(
                    "FFmpeg Video Encoder",
                    options=encoders,
                    help="Select a hardware encoder (like nvenc) for drastically faster processing."
                )
                chosen_encoder = chosen_encoder_str.split(" ")[0]
            else:
                chosen_encoder = "libx264"
        else:
            method_arg = "reencode"
            chosen_encoder = "libx264"
            
        blur_style = st.radio("Blur Style", options=["Gaussian", "Pixelate"])
        intensity = st.slider("Blur Intensity", min_value=1, max_value=100, value=50)
            
    with col_mod:
        model_selection = st.radio(
            "ONNX Detection Model",
            options=["320n (Faster)", "640m (More Accurate)"],
            help="320n processes much faster but may miss small details. 640m is slower but highly accurate."
        )
        
        precision_mode = st.selectbox(
            "AI Model Precision",
            options=["FP32 (Default Accuracy)", "INT8 (Fastest, High RAM savings)"],
            help="INT8 dynamically quantizes the model. It cuts RAM usage in half and boosts pure-CPU speed, but may reduce bounding box accuracy."
        )
        precision_val = "int8" if "INT8" in precision_mode else "fp32"
        
        if is_video:
            scan_speed = st.slider(
                "Scan Precision (Frames per Second)", 
                min_value=1.0, 
                max_value=5.0, 
                value=2.0, 
                step=0.5,
                help="Higher values are more precise but take longer to scan. 2 FPS is generally the best balance."
            )
        else:
            scan_speed = 2.0
    
    if st.button("🚀 Process Media", type="primary", width='stretch'):
        if not media_file:
            st.warning("Please upload a media file first.")
        elif not selected_labels:
            st.warning("Please select at least one label to censor.")
        else:
            # ─────────────────────────────────────────────
            # LAZY IMPORT: Only loads massive libraries when the user explicitly clicks process
            # ─────────────────────────────────────────────
            from utilities.util_censor import process_media_censor
            
            os.makedirs(TEMP_DIR, exist_ok=True)
            input_path = os.path.join(TEMP_DIR, media_file.name)
            
            with open(input_path, "wb") as f:
                f.write(media_file.getbuffer())

            progress_bar = st.progress(0.0)
            status_text = st.empty()
            
            model_arg = "320n.onnx" if "320n" in model_selection else "640m.onnx"
            
            if "TensorRT" in engine_selection:
                engine_arg = "tensorrt"
            elif "ONNX" in engine_selection:
                engine_arg = "onnx"
            else:
                engine_arg = "cpu"
            
            model_display_name = "320n" if "320n" in model_arg else "640m"
            status_text.text(f"Scanning via {model_display_name} ({engine_arg.upper()})... Please wait.")
            
            def update_progress(percentage):
                progress_bar.progress(percentage)
                status_text.text(f"Processing... {int(percentage * 100)}% complete.")

            success, result_path = process_media_censor(
                input_path, 
                target_classes=selected_labels, 
                scan_fps=scan_speed, 
                method=method_arg, 
                model_type=model_arg,
                engine=engine_arg,
                precision=precision_val,
                blur_intensity=intensity,
                blur_type=blur_style,
                encoder=chosen_encoder,
                progress_hook=update_progress
            )
            
            if success:
                progress_bar.progress(1.0)
                status_text.success("Censorship generation complete!")
                
                st.divider()
                
                if result_path.endswith('.ass'):
                    st.info("💡 **Success!** No video re-encoding was necessary. Your original video remains completely untouched.")
                    st.markdown("### How to use:")
                    st.markdown("1. Open your **original** video in VLC Media Player.\n2. Drag and drop the downloaded `.ass` file onto the video player to see the blurs.")
                    
                    with open(result_path, "rb") as f:
                        st.download_button(
                            label="💾 Download Subtitle File (.ass)",
                            data=f,
                            file_name=os.path.basename(result_path),
                            mime="text/plain",
                            width="stretch",
                            type="primary",
                        )

                elif result_path.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                    if image_comparison:
                        image_comparison(
                            img1=input_path, img2=result_path, label1="Original", label2="Censored", in_memory=True)
                    else:
                        st.image(result_path, caption="Censored Output", width="stretch")
                        
                    with open(result_path, "rb") as f:
                        mime_type = "image/webp" if result_path.lower().endswith('.webp') else ("image/png" if result_path.lower().endswith('.png') else "image/jpeg")
                        st.download_button(
                            label="💾 Download Censored Image",
                            data=f,
                            file_name=os.path.basename(result_path),
                            mime=mime_type,
                            width="stretch",
                            type="primary",
                        )

                else:
                    st.video(result_path)
                    with open(result_path, "rb") as f:
                        st.download_button(
                            label="💾 Download Censored Video",
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
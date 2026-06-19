import os
import streamlit as st
from utilities.util_depth_estimation import (
    process_image_depth,
    process_video_depth,
    get_available_encoders,
    TEMP_DIR
)

from streamlit.runtime.scriptrunner import add_script_run_ctx
import threading

try:
    from streamlit_image_comparison import image_comparison
except ImportError:
    image_comparison = None

st.header(":material/settings_cinematic_blur: Depth Estimation")
st.markdown("Generate high-quality monocular depth maps from images and videos using ONNX-accelerated Depth Anything V2.")

# ─────────────────────────────────────────────
# Session State Initialization
# ─────────────────────────────────────────────
_defaults = {
    'de_img_scanned': False,
    'de_base_img_path': None,
    'de_depth_img_path': None,
    'de_img_filename': "",
    'de_processing': False,
    'de_error': None,
    'de_vid_processing': False,
    'de_vid_error': None,
}
for k, v in _defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

tab_config, tab_image, tab_video = st.tabs([":material/settings: Model Config", ":material/image: Image Processing", ":material/film: Video Processing"])

# ─────────────────────────────────────────────
# TAB 1 — Configuration
# ─────────────────────────────────────────────
with tab_config:
    with st.container(border=True):
        st.subheader(":material/settings: Depth Model Settings")
        
        st.markdown(
            """
            * **OpenCV / Pure CPU:** Works on all computers.
            * **ONNXRuntime (CUDA):** Uses an NVIDIA GPU. Fast and highly recommended.
            * **TensorRT:** Maximum performance. Requires NVIDIA TensorRT libraries.
            """
        )
        
        engine_selection = st.radio(
            "Hardware Acceleration",
            options=["OpenCV / Pure CPU", "ONNXRuntime (CUDA)", "TensorRT"],
            horizontal=True,
            label_visibility="collapsed"
        )
        
        st.divider()

        col_mod, col_opt = st.columns(2)
        with col_mod:
            selected_model_size = st.selectbox(
                "1. Estimation Model Size", 
                options=["Small", "Base"],
                index=0,
                help="Small is lightning fast for video. Base is heavier but more accurate."
            )
            
            if "TensorRT" in engine_selection:
                engine_arg = "tensorrt"
            elif "ONNX" in engine_selection:
                engine_arg = "onnx"
            else:
                engine_arg = "cpu"

        with col_opt:
            colormap = st.selectbox(
                "2. Depth Colormap",
                options=["INFERNO", "PLASMA", "VIRIDIS", "MAGMA", "JET", "GRAY"],
                index=0
            )
            
            precision_mode = st.selectbox(
                "3. Precision / Quantization",
                options=["FP32 (Normal 32-bit)", "FP16 (Half-Precision GPU)", "INT8 (8-bit CPU Fast)"],
                index=0,
                help="FP32 is standard. FP16 doubles speed on NVIDIA GPUs. INT8 dynamically quantizes the model to save RAM and boost Intel/AMD CPUs."
            )
            
            # Map UI to backend argument
            if "INT8" in precision_mode:
                precision_arg = "int8"
            elif "FP16" in precision_mode:
                precision_arg = "fp16"
            else:
                precision_arg = "fp32"
                
            invert_depth = st.checkbox("Invert Depth Map", value=False)


# ─────────────────────────────────────────────
# TAB 2 — Image Processing
# ─────────────────────────────────────────────
with tab_image:
    img_file = st.file_uploader("Upload an Image", type=["jpg", "jpeg", "png", "webp"], key="de_img_uploader")
    
    if img_file and img_file.name != st.session_state.de_img_filename:
        st.session_state.de_img_scanned = False
        st.session_state.de_img_filename = img_file.name
        st.session_state.de_base_img_path = None
        st.session_state.de_depth_img_path = None
        st.session_state.de_error = None

    if img_file:
        if not st.session_state.de_img_scanned and not st.session_state.de_processing:
            if st.button("Generate Depth Map", type="primary", width="stretch", icon=":material/layers:"):
                st.session_state.de_processing = True
                st.session_state.de_error = None
                
                os.makedirs(TEMP_DIR, exist_ok=True)
                input_path = os.path.join(TEMP_DIR, img_file.name)
                with open(input_path, "wb") as f:
                    f.write(img_file.getbuffer())
                
                def _process_depth_bg():
                    """Background thread for depth processing"""
                    try:
                        success, result_path, msg = process_image_depth(
                            input_path=input_path,
                            model_size=selected_model_size,
                            engine=engine_arg,
                            precision=precision_arg,
                            colormap=colormap,
                            invert=invert_depth
                        )
                        
                        if success:
                            st.session_state.de_base_img_path = input_path
                            st.session_state.de_depth_img_path = result_path
                            st.session_state.de_img_scanned = True
                            st.session_state.de_error = None
                        else:
                            st.session_state.de_error = msg
                            st.session_state.de_img_scanned = False
                    except Exception as e:
                        st.session_state.de_error = f"Processing error: {str(e)}"
                        st.session_state.de_img_scanned = False
                    finally:
                        st.session_state.de_processing = False
                
                status_placeholder = st.empty()
                status_placeholder.info(f":material/model_training: Generating depth map using {selected_model_size} ({engine_arg.upper()} {precision_arg.upper()}) in background...")
                
                # Start background thread
                depth_thread = threading.Thread(target=_process_depth_bg, daemon=False)
                add_script_run_ctx(depth_thread)
                depth_thread.start()
                
                # Wait for completion
                depth_thread.join()
                status_placeholder.empty()
                st.rerun()
        
        # Show error if processing failed
        if st.session_state.de_error:
            st.error(st.session_state.de_error)
        
        # Show loading state
        if st.session_state.de_processing:
            st.info(":material/hourglass: Processing depth map... Please wait.")
        
        # Display results after processing
        if st.session_state.de_img_scanned and st.session_state.de_base_img_path and st.session_state.de_depth_img_path:
            st.success("Depth map generated successfully!")
            
            st.markdown("### Result Comparison")
            if image_comparison:
                image_comparison(
                    img1=st.session_state.de_base_img_path, 
                    img2=st.session_state.de_depth_img_path, 
                    label1="Original", 
                    label2="Depth Map", 
                    in_memory=True
                )
            else:
                st.image([st.session_state.de_base_img_path, st.session_state.de_depth_img_path], width="stretch")
            
            with open(st.session_state.de_depth_img_path, "rb") as f:
                st.download_button(
                    "Download Depth Map", 
                    data=f.read(), 
                    file_name=f"depth_{st.session_state.de_img_filename}", 
                    mime="image/jpeg", 
                    type="primary", 
                    width="stretch",
                    icon=":material/download:"
                )

# ─────────────────────────────────────────────
# TAB 3 — Video Processing
# ─────────────────────────────────────────────
with tab_video:
    with st.container(border=True):
        vid_file = st.file_uploader("Upload a Video", type=["mp4", "mov", "avi", "mkv"], key="de_vid_uploader")
        
        if vid_file:
            st.subheader(":material/settings: Video Process Settings")
            
            encoders = get_available_encoders()
            chosen_encoder_str = st.selectbox(
                "FFmpeg Video Encoder",
                options=encoders,
                help="Select a hardware encoder (like nvenc) for drastically faster processing."
            )
            chosen_encoder = chosen_encoder_str.split(" ")[0]

            st.divider()
            
            if st.button("Process Video", type="primary", width="stretch", disabled=st.session_state.de_vid_processing, icon=":material/play_arrow:"):
                st.session_state.de_vid_processing = True
                st.session_state.de_vid_error = None
                
                os.makedirs(TEMP_DIR, exist_ok=True)
                input_path = os.path.join(TEMP_DIR, vid_file.name)
                with open(input_path, "wb") as f:
                    f.write(vid_file.getbuffer())
                
                # Placeholders for updates
                prog_bar = st.progress(0.0)
                status_text = st.empty()
                
                def _process_video_bg():
                    """Background thread for video processing"""
                    try:
                        def _update_prog(p: float):
                            safe_p = min(max(p, 0.0), 1.0)
                            prog_bar.progress(safe_p, text=f"Estimating Depth... {int(safe_p * 100)}%")
                        
                        success, out_path, msg = process_video_depth(
                            input_path=input_path, 
                            model_size=selected_model_size,
                            engine=engine_arg,
                            precision=precision_arg,
                            colormap=colormap,
                            invert=invert_depth,
                            encoder=chosen_encoder,
                            progress_hook=_update_prog
                        )
                        
                        if success:
                            st.session_state.de_vid_output_path = out_path
                            st.session_state.de_vid_success = True
                            st.session_state.de_vid_error = None
                        else:
                            st.session_state.de_vid_error = msg
                            st.session_state.de_vid_success = False
                    except Exception as e:
                        st.session_state.de_vid_error = f"Video processing error: {str(e)}"
                        st.session_state.de_vid_success = False
                    finally:
                        st.session_state.de_vid_processing = False
                
                status_text.info(f":material/hourglass: Processing video using {selected_model_size} ({engine_arg.upper()} {precision_arg.upper()}) in background...")
                
                # Start background thread
                vid_thread = threading.Thread(target=_process_video_bg, daemon=False)
                add_script_run_ctx(vid_thread)
                vid_thread.start()
                
                # Wait for completion
                vid_thread.join()
                status_text.empty()
                st.rerun()
            
            # Show error if processing failed
            if st.session_state.de_vid_error:
                st.error(st.session_state.de_vid_error)
            
            # Show loading state
            if st.session_state.de_vid_processing:
                st.info("⏳ Processing video... Please wait. This may take a while depending on video length and selected encoder.")
            
            # Display results after processing
            if st.session_state.get('de_vid_success') and st.session_state.get('de_vid_output_path'):
                prog_bar.progress(1.0, text="Processing Complete! 100%")
                st.success("Video processed successfully!")
                st.video(st.session_state.de_vid_output_path)
                
                with open(st.session_state.de_vid_output_path, "rb") as f:
                    st.download_button(
                        f"Download {os.path.basename(st.session_state.de_vid_output_path)}", 
                        data=f, 
                        file_name=os.path.basename(st.session_state.de_vid_output_path), 
                        mime="video/mp4", 
                        type="primary", 
                        width="stretch",
                        icon=":material/download:"
                    )

try:
    
except NameError:
    pass
import os
import streamlit as st
from utilities.util_depth_estimation import (
    process_image_depth,
    process_video_depth,
    get_available_encoders,
    TEMP_DIR
)
from utilities.util_persistent import apply_footer

try:
    from streamlit_image_comparison import image_comparison
except ImportError:
    image_comparison = None

st.header("🌌 AI Depth Estimation")
st.markdown("Generate high-quality monocular depth maps from images and videos using ONNX-accelerated Depth Anything V2.")

# ─────────────────────────────────────────────
# Session State Initialization
# ─────────────────────────────────────────────
_defaults = {
    'de_img_scanned': False,
    'de_base_img_path': None,
    'de_depth_img_path': None,
    'de_img_filename': "",
}
for k, v in _defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

tab_config, tab_image, tab_video = st.tabs(["⚙️ Model Config", "📷 Image Processing", "🎞️ Video Processing"])

# ─────────────────────────────────────────────
# TAB 1 — Configuration
# ─────────────────────────────────────────────
with tab_config:
    with st.container(border=True):
        st.subheader("⚙️ Depth Model Settings")
        
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

    if img_file:
        if not st.session_state.de_img_scanned:
            if st.button("🚀 Generate Depth Map", type="primary", width="stretch"):
                os.makedirs(TEMP_DIR, exist_ok=True)
                input_path = os.path.join(TEMP_DIR, img_file.name)
                with open(input_path, "wb") as f:
                    f.write(img_file.getbuffer())
                
                with st.spinner(f"Estimating depth via {selected_model_size} ({engine_arg.upper()} {precision_arg.upper()})..."):
                    success, result_path, msg = process_image_depth(
                        input_path=input_path,
                        model_size=selected_model_size,
                        engine=engine_arg,
                        precision=precision_arg, # <-- Fixed here!
                        colormap=colormap,
                        invert=invert_depth
                    )
                    
                    if success:
                        st.session_state.de_base_img_path = input_path
                        st.session_state.de_depth_img_path = result_path
                        st.session_state.de_img_scanned = True
                        st.rerun()
                    else:
                        st.error(msg)
        
        if st.session_state.de_img_scanned:
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
                    "💾 Download Depth Map", 
                    data=f.read(), 
                    file_name=f"depth_{st.session_state.de_img_filename}", 
                    mime="image/jpeg", 
                    type="primary", 
                    width="stretch"
                )

# ─────────────────────────────────────────────
# TAB 3 — Video Processing
# ─────────────────────────────────────────────
with tab_video:
    with st.container(border=True):
        vid_file = st.file_uploader("Upload a Video", type=["mp4", "mov", "avi", "mkv"], key="de_vid_uploader")
        
        if vid_file:
            st.subheader("⚙️ Video Process Settings")
            
            encoders = get_available_encoders()
            chosen_encoder_str = st.selectbox(
                "FFmpeg Video Encoder",
                options=encoders,
                help="Select a hardware encoder (like nvenc) for drastically faster processing."
            )
            chosen_encoder = chosen_encoder_str.split(" ")[0]

            st.divider()
            
            if st.button("🚀 Process Video", type="primary", width="stretch"):
                os.makedirs(TEMP_DIR, exist_ok=True)
                input_path = os.path.join(TEMP_DIR, vid_file.name)
                with open(input_path, "wb") as f:
                    f.write(vid_file.getbuffer())
                    
                prog_bar = st.progress(0.0, text="Preparing video... 0%")
                
                def _update_prog(p: float):
                    safe_p = min(max(p, 0.0), 1.0)
                    prog_bar.progress(safe_p, text=f"Estimating Depth... {int(safe_p * 100)}%")
                
                with st.spinner(f"Processing video frames via {selected_model_size} ({engine_arg.upper()} {precision_arg.upper()})..."):
                    success, out_path, msg = process_video_depth(
                        input_path=input_path, 
                        model_size=selected_model_size,
                        engine=engine_arg,
                        precision=precision_arg, # <-- Fixed here!
                        colormap=colormap,
                        invert=invert_depth,
                        encoder=chosen_encoder,
                        progress_hook=_update_prog
                    )
                    
                if success:
                    prog_bar.progress(1.0, text="Processing Complete! 100%")
                    st.success("Video processed successfully!")
                    st.video(out_path)
                    
                    with open(out_path, "rb") as f:
                        st.download_button(
                            f"💾 Download {os.path.basename(out_path)}", 
                            data=f, 
                            file_name=os.path.basename(out_path), 
                            mime="video/mp4", 
                            type="primary", 
                            width="stretch"
                        )
                else:
                    st.error(f"Failed: {msg}")

try:
    apply_footer()
except NameError:
    pass
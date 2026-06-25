import os
import json
import streamlit as st
from utilities.util_upscale import upscale_image, check_model_downloaded, get_compute_device

SETTINGS_FILE = "./cache/upscaler/settings.json"

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"scale": 4, "device": "cuda"}

def save_settings(scale, device):
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        json.dump({"scale": scale, "device": device}, f)

if "upscale_result" not in st.session_state: 
    st.session_state.upscale_result = None
if "original_image_bytes" not in st.session_state: 
    st.session_state.original_image_bytes = None
if "uploaded_filename" not in st.session_state: 
    st.session_state.uploaded_filename = ""

st.header(":material/auto_awesome: AI Image Upscaler (Real-ESRGAN)")
st.markdown("Locally restore, enhance, and upscale low-resolution images to 4K+ using Deep Learning.")

MODEL_STATS = {
    2: {"scale": "2x Upscale", "desc": "Great for large photos."},
    4: {"scale": "4x Upscale", "desc": "The Standard ESRGAN architecture."},
    8: {"scale": "8x Upscale", "desc": "Extreme enhancement for tiny images."}
}

def format_model_label(scale_key):
    stats = MODEL_STATS[scale_key]
    status_icon = ":material/check_circle: Ready (Local)" if check_model_downloaded(scale_key) else ":material/download: Will Download"
    return f"{stats['scale']} ({status_icon}) - {stats['desc']}"

@st.fragment
def ui_controls():
    settings = load_settings()

    with st.container(border=True):
        uploaded_file = st.file_uploader(":material/image: Upload Image", type=["jpg", "jpeg", "png", "webp"])
        
        if uploaded_file and st.session_state.uploaded_filename != uploaded_file.name:
            st.session_state.uploaded_filename = uploaded_file.name
            st.session_state.original_image_bytes = uploaded_file.getvalue()
            st.session_state.upscale_result = None
            st.rerun()

    with st.expander(":material/settings: Model Configuration", expanded=True):
        col_scale, col_device = st.columns(2)
        
        scale_idx = [2, 4, 8].index(settings["scale"]) if settings["scale"] in [2, 4, 8] else 1
        selected_scale = col_scale.selectbox("Upscale Factor", options=[2, 4, 8], format_func=format_model_label, index=scale_idx)
        
        devices = get_compute_device()
        device_idx = devices.index(settings["device"]) if settings["device"] in devices else 0
        compute_mode = col_device.selectbox("Compute Device", devices, index=device_idx, help="Use 'cuda' for GPU acceleration.")
        
        if selected_scale != settings["scale"] or compute_mode != settings["device"]:
            save_settings(selected_scale, compute_mode)

    if st.button(":material/rocket_launch: Enhance Image", type="primary", use_container_width=True):
        if not uploaded_file:
            st.error("Please upload a valid image file first.")
            return

        spinner_msg = "Enhancing image via GPU..." if compute_mode == "cuda" else "Enhancing image... (This will take a while on CPU)"
        cache_dir = "cache"
        os.makedirs(cache_dir, exist_ok=True)
        temp_path = os.path.join(cache_dir, f"temp_upscale_{uploaded_file.name}")
        
        try:
            with open(temp_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
                
            with st.spinner(spinner_msg):
                success, result = upscale_image(temp_path, scale=selected_scale, device=compute_mode)
                
                if success:
                    st.session_state.upscale_result = result
                    st.success("Enhancement Complete!")
                else:
                    st.error(f"Error: {result}")
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            st.rerun()

ui_controls()

st.divider()

@st.fragment
def ui_results():
    if st.session_state.upscale_result and st.session_state.original_image_bytes:
        from io import BytesIO
        from PIL import Image
        from streamlit_image_comparison import image_comparison
        
        st.markdown("### :material/search: Interactive Comparison")
        st.caption("Drag the slider to compare the original image against the AI-enhanced output.")
        
        orig_img = Image.open(BytesIO(st.session_state.original_image_bytes))
        
        image_comparison(
            img1=orig_img,
            img2=st.session_state.upscale_result,
            label1="Original Image",
            label2="AI Enhanced",
            starting_position=50,
            show_labels=True,
            make_responsive=True,
        )
        
        buf = BytesIO()
        st.session_state.upscale_result.save(buf, format="PNG")
        
        file_prefix = st.session_state.uploaded_filename.split('.')[0]
        st.download_button(
            label=":material/save: Download Upscaled Image (.png)",
            data=buf.getvalue(),
            file_name=f"upscaled_{file_prefix}.png",
            mime="image/png",
            type="primary",
            use_container_width=True
        )

ui_results()
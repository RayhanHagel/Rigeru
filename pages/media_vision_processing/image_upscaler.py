import os
from io import BytesIO
from PIL import Image
import streamlit as st
from streamlit_image_comparison import image_comparison
from utilities.util_upscale import upscale_image, check_model_downloaded, get_compute_device


# --- State Initialization ---
if "upscale_result" not in st.session_state: 
    st.session_state.upscale_result = None
if "original_image_bytes" not in st.session_state: 
    st.session_state.original_image_bytes = None
if "uploaded_filename" not in st.session_state: 
    st.session_state.uploaded_filename = ""

st.header("✨ AI Image Upscaler (Real-ESRGAN)")
st.markdown("Locally restore, enhance, and upscale low-resolution images to 4K+ using Deep Learning.")

# --- Model Statistics Dictionary ---
MODEL_STATS = {
    2: {"scale": "2x Upscale", "size": "65 MB", "speed": "Fastest", "desc": "Great for large photos."},
    4: {"scale": "4x Upscale", "size": "65 MB", "speed": "Balanced", "desc": "The Standard ESRGAN architecture."},
    8: {"scale": "8x Upscale", "size": "65 MB", "speed": "Slowest", "desc": "Extreme enhancement for tiny images."}
}

def format_model_label(scale_key):
    stats = MODEL_STATS[scale_key]
    is_dl = check_model_downloaded(scale_key)
    status_icon = "✅ Ready (Local)" if is_dl else "⬇️ Will Download"
    return f"{stats['scale']} ({status_icon}) - {stats['desc']}"

# --- Image Selection ---
with st.container(border=True):
    # ISSUE 16: Swapped to native st.file_uploader
    uploaded_file = st.file_uploader("🖼️ Upload Image", type=["jpg", "jpeg", "png", "webp"])
    
    if uploaded_file:
        if st.session_state.uploaded_filename != uploaded_file.name:
            st.session_state.uploaded_filename = uploaded_file.name
            st.session_state.original_image_bytes = uploaded_file.getvalue()
            st.session_state.upscale_result = None

# --- Enhancement Settings ---
# ISSUE 16: Wrapped in an expander to match Subtitle Studio UI
with st.expander("⚙️ Model Configuration", expanded=True):
    col_scale, col_device = st.columns(2)
    
    selected_scale = col_scale.selectbox(
        "Upscale Factor", 
        options=[2, 4, 8], 
        format_func=format_model_label,
        index=1
    )
    
    # Safely fetch available compute devices
    try:
        devices = get_compute_device()
        if not isinstance(devices, list): 
            devices = ["cuda", "cpu"]
    except Exception:
        devices = ["cuda", "cpu"]
        
    compute_mode = col_device.selectbox("Compute Device", devices, index=0, help="Use 'cuda' for GPU acceleration.")

# --- Execution ---
# Fixed deprecated width parameter
if st.button("🚀 Enhance Image", type="primary", width="stretch"):
    if not uploaded_file:
        st.error("Please upload a valid image file first.")
    else:
        spinner_msg = "Enhancing image... (This will take a while on CPU)" if compute_mode == "cpu" else "Enhancing image via GPU..."
        
        # ISSUE 16: Route temp file to cache folder
        cache_dir = "cache"
        os.makedirs(cache_dir, exist_ok=True)
        temp_path = os.path.join(cache_dir, f"temp_upscale_{uploaded_file.name}")
        
        try:
            # Save the uploaded bytes to the temp file
            with open(temp_path, "wb") as f:
                f.write(uploaded_file.getbuffer())
                
            with st.spinner(spinner_msg):
                success, result = upscale_image(
                    temp_path, 
                    scale=selected_scale, 
                    device=compute_mode
                )
                
                if success:
                    st.session_state.upscale_result = result
                    st.success("Enhancement Complete!")
                else:
                    st.error(f"Error: {result}")
                    
        finally:
            # ISSUE 16: Force deletion of the temp file right after processing
            if os.path.exists(temp_path):
                os.remove(temp_path)

st.divider()

# --- Interactive Before/After Results ---
if st.session_state.upscale_result and st.session_state.original_image_bytes:
    st.markdown("### 🔍 Interactive Comparison")
    st.caption("Drag the slider to compare the original image against the AI-enhanced output.")
    
    orig_img = Image.open(BytesIO(st.session_state.original_image_bytes))
    upscaled_img = st.session_state.upscale_result
    
    # Render the interactive Streamlit sliding widget
    image_comparison(
        img1=orig_img,
        img2=upscaled_img,
        label1="Original Image",
        label2="AI Enhanced",
        starting_position=50,
        show_labels=True,
        make_responsive=True,
    )
    
    # Convert PIL Image to bytes for downloading
    buf = BytesIO()
    upscaled_img.save(buf, format="PNG")
    byte_im = buf.getvalue()
    
    file_prefix = st.session_state.uploaded_filename.split('.')[0]
    st.download_button(
        label="💾 Download Upscaled Image (.png)",
        data=byte_im,
        file_name=f"upscaled_{file_prefix}.png",
        mime="image/png",
        type="primary",
        width="stretch"
    )


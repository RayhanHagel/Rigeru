import streamlit as st
from PIL import Image

try:
    from streamlit_cropper import st_cropper
except ImportError:
    st_cropper = None

from utilities.util_math_latex import process_math_image, get_model_labels


st.header(":material/function: Math Screenshot to LaTeX")
st.markdown("Upload a screenshot of a mathematical equation, crop it, and convert it to copyable LaTeX code.")

tab_config, tab_upload = st.tabs([":material/settings: Model Configuration", ":material/image: Process Image"])

# ─────────────────────────────────────────────
# TAB 1 — Configuration
# ─────────────────────────────────────────────
with tab_config:
    st.markdown("### Select LaTeX OCR Backend")
    
    # Dynamically load model options from the utility
    models = get_model_labels()
    ocr_model = st.selectbox("Model", models)
    
    # Allow user to specify hardware preference
    device_preference = st.selectbox("Device Preference", ["Auto-Detect", "CPU", "GPU"])

# ─────────────────────────────────────────────
# TAB 2 — Process Image
# ─────────────────────────────────────────────
with tab_upload:
    with st.container(border=True):
        uploaded_file = st.file_uploader(
            "Upload Math Image", 
            type=["png", "jpg", "jpeg", "webp"],
            help="Crop the image as closely to the equation as possible for best results."
        )
        
        if uploaded_file:
            img = Image.open(uploaded_file)
            
            st.markdown("**Crop your image:** *(Drag the box to frame the equation)*")
            
            if st_cropper:
                # Realtime update is true, returns the cropped section immediately
                cropped_img = st_cropper(img, realtime_update=True, box_color='#00FF00', aspect_ratio=None)
            else:
                st.warning("`streamlit-cropper` is not installed. Displaying original image. Run `pip install streamlit-cropper` to enable cropping.")
                cropped_img = img
                st.image(img, width="stretch")
                
            if st.button("Convert to LaTeX", type="primary", width="stretch", icon=":material/rocket_launch:"):
                with st.spinner(f"Analyzing equation using {ocr_model}..."):
                    # Pass the cropped image along with the config settings
                    success, result = process_math_image(cropped_img, ocr_model, device_preference)
                    
                if success:
                    st.success("Conversion successful!")
                    
                    st.markdown("### Rendered Output")
                    with st.container(border=True):
                        st.latex(result)
                    
                    st.markdown("### Export Formats")
                    tab_latex, tab_word, tab_text = st.tabs([":material/code: LaTeX", ":material/file_copy: MS Word", ":material/text_fields: Plain Text"])
                    
                    with tab_latex:
                        st.code(result, language="latex")
                        
                    with tab_word:
                        st.info("Copy the block below and paste directly into MS Word (it natively converts \\[ \\] blocks into equations).")
                        st.code(f"\\[\n{result}\n\\]", language="latex")
                        
                    with tab_text:
                        st.code(f"${result}$", language="text")
                else:
                    st.error(result)


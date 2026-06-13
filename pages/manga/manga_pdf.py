import os
import base64
import streamlit as st
from streamlit_extras.eval_javascript import eval_javascript
from utilities.util_persistent import apply_footer

# --- State Initialization & Routing ---
if "selected_title" not in st.session_state or not st.session_state.get("open_chapter"):
    st.switch_page(st.session_state.nav_home["manga_library"])

st.header(f"📖 {st.session_state.selected_title}")
st.subheader(f"Chapter {st.session_state.open_chapter}", divider="violet")

# --- Sidebar Configuration ---
reader_option = st.sidebar.pills(
    label="Reader Engine", 
    options=["Embed", "Streamlit"], 
    default="Streamlit"
)

# --- Dynamic Screen Size Detection ---
width_value = eval_javascript("window.innerWidth", key="javascript_width")
width_state = st.session_state.get("javascript_width", {})
width_status = width_state.get("status", "idle")
width_error = width_state.get("error")

height_value = eval_javascript("window.innerHeight", key="javascript_height")
height_state = st.session_state.get("javascript_height", {})
height_status = height_state.get("status", "idle")
height_error = height_state.get("error")

# --- PDF Rendering ---
# Only render when Javascript successfully fetched dimensions
if (height_status != "running" and not height_error and height_value is not None and 
    width_status != "running" and not width_error and width_value is not None):
    
    # Calculate optimal defaults based on screen size
    default_width = int(round(int(width_value) * 0.9 / 50) * 50)
    default_height = int(round(int(height_value) * 0.8 / 50) * 50)
    
    height_px = st.sidebar.slider(
        label="Reader Height",
        min_value=50,
        max_value=2000,
        value=default_height,
        step=50,
        help="Change the height of the reader",
        key="reader_height"
    )
        
    # Target PDF Path construction (Safe cross-platform)
    pdf_path = os.path.join(
        ".", "cache", "library", 
        st.session_state.selected_title, 
        f"Chapter {str(st.session_state.open_chapter).zfill(2)}.pdf"
    )
    
    if not os.path.exists(pdf_path):
        st.error(f"PDF file not found: `{pdf_path}`")
        st.info("Please return to the library and ensure the chapter is fully downloaded.")
        st.stop()
        
    # Rendering Logic
    if reader_option == "Embed":
        width_px = st.sidebar.slider(
            label="Reader Width",
            min_value=50,
            max_value=2000,
            value=default_width,
            step=50,
            help="Change the width of the reader",
            key="reader_width"
        )
        
        with open(pdf_path, "rb") as f:
            base64_pdf = base64.b64encode(f.read()).decode('utf-8')

        pdf_display = f'<embed id="pdfViewer" src="data:application/pdf;base64,{base64_pdf}" width="{width_px}" height="{height_px}" type="application/pdf">'
        st.markdown(pdf_display, unsafe_allow_html=True)

    elif reader_option == "Streamlit":
        # Native/Custom Streamlit PDF component
        st.pdf(
            data=pdf_path,
            height=height_px        
        )

apply_footer()
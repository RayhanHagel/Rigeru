import base64
import streamlit as st
from streamlit_extras.eval_javascript import *
from utilities.util_persistent import apply_logo




apply_logo()
if "selected_title" not in st.session_state:
    st.switch_page(st.session_state.manga["library"])


reader_option = st.sidebar.pills(label="Option", options=["Embed", "Streamlit"], default="Streamlit")


if "javascript_width" not in st.session_state:
    width_value = eval_javascript("window.innerWidth", key="javascript_width")
    
    component_state = st.session_state.get("javascript_width", {})
    status = component_state.get("status", "idle")
    error = component_state.get("error")
    
    if status != "running" and not error and width_value != None:
        st.session_state.reader_width = int(round(width_value * 0.8 / 50) * 50)
    

if "javascript_height" not in st.session_state:
    height_value = eval_javascript("window.innerHeight", key="javascript_height")

    component_state = st.session_state.get("javascript_height", {})
    status = component_state.get("status", "idle")
    error = component_state.get("error")
    
    if status != "running" and not error and height_value != None:
        st.session_state.reader_height = int(round(height_value * 0.1 / 50) * 50)

    
height_px = st.sidebar.slider(
    label="Reader Height",
    min_value=50,
    max_value=2000,
    value=500,
    step=50,
    help="Change the height of the reader",
    key="reader_height"
)
    
if reader_option == "Embed":
    width_px = st.sidebar.slider(
        label="Reader Width",
        min_value=50,
        max_value=2000,
        value=1000,
        step=50,
        help="Change the width of the reader",
        key="reader_width"
    )
    with open(f"./cache/library/{st.session_state.selected_title}/Chapter {st.session_state.open_chapter.zfill(2)}.pdf", "rb") as f:
        base64_pdf = base64.b64encode(f.read()).decode('utf-8')

        pdf_display = f'<embed id="pdfViewer" src="data:application/pdf;base64,{base64_pdf}" width="{width_px}" height="{height_px}" type="application/pdf">'
        st.markdown(pdf_display, unsafe_allow_html=True)

elif reader_option == "Streamlit":
    st.pdf(
        data=f"./cache/library/{st.session_state.selected_title}/Chapter {st.session_state.open_chapter.zfill(2)}.pdf",
        height=height_px        
    )
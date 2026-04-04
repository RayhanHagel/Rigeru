import base64
import streamlit as st
from streamlit_extras.eval_javascript import *
from utilities.util_persistent import apply_footer





if ("selected_title" not in st.session_state) or not st.session_state.get("open_chapter"):
    st.switch_page(st.session_state.manga["library"])


reader_option = st.sidebar.pills(label="Option", options=["Embed", "Streamlit"], default="Streamlit")


width_value = eval_javascript("window.innerWidth", key="javascript_width")
width_state = st.session_state.get("javascript_width", {})
width_status = width_state.get("status", "idle")
width_error = width_state.get("error")


height_value = eval_javascript("window.innerHeight", key="javascript_height")
height_state = st.session_state.get("javascript_height", {})
height_status = height_state.get("status", "idle")
height_error = height_state.get("error")


if height_status != "running" and not height_error and height_value is not None and width_status != "running" and not width_error and width_value is not None:
    width, height = int(width_value), int(height_value)
    width = int(round(width * 0.9 / 50) * 50)
    height = int(round(height * 0.8 / 50) * 50)
    
    height_px = st.sidebar.slider(
        label="Reader Height",
        min_value=50,
        max_value=2000,
        value=height,
        step=50,
        help="Change the height of the reader",
        key="reader_height"
    )
        
    if reader_option == "Embed":
        width_px = st.sidebar.slider(
            label="Reader Width",
            min_value=50,
            max_value=2000,
            value=width,
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


apply_footer()
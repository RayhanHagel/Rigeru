import os
import base64
import streamlit as st
import fitz  # PyMuPDF
from streamlit_extras.eval_javascript import eval_javascript


# --- State Initialization & Routing ---
if "selected_title" not in st.session_state or not st.session_state.get("open_chapter"):
    st.switch_page(st.session_state.nav_hidden["manga_library"])

st.header(f"📖 {st.session_state.selected_title}")
st.subheader(f"Chapter {st.session_state.open_chapter}", divider="violet")

# --- Sidebar Configuration ---
reader_option = st.sidebar.pills(
    label="Reader Engine", 
    options=["Native Image", "Embed", "Streamlit"], 
    default="Native Image"
)

# Layout options only appear if using the Native Image engine
if reader_option == "Native Image":
    layout_mode = st.sidebar.radio("Reading Style", ["Continuous (Manhwa)", "Side-by-Side (Manga)"])
    if layout_mode == "Side-by-Side (Manga)":
        reading_dir = st.sidebar.radio("Reading Direction", ["Right-to-Left", "Left-to-Right"])

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
if (height_status != "running" and not height_error and height_value is not None and 
    width_status != "running" and not width_error and width_value is not None):
    
    default_width = int(round(int(width_value) * 0.9 / 50) * 50)
    default_height = int(round(int(height_value) * 0.8 / 50) * 50)
        
    pdf_path = os.path.join(
        ".", "cache", "library", 
        st.session_state.selected_title, 
        f"Chapter {str(st.session_state.open_chapter).zfill(2)}.pdf"
    )
    
    if not os.path.exists(pdf_path):
        st.error(f"PDF file not found: `{pdf_path}`")
        st.info("Please return to the library and ensure the chapter is fully downloaded.")
        st.stop()
        
    # --- 1. Native Image Logic (Custom Layouts) ---
    if reader_option == "Native Image":
        
        # Cache the extraction so pages don't reload every time a button is clicked
        @st.cache_data(show_spinner="Extracting pages for reader...")
        def get_pdf_pages(path):
            doc = fitz.open(path)
            return [page.get_pixmap(dpi=200).tobytes("png") for page in doc]
            
        pages = get_pdf_pages(pdf_path)

        if layout_mode == "Continuous (Manhwa)":
            # CSS hack to remove Streamlit's default gap between elements for seamless scrolling
            st.markdown('<style>div[data-testid="stImage"] { margin-bottom: -1rem; }</style>', unsafe_allow_html=True)
            
            for page_bytes in pages:
                st.image(page_bytes, width="stretch")
                
        elif layout_mode == "Side-by-Side (Manga)":
            for i in range(0, len(pages), 2):
                cols = st.columns(2)
                page_1 = pages[i]
                page_2 = pages[i+1] if i+1 < len(pages) else None
                
                # Standard Manga reading is Right-to-Left
                if reading_dir == "Right-to-Left":
                    with cols[1]:
                        st.image(page_1, width="stretch")
                    with cols[0]:
                        if page_2:
                            st.image(page_2, width="stretch")
                else:
                    with cols[0]:
                        st.image(page_1, width="stretch")
                    with cols[1]:
                        if page_2:
                            st.image(page_2, width="stretch")

    # --- 2. Embed Logic ---
    elif reader_option == "Embed":
        height_px = st.sidebar.slider("Reader Height", 50, 2000, default_height, 50, key="reader_height")
        width_px = st.sidebar.slider("Reader Width", 50, 2000, default_width, 50, key="reader_width")
        
        with open(pdf_path, "rb") as f:
            base64_pdf = base64.b64encode(f.read()).decode('utf-8')

        pdf_display = f'<embed id="pdfViewer" src="data:application/pdf;base64,{base64_pdf}#view=FitH" width="{width_px}" height="{height_px}" type="application/pdf">'
        st.markdown(pdf_display, unsafe_allow_html=True)

    # --- 3. Streamlit Logic ---
    elif reader_option == "Streamlit":
        height_px = st.sidebar.slider("Reader Height", 50, 2000, default_height, 50, key="reader_height_st")
        st.pdf(
            data=pdf_path,
            height=height_px        
        )


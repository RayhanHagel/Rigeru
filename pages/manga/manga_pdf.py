import streamlit as st
from utilities.util_persistent import apply_logo




if "selected_title" not in st.session_state:
    st.switch_page(st.session_state.manga["library"])


height_px = st.sidebar.slider(
    label="Reader",
    min_value=50,
    max_value=2000,
    value=500,
    step=50,
    help="Change the height of the reader",
)
    
apply_logo()
st.pdf(
    data=f"./cache/library/{st.session_state.selected_title}/Chapter {st.session_state.open_chapter.zfill(2)}.pdf",
    height=height_px        
)

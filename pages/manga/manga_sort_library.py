import streamlit as st
from streamlit_sortables import sort_items
from utilities.util_manga import save_config
from utilities.util_persistent import apply_logo




apply_logo()
st.header("☄️ Manga and Manhwa")
st.subheader(body="Sort Library", width="stretch", divider="violet")


sortable_library = [
    {'header': '',  'items': [key for key, _ in st.session_state.manga_library]}
]

custom_css = """
    .sortable-container, .sortable-container-body {
        background-color: transparent !important;
        border: none !important;
    }

    .sortable-item {
        background-color: transparent !important;
        border: 1px solid #803df5 !important; 
        border-radius: 10px;
        margin-bottom: 16px;
        transition: border-color 0.2s ease;
        font-family: "Source Sans Pro", "Source Sans 3", sans-serif !important;
        font-size: 14px;
    }
    
    .sortable-item:hover {
        border-color: #5b1bc4 !important;
        background-color: transparent !important;
        border-radius: 10px;
        margin-bottom: 16px;
        cursor: grab;
    }

    .sortable-item:active {
        opacity: 0 !important;
    }
"""

cols = st.columns(spec=[0.55, 0.45], gap="small")

with cols[0]:
    sorted_items = sort_items(items=sortable_library, direction="vertical", custom_style=custom_css, multi_containers=True)
    reordered_data = {k: st.session_state.manga_cache[k] for k in sorted_items[0]['items'] if k in st.session_state.manga_cache}
    save_config(replace_data=reordered_data)
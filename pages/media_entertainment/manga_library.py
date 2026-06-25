import streamlit as st
from utilities.util_manga import refresh_library, read_cache


# --- State Initialization ---
st.session_state.open_chapter = False
if "manga_cache" not in st.session_state:
    st.session_state.manga_cache = read_cache()
st.header(":material/local_library: Manga and Manhwa")


# --- Sidebar Configuration ---
column_amount = st.sidebar.slider(
    label="Library Grid Size",
    min_value=1,
    max_value=10,
    value=4,
    help="Change the amount of covers shown per row.",
)


# --- Fragment Definitions ---


@st.fragment
def render_action_bar():
    # --- Top Action Bar ---
    cols = st.columns(spec=[0.76, 0.08, 0.08, 0.08], gap="small", vertical_alignment="bottom")
    cols[0].subheader(body="Reading Library", width="stretch", divider="violet")

    # Search Button
    if cols[1].button("", icon=":material/content_paste_search:", width="stretch", help="Search for Titles"):
        st.switch_page(st.session_state.nav_hidden["manga_search"])

    # Refresh Button
    if cols[2].button(label="", icon=":material/refresh:", width="stretch", help="Refresh the library"):
        refresh_library()
        st.rerun() 

    # Sort Button
    if cols[3].button(label="", icon=":material/drag_pan:", width="stretch", help="Sort the library"):
        st.session_state.temp_manga_cache = st.session_state.manga_cache
        st.switch_page(st.session_state.nav_hidden["manga_sort"])


@st.fragment
def render_manga_grid(column_amount, manga_library):
    grid_cols = st.columns(spec=column_amount, gap="small", vertical_alignment="top")
    for idx, (key, value) in enumerate(manga_library):
        col = grid_cols[idx % column_amount]
        
        with col:
            with st.container(border=True):
                image_path = value.get("local_image")
                
                # Render the image natively
                if image_path:
                    st.image(image_path, width="stretch")
                else:
                    st.warning("Image missing")
                
                display_title = key if len(key) <= 30 else f"{key[:27]}..."
                if st.button(f"**{display_title}**", type="tertiary", key=f"read_title_{key}", width="stretch"):
                    st.session_state.selected_title = key
                    st.switch_page(st.session_state.nav_hidden["manga_read"])
                    
                st.caption(f"Chapter {value.get('chapter_read', 0)} / {value.get('chapters_amount', 0)}")


# --- Rendering the UI ---
render_action_bar()
manga_library = list(st.session_state.manga_cache.items())
render_manga_grid(column_amount, manga_library)
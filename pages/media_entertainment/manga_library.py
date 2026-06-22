import streamlit as st
from streamlit_clickable_images import clickable_images
from utilities.util_manga import refresh_library, read_cache
from utilities.util_network import get_image_cache

# --- State Initialization ---
st.session_state.open_chapter = False

# OPTIMIZED: Deferred cache loading for manga library
if "manga_cache" not in st.session_state:
    st.session_state.manga_cache = read_cache()

st.header(":material/local_library: Manga and Manhwa")

# --- Top Action Bar ---
cols = st.columns(spec=[0.76, 0.08, 0.08, 0.08], gap="small", vertical_alignment="bottom")
cols[0].subheader(body="Reading Library", width="stretch", divider="violet")

# Search Button
if cols[1].button("", icon=":material/content_paste_search:", width="stretch", help="Search for Titles"):
    st.switch_page(st.session_state.nav_hidden["manga_search"])

# Refresh Button
cols[2].button(
    label="", 
    icon=":material/refresh:", 
    on_click=refresh_library, 
    width="stretch", 
    help="Refresh the library"
)

if cols[3].button(label="", icon=":material/drag_pan:", width="stretch", help="Sort the library"):
    st.session_state.temp_manga_cache = st.session_state.manga_cache
    st.switch_page(st.session_state.nav_hidden["manga_sort"])

# --- Sidebar Configuration ---
column_amount = st.sidebar.slider(
    label="Library Grid Size",
    min_value=1,
    max_value=10,
    value=4,
    help="Change the amount of covers shown per row.",
)

# --- Fragment Definition ---
@st.fragment
def render_manga_grid(column_amount, manga_library):
    for i in range(0, len(manga_library), column_amount):
        grid_cols = st.columns(spec=column_amount, gap="small", vertical_alignment="top")
        
        for j in range(column_amount):
            if i + j < len(manga_library):
                key, value = manga_library[i+j]
                
                with grid_cols[j]:
                    with st.container(border=True, height="stretch"):
                        use_proxy = value.get("website") == "mangadex.org/"
                        image_encoded = get_image_cache(
                            url=value["image"], 
                            crop=True,
                            use_tor_proxies=use_proxy,
                            use_default_headers=not use_proxy
                        )
                        
                        clicked = -1
                        if image_encoded:
                            clicked = clickable_images(
                                paths=[image_encoded],
                                titles=[key],
                                div_style={"display": "flex", "justify-content": "center"},
                                img_style={"cursor": "pointer", "width": "100%", "border-radius": "10px"},
                            )
                        else:
                            st.warning("Image missing")
                            if st.button("Read", icon=":material/menu_book:", key=f"fallback_{key}", width="stretch"):
                                clicked = 0
                                
                        st.write(f" **{key}**")
                        st.caption(f"Chapter {value.get('chapter_read', 0)} / {value.get('chapters_amount', 0)}")
                        
                        if clicked == 0:
                            st.session_state.selected_title = key
                            st.switch_page(st.session_state.nav_hidden["manga_read"])

# --- Library Rendering Grid ---
manga_library = list(st.session_state.manga_cache.items())
# Render the optimized fragment grid
render_manga_grid(column_amount, manga_library)
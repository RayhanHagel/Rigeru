import streamlit as st
from streamlit_clickable_images import clickable_images
from utilities.util_manga import refresh_library
from utilities.util_network import get_image_cache
from utilities.util_persistent import apply_footer




st.session_state.open_chapter = False


st.header("☄️ Manga and Manhwa")
cols = st.columns(spec=[0.84, 0.08, 0.08], gap="small", vertical_alignment="bottom")
cols[0].subheader(body="Reading Library", width="stretch", divider="violet")
cols[1].button(label="", icon=":material/refresh:", on_click=refresh_library, use_container_width=True, help="Refresh the library")
if cols[2].button(label="", icon=":material/drag_pan:", use_container_width=True, help="Sort the library"):
    st.session_state.temp_manga_cache = st.session_state.manga_cache
    st.switch_page(st.session_state.manga["sort"])


column_amount = st.sidebar.slider(
    label="Library",
    min_value=1,
    max_value=10,
    value=4,
    help="Change the card amount per row",
)

manga_library = list(st.session_state.manga_cache.items())

for i in range(0, len(manga_library), column_amount):
    cols = st.columns(spec=column_amount, gap="small", vertical_alignment="top")
    
    for j in range(column_amount):
        if i + j < len(manga_library):
            key, value = manga_library[i+j]
            with cols[j]:
                with st.container(border=True, height="stretch"):
                    image_encoded = get_image_cache(url=value["image"], crop=True)
                    
                    if image_encoded:
                        clicked = clickable_images(
                            [image_encoded],
                            titles=[key],
                            div_style={"display": "flex", "justify-content": "center"},
                            img_style={"cursor": "pointer", "width": "100%", "border-radius": "10px"},
                        )
                    else:
                        clicked = st.button("Image didn't load, so here is a button.")
                    st.write(f" **{key}**")
                    st.caption(f"Chapter {value['chapter_read']} / {value['chapters_amount']}")
                    
                    if clicked == 0:
                        st.session_state.selected_title = key
                        st.switch_page(st.session_state.manga["read"])
        else:
            st.container(border=False)


apply_footer()
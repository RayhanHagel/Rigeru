import streamlit as st
from utilities.util_manga import refresh_library, get_image_base64, process_image
from streamlit_clickable_images import clickable_images
from utilities.util_persistent import apply_logo
from streamlit_extras.bottom_container import *
from streamlit_extras.pagination import *




st.session_state.open_chapter = False

apply_logo()
st.header("☄️ Manga and Manhwa")
cols = st.columns(spec=[0.84, 0.08, 0.08], gap="small", vertical_alignment="bottom")
cols[0].subheader(body="Reading Library", width="stretch", divider="violet")
cols[1].button(label="", icon=":material/refresh:", on_click=refresh_library, args=[st.session_state.cache_data], use_container_width=True, help="Refresh the library")
if cols[2].button(label="", icon=":material/drag_pan:", use_container_width=True, help="Sort the library"):
    st.switch_page(st.session_state.manga["sort"])


column_amount = st.sidebar.slider(
    label="Library",
    min_value=1,
    max_value=10,
    value=4,
    help="Change the card amount per row",
)


for i in range(0, len(st.session_state.library_list), column_amount):
    cols = st.columns(spec=column_amount, gap="small", vertical_alignment="top")
    
    for j in range(column_amount):
        if i + j < len(st.session_state.library_list):
            key, value = st.session_state.library_list[i+j]
            with cols[j]:
                with st.container(border=True, height="stretch"):
                    image_cropped = process_image(value["image"])
                    image_encoded = get_image_base64(image_cropped)
                    
                    clicked = clickable_images(
                        [f"data:image/png;base64,{image_encoded}"],
                        titles=[key],
                        div_style={"display": "flex", "justify-content": "center"},
                        img_style={"cursor": "pointer", "width": "100%", "border-radius": "10px"},
                    )
                    
                    st.write(f" **{key}**")
                    st.caption(f"Chapter {value['chapter_read']} / {value['chapters_amount']}")
                    
                    if clicked == 0:
                        st.session_state.selected_title = key
                        st.switch_page(st.session_state.manga["read"])
        else:
            st.container(border=False)
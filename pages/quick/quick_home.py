import streamlit as st
from utilities.util_quick import read_cache, render_control_bar
from streamlit_clickable_images import clickable_images
from utilities.util_persistent import apply_footer
from utilities.util_network import get_image_cache
from streamlit_extras.redirect import *




if "quick_cache" not in st.session_state:
    st.session_state.quick_cache = read_cache()

if "temp_data" not in st.session_state:
    st.session_state.temp_data = []



st.header("⚡ Quick Navigation")
cols = st.columns(spec=[0.92, 0.08], gap="small", vertical_alignment="bottom")
cols[0].subheader(body="Home Page", width="stretch", divider="violet")
if cols[1].button(label="", icon=":material/drag_pan:", use_container_width=True, help="Sort the library"):
    st.session_state.temp_quick_cache = st.session_state.quick_cache
    st.switch_page(st.session_state.quick["sort"])
    


column_amount = st.sidebar.slider(
    label="Library",
    min_value=1,
    max_value=5,
    value=3,
    help="Change the card amount per row",
)


for i in range(0, len(st.session_state.quick_cache)+1, column_amount):
    cols = st.columns(spec=column_amount, gap="small", vertical_alignment="top")
    
    for j in range(column_amount):
        # This one shows the saved config in the quick_navigation.json
        if i + j < len(st.session_state.quick_cache):
            with cols[j]:
                with st.container(border=True, height="stretch"):
                    for widget in st.session_state.quick_cache[i+j]:
                        match widget["widget"]:
                            case "image":
                                image_to_add = get_image_cache(url=widget["input"], crop=True, crop_size=(640, 360))
                                try:
                                    st.image(image=image_to_add, width="content")
                                except Exception as e:
                                    st.markdown(":red[The input provided for the image is not valid!]")
                            case "link button":
                                st.link_button(
                                    label="",
                                    url=widget["input"],
                                    icon=":material/link:",
                                    use_container_width=True
                                )
                            case "text":
                                st.write(widget["input"])
                            case "caption":
                                st.caption(widget["input"])
                            case "clickable image":
                                url = widget["input"].split(" | ")[0]
                                to_do = widget["input"].split(" | ")[1]
                                
                                image_encoded = get_image_cache(url=url, crop=True, crop_size=(640, 360))
                                
                                clicked = clickable_images(
                                    [image_encoded],
                                    titles=[to_do],
                                    div_style={"display": "flex", "justify-content": "center"},
                                    img_style={"cursor": "pointer", "width": "100%", "border-radius": "10px"},
                                )
                                if clicked == 0:
                                    try:
                                        redirect(to_do)
                                    except ValueError:
                                        js = f"window.location.href = '{to_do}';"
                                        st.components.v1.html(f"<script>{js}</script>", height=0)
                            case _:
                                st.markdown(":red[[Error] Widget key is not valid!]")
        
        # This one is to modify the config
        elif i + j == len(st.session_state.quick_cache):
            with cols[j]:
                with st.container(border=False, height="stretch"):
                    
                    # To show the initial add card button
                    if not st.session_state.get("hide_add_button", False):
                        add_button = st.button(
                            label="", icon=":material/add_box:",
                            on_click=lambda: st.session_state.update({"hide_add_button": True}),
                            use_container_width=True,
                            help="Add a new card to the quick navigation library!"
                        )
                    
                    # After the Add card button is clicked > Show the controls
                    else:
                        with st.container(border=True, height="stretch", gap="small"):
                            st.selectbox(
                                label="placeholder",
                                placeholder="Choose a widget to add first",
                                index=None,
                                options=["image", "link button", "text", "caption", "clickable image"],
                                key="temp_data_widget",
                                label_visibility="collapsed"
                            )
                            st.text_input(
                                label="placeholder",
                                placeholder="Enter widget details",
                                key="temp_data_input",
                                label_visibility="collapsed",
                                value=None,
                                help="When choosing image or a button, insert a URL."
                            )
                            render_control_bar(is_disabled=not st.session_state.temp_data_widget)
                            
                            # Show the Configuration
                            if st.session_state.temp_data != []:
                                st.caption("Current card configuration here!")
                                st.write(st.session_state.temp_data)

        else:
            st.container(border=False)


apply_footer()
import streamlit as st
from utilities.util_quick import read_cache, render_control_bar
from streamlit_clickable_images import clickable_images
from utilities.util_persistent import apply_footer
from utilities.util_network import get_image_cache

# --- State Initialization ---
if "quick_cache" not in st.session_state:
    st.session_state.quick_cache = read_cache()

if "temp_data" not in st.session_state:
    st.session_state.temp_data = []

if "hide_add_button" not in st.session_state:
    st.session_state.hide_add_button = False

st.header("⚡ Quick Navigation")

# --- Top Action Bar ---
cols = st.columns(spec=[0.92, 0.08], gap="small", vertical_alignment="bottom")
cols[0].subheader(body="Home Page", width="stretch", divider="violet")

# FIX: quick_sort is now a visible page under Home, use nav_home instead of nav_hidden
if cols[1].button(label="", icon=":material/drag_pan:", width="stretch", help="Sort the quick navigation"):
    st.session_state.temp_quick_cache = st.session_state.quick_cache
    st.switch_page(st.session_state.nav_home["quick_sort"])

# --- Sidebar Configuration ---
column_amount = st.sidebar.slider(
    label="Grid Columns", min_value=1, max_value=5, value=3,
    help="Change the number of cards shown per row.",
)

# --- Dynamic Grid Rendering ---
total_cards = len(st.session_state.quick_cache)

for i in range(0, total_cards + 1, column_amount):
    grid_cols = st.columns(spec=column_amount, gap="small", vertical_alignment="top")

    for j in range(column_amount):
        current_index = i + j

        with grid_cols[j]:
            if current_index < total_cards:
                card_data = st.session_state.quick_cache[current_index]
                with st.container(border=True, height="stretch"):
                    for item in card_data:
                        widget_type  = item.get("widget")
                        widget_input = item.get("input", "")

                        if widget_type == "image":
                            img = get_image_cache(widget_input)
                            st.image(img if img else widget_input, width="stretch")

                        elif widget_type == "link button":
                            parts = widget_input.split(" | ")
                            label = parts[0]
                            url   = parts[1] if len(parts) > 1 else parts[0]
                            st.link_button(label=label, url=url, width="stretch")

                        elif widget_type == "text":
                            st.write(widget_input)

                        elif widget_type == "caption":
                            st.caption(widget_input)

                        elif widget_type == "clickable image":
                            parts      = widget_input.split(" | ")
                            img_url    = parts[0]
                            img_cached = get_image_cache(img_url)
                            if img_cached:
                                clickable_images(
                                    paths=[img_cached],
                                    titles=["Image"],
                                    div_style={"display": "flex", "justify-content": "center"},
                                    img_style={"cursor": "pointer", "width": "100%", "border-radius": "8px"},
                                )
                            else:
                                st.warning("Image failed to load.")

            elif current_index == total_cards:
                with st.container(border=True, height="stretch"):
                    if not st.session_state.hide_add_button:
                        if st.button("➕ Add Card", key="add_card_btn", width="stretch"):
                            st.session_state.hide_add_button = True
                            st.rerun()
                    else:
                        st.selectbox(
                            label="Widget Type",
                            placeholder="Choose a widget to add...",
                            index=None,
                            options=["image", "link button", "text", "caption", "clickable image"],
                            key="temp_data_widget",
                            label_visibility="collapsed"
                        )
                        st.text_input(
                            label="Widget Input",
                            placeholder="Enter widget details or URL",
                            key="temp_data_input",
                            label_visibility="collapsed",
                            help="For link buttons, use format 'Label | URL'"
                        )
                        render_control_bar(is_disabled=not st.session_state.temp_data_widget)
                        if st.session_state.temp_data:
                            st.caption("Current card configuration:")
                            st.write(st.session_state.temp_data)

apply_footer()

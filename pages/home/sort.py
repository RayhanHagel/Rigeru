import streamlit as st
from streamlit_elements import elements, mui, dashboard
from utilities.util_persistent import apply_footer
from utilities.util_network import get_image_cache
from utilities.util_quick import sync_and_save

# --- State Initialization ---
if "temp_quick_cache" not in st.session_state:
    st.session_state.temp_quick_cache = st.session_state.quick_cache

st.header("⚡ Quick Navigation")
st.subheader(body="Sort Navigation", width="stretch", divider="violet")

# --- Interactive Drag-and-Drop Grid ---
with elements("dashboard"):
    # Define layout: One column dashboard, items stacked vertically
    layout = [
        dashboard.Item(str(i), 0, i, 12, 2, isDraggable=True) 
        for i in range(len(st.session_state.temp_quick_cache))
    ]
    
    with dashboard.Grid(layout, draggableHandle=".drag-header", onLayoutChange=sync_and_save):
        for index, item_group in enumerate(st.session_state.temp_quick_cache):
            with mui.Card(key=str(index), variant="outlined", sx={"display": "flex", "flexDirection": "column"}):
                mui.CardHeader(
                    title=f"Card {index + 1}",
                    className="drag-header",
                    sx={"cursor": "grab", "background": "#1e1e1e", "color": "white", "padding": "4px 10px"}
                )

                with mui.CardContent(sx={"overflow": "auto", "flex": 1}):
                    for sub_item in item_group:
                        widget = sub_item.get('widget')
                        content = sub_item.get('input', '')
                        
                        mui.Typography(f"Type: {widget.capitalize()}", variant="caption", sx={"color": "gray"})
                        mui.Typography(
                            content, 
                            sx={"wordBreak": "break-all", "marginBottom": "10px", "display": "block", "whiteSpace": "pre-wrap"}
                        )
                        
                        # Render preview for media-based widgets
                        if widget in ["clickable image", "image"]:
                            # Handle potential "Label | URL" format for clickable images
                            url = content.split(" | ")[0] if " | " in content else content
                            image_encoded = get_image_cache(url)
                            if image_encoded:
                                mui.Box(
                                    component="img", 
                                    src=image_encoded, 
                                    sx={"display": "block", "width": "150px", "borderRadius": "4px", "marginTop": "5px", "marginBottom": "10px"}
                                )

apply_footer()
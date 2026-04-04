import streamlit as st
from streamlit_elements import elements, mui, dashboard
from utilities.util_persistent import (apply_logo, apply_footer)
from utilities.util_network import get_image_cache
from utilities.util_quick import sync_and_save




if "temp_quick_cache" not in st.session_state:
    st.session_state.temp_quick_cache = st.session_state.quick_cache


apply_logo()
st.header("⚡ Quick Navigation")
st.subheader(body="Sort Navigation", width="stretch", divider="violet")


with elements("dashboard"):
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
                        mui.Typography(f"Type: {sub_item['widget']}", variant="caption", sx={"color": "gray"})
                        mui.Typography(
                            sub_item["input"], 
                            sx={"wordBreak": "break-all", "marginBottom": "10px", "display": "block", "whiteSpace": "pre-wrap"}
                        )
                        if sub_item["widget"] == "clickable image":
                            url = sub_item["input"].split(" | ")[0]
                            image_encoded = get_image_cache(url)
                            mui.Box(
                                component="img", 
                                src=image_encoded, 
                                sx={"display": "block", "width": "150px", "borderRadius": "4px", "marginTop": "5px","marginBottom": "10px"}
                            )
                        elif sub_item["widget"] == "image":
                            image_encoded = get_image_cache(sub_item["input"])
                            mui.Box(
                                component="img", 
                                src=image_encoded, 
                                sx={"display": "block", "width": "150px", "borderRadius": "4px", "marginTop": "5px","marginBottom": "10px"}
                            )


apply_footer()
import streamlit as st
from streamlit_elements import elements, mui, dashboard
from utilities.util_manga import sync_and_save
from utilities.util_persistent import apply_logo
from utilities.util_network import get_cached_image_base64




if "temp_manga_cache" not in st.session_state:
    st.session_state.temp_manga_cache = st.session_state.manga_cache
    

apply_logo()
st.header("☄️ Manga and Manhwa")
st.subheader(body="Sort Library", width="stretch", divider="violet")


column_amount = st.sidebar.slider(
    label="Column Amount",
    min_value=1,
    max_value=10,
    value=4,
    help="Change the card amount per row",
)

height_amount = st.sidebar.slider(
    label="Card Height",
    min_value=1,
    max_value=5,
    value=2,
    help="Change the card height",
)


with elements("manga_library"):
    layout = [
        dashboard.Item(str(i), i%column_amount, height_amount*(i//column_amount), 1, height_amount, isDraggable=True) 
        for i, key in enumerate(st.session_state.temp_manga_cache.keys())
    ]
    
    with dashboard.Grid(layout, draggableHandle=".drag-header", onLayoutChange=sync_and_save, cols={'lg': column_amount, 'md': column_amount, 'sm': column_amount, 'xs': column_amount, 'xxs': column_amount}):
        for item_index, item_key in enumerate(st.session_state.temp_manga_cache):
            with mui.Card(key=item_index, variant="outlined", sx={"display": "flex", "flexDirection": "column"}):
                mui.CardHeader(
                    title=f"Card {item_index+1}",
                    className="drag-header",
                    sx={"cursor": "grab", "background": "#1e1e1e", "color": "white", "padding": "4px 10px", "& .MuiCardHeader-title": {"fontSize": "1.2rem", "fontWeight": "bold"}}
                )

                with mui.CardContent(sx={"overflow": "auto", "flex": 1}):
                    image_encoded = get_cached_image_base64(st.session_state.temp_manga_cache[item_key]["image"])
                    mui.Box(
                        component="img", 
                        src=image_encoded, 
                        sx={"display": "block", "width": "150px", "borderRadius": "4px", "marginTop": "5px","marginBottom": "10px"}
                    )
                    mui.Typography(
                        {item_key}, 
                        sx={"wordBreak": "break-all", "marginBottom": "10px", "display": "block", "whiteSpace": "pre-wrap", "fontWeight": "bold"}
                    )
                    mui.Typography(f"Chapter {st.session_state.temp_manga_cache[item_key]['chapter_read']} / {st.session_state.temp_manga_cache[item_key]['chapters_amount']}", variant="caption", sx={"color": "gray"})
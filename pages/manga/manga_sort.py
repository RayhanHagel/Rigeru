import streamlit as st
from streamlit_elements import elements, mui, dashboard
# FIX: sync_and_save for manga lives in util_manga (not util_quick)
from utilities.util_manga import sync_and_save
from utilities.util_network import get_image_cache
from utilities.util_persistent import apply_footer

# --- State Initialization ---
if "temp_manga_cache" not in st.session_state:
    st.session_state.temp_manga_cache = st.session_state.manga_cache

st.header("☄️ Manga and Manhwa")
st.subheader(body="Sort Library", width="stretch", divider="violet")

# --- Sidebar Configuration ---
column_amount = st.sidebar.slider(
    label="Column Amount",
    min_value=1,
    max_value=10,
    value=4,
    help="Change the number of cards per row",
)

height_amount = st.sidebar.slider(
    label="Card Height",
    min_value=1,
    max_value=5,
    value=2,
    help="Change the vertical height of the cards",
)

# --- Interactive Drag-and-Drop Grid ---
with elements("manga_library"):
    layout = [
        dashboard.Item(
            str(i),
            i % column_amount,
            height_amount * (i // column_amount),
            1,
            height_amount,
            isDraggable=True
        )
        for i, key in enumerate(st.session_state.temp_manga_cache.keys())
    ]

    grid_key = f"col_{column_amount}_height_{height_amount}"

    with dashboard.Grid(
        layout,
        draggableHandle=".drag-header",
        onLayoutChange=sync_and_save,
        cols={'lg': column_amount, 'md': column_amount, 'sm': column_amount, 'xs': column_amount, 'xxs': column_amount},
        key=grid_key
    ):
        for item_index, item_key in enumerate(st.session_state.temp_manga_cache):
            chapter_data = st.session_state.temp_manga_cache[item_key]

            with mui.Card(key=item_index, variant="outlined", sx={"display": "flex", "flexDirection": "column"}):
                mui.CardHeader(
                    title=f"Card {item_index + 1}",
                    className="drag-header",
                    sx={
                        "cursor": "grab",
                        "background": "#1e1e1e",
                        "color": "white",
                        "padding": "4px 10px",
                        "& .MuiCardHeader-title": {"fontSize": "1.2rem", "fontWeight": "bold"}
                    }
                )

                with mui.CardContent(sx={"overflow": "auto", "flex": 1}):
                    image_encoded = get_image_cache(url=chapter_data.get("image", ""), crop=True)

                    if image_encoded:
                        mui.Box(
                            component="img",
                            src=image_encoded,
                            sx={"display": "block", "width": "150px", "borderRadius": "4px", "marginTop": "5px", "marginBottom": "10px"}
                        )

                    mui.Typography(
                        item_key,
                        sx={"wordBreak": "break-all", "marginBottom": "10px", "display": "block", "whiteSpace": "pre-wrap", "fontWeight": "bold"}
                    )
                    mui.Typography(
                        f"Chapter {chapter_data.get('chapter_read', 0)} / {chapter_data.get('chapters_amount', 0)}",
                        variant="caption",
                        sx={"color": "gray"}
                    )

apply_footer()

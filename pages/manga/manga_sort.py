import streamlit as st
from streamlit_elements import elements, mui, dashboard
from utilities.util_manga import sync_and_save, save_config
from utilities.util_network import get_image_cache
from utilities.util_persistent import apply_footer

# --- State Initialization ---
if "temp_manga_cache" not in st.session_state:
    # Use .copy() to ensure we aren't modifying the exact same object reference prematurely
    st.session_state.temp_manga_cache = st.session_state.manga_cache.copy()

st.header("☄️ Manga and Manhwa")

# --- Header & Navigation ---
hcols = st.columns([0.78, 0.11, 0.11], gap="small", vertical_alignment="bottom")
hcols[0].subheader(body="Sort Library", width="stretch", divider="violet")

if hcols[1].button("", icon=":material/arrow_back:", width="stretch", help="Back to Library"):
    st.switch_page(st.session_state.nav_manga["manga_library"])
    
if hcols[2].button("", icon=":material/save:", width="stretch", help="Save changes"):
    # Ensure the main cache is up-to-date with any deletions, then write to disk
    st.session_state.manga_cache = st.session_state.temp_manga_cache.copy()
    save_config(replace_data=True)
    st.success("Library saved!", icon="✅")

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

cache = st.session_state.temp_manga_cache

if not cache:
    st.info("No manga to sort. Add some to your library first.", icon="📋")
else:
    # ── Native Deletion Manager ───────────────────────────────────────────────
    del_cols = st.columns([0.8, 0.2], gap="small", vertical_alignment="bottom")
    
    selected_to_delete = del_cols[0].multiselect(
        "🗑️ Remove Manga",
        options=list(cache.keys()),
        placeholder="Select manga to delete...",
        help="Choose one or more manga to permanently remove."
    )
    
    if del_cols[1].button("Delete Selected", type="primary", width="stretch", disabled=not selected_to_delete):
        for manga_title in selected_to_delete:
            if manga_title in st.session_state.temp_manga_cache:
                del st.session_state.temp_manga_cache[manga_title]
            if manga_title in st.session_state.manga_cache:
                del st.session_state.manga_cache[manga_title]
                
        # Automatically save after deletion
        save_config(replace_data=True)
        st.rerun()

    st.caption("Drag cards by their header text to reorder. Hit 💾 to save.")

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
            for i, key in enumerate(cache.keys())
        ]

        grid_key = f"col_{column_amount}_height_{height_amount}"

        with dashboard.Grid(
            layout,
            draggableHandle=".drag-header",
            onLayoutChange=sync_and_save,
            cols={'lg': column_amount, 'md': column_amount, 'sm': column_amount, 'xs': column_amount, 'xxs': column_amount},
            key=grid_key
        ):
            for item_index, item_key in enumerate(cache.keys()):
                chapter_data = cache[item_key]

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
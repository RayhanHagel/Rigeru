import streamlit as st
from streamlit_elements import elements, mui, dashboard
from utilities.util_persistent import apply_footer, THEMES
from utilities.util_network import get_image_cache
from utilities.util_quick import write_cache, sync_and_save

# --- Fetch Current Theme ---
current_theme_name = st.session_state.get("selected_theme", "Nebula (Default)")
theme = THEMES.get(current_theme_name, THEMES["Nebula (Default)"])

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
.drag-header { cursor: grab !important; user-select: none; }
.drag-header:active { cursor: grabbing !important; }
</style>
""", unsafe_allow_html=True)

# ── State ─────────────────────────────────────────────────────────────────────
if "temp_quick_cache" not in st.session_state:
    st.session_state.temp_quick_cache = st.session_state.get("quick_cache", [])

# ── Header ────────────────────────────────────────────────────────────────────
st.header("⚡ Quick Navigation")

hcols = st.columns([0.78, 0.11, 0.11], gap="small", vertical_alignment="bottom")
hcols[0].subheader(body="Sort & Manage Cards", width="stretch", divider="violet")
if hcols[1].button("", icon=":material/home:", width="stretch", help="Back to home"):
    st.switch_page(st.session_state.nav_home["quick_home"])
if hcols[2].button("", icon=":material/save:", width="stretch", help="Save current order"):
    write_cache(replace_data=st.session_state.temp_quick_cache)
    st.success("Order saved!", icon="✅")

cache = st.session_state.temp_quick_cache

if not cache:
    st.info("No cards to sort. Add some from the home page first.", icon="📋")
else:
    # ── Native Deletion Manager ───────────────────────────────────────────────
    # A sleek, native way to delete cards without relying on React callbacks
    del_cols = st.columns([0.8, 0.2], gap="small", vertical_alignment="bottom")
    
    # Build readable labels for the dropdown so you know exactly what you are deleting
    card_labels = []
    for i, item_group in enumerate(cache):
        first_item = item_group[0] if item_group else {}
        preview = first_item.get("input", "")[:40].replace("\n", " ")
        wtype = first_item.get("widget", "Empty").upper()
        card_labels.append(f"Card {i + 1}  |  [{wtype}]  {preview}")
        
    selected_to_delete = del_cols[0].multiselect(
        "🗑️ Remove Cards",
        options=range(len(cache)),
        format_func=lambda x: card_labels[x],
        placeholder="Select cards to delete...",
        help="Choose one or more cards to permanently remove."
    )
    
    if del_cols[1].button("Delete Selected", type="primary", use_container_width=True, disabled=not selected_to_delete):
        new_cache = [c for i, c in enumerate(cache) if i not in selected_to_delete]
        write_cache(replace_data=new_cache)
        st.session_state.temp_quick_cache = new_cache
        st.session_state.quick_cache = new_cache
        st.rerun()

    st.caption("Drag cards by their header text to reorder. Hit 💾 to save.")

    # ── Drag-and-drop reorder grid ────────────────────────────────────────────
    with elements("dashboard"):
        layout = [
            dashboard.Item(str(i), 0, i, 12, 2, isDraggable=True, isResizable=False)
            for i in range(len(cache))
        ]

        with dashboard.Grid(layout, draggableHandle=".drag-header", onLayoutChange=sync_and_save):
            for index, item_group in enumerate(cache):
                with mui.Card(
                    key=str(index),
                    variant="outlined",
                    sx={
                        "display": "flex",
                        "flexDirection": "column",
                        "borderLeft": f"3px solid {theme['HEADING']}",
                        "background": theme['UI_BG'],
                        "borderColor": theme['UI_BORDER'],
                    }
                ):
                    # ── Card Header (Drag Zone Only) ──
                    with mui.Box(
                        className="drag-header",
                        sx={
                            "display": "flex",
                            "alignItems": "center",
                            "background": theme['HEADER_BG'],
                            "padding": "8px 12px",
                            "borderBottom": f"1px solid {theme['UI_BORDER']}"
                        }
                    ):
                        mui.Typography(
                            f"⠿  Card {index + 1}",
                            variant="subtitle2",
                            sx={"fontFamily": "monospace", "color": theme['HEADING'], "letterSpacing": "0.05em"}
                        )

                    # ── Card Content ──────────────────────────────────────────
                    with mui.CardContent(sx={"overflow": "auto", "flex": 1, "padding": "8px 12px"}):
                        for sub_item in item_group:
                            widget  = sub_item.get("widget", "")
                            content = sub_item.get("input", "")

                            mui.Box(
                                mui.Typography(widget.upper(), variant="caption",
                                               sx={"color": theme['HEADING'], "fontFamily": "monospace",
                                                   "fontSize": "0.65rem", "letterSpacing": "0.1em"}),
                                sx={"display": "inline-block", "background": theme['BG'],
                                    "border": f"1px solid {theme['UI_BORDER']}",
                                    "borderRadius": "4px", "padding": "1px 6px", "marginBottom": "2px"}
                            )

                            mui.Typography(
                                content,
                                variant="body2",
                                sx={
                                    "wordBreak": "break-all",
                                    "marginBottom": "8px",
                                    "display": "block",
                                    "whiteSpace": "pre-wrap",
                                    "color": theme['TEXT'],
                                    "fontSize": "0.8rem",
                                }
                            )

                            if widget in ("clickable image", "image"):
                                url     = content.split(" | ")[0] if " | " in content else content
                                encoded = get_image_cache(url)
                                if encoded:
                                    mui.Box(
                                        component="img",
                                        src=encoded,
                                        sx={
                                            "display": "block",
                                            "width": "120px",
                                            "borderRadius": "6px",
                                            "marginTop": "4px",
                                            "marginBottom": "8px",
                                            "border": f"1px solid {theme['UI_BORDER']}",
                                        }
                                    )

apply_footer()
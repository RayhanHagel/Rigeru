import streamlit as st
from utilities.util_quick import read_cache, write_cache
from utilities.util_network import get_image_cache

WIDGET_OPTIONS = ["link button", "image", "clickable image", "text", "caption", "internal page"]

NAV_SOURCES = [
    ("nav_dashboard",   "🏠"),
    ("nav_manga",       "📺"),
    ("nav_media_feeds", "📺"),
    ("nav_web_feeds",   "🌐"),
    ("nav_file_mgmt",   "🗂️"),
    ("nav_metadata",    "📝"),
    ("nav_media_proc",  "🎨"),
    ("nav_system",      "⚙️"),
    ("nav_vision",      "🔬"),
    ("nav_data_mgmt",   "🗂️"),
]

def build_internal_pages() -> dict:
    SKIP_KEYS = {"quick_home", "quick_sort"}
    pages = {}
    for nav_key, _ in NAV_SOURCES:
        nav_dict = st.session_state.get(nav_key, {})
        for key_name, path in nav_dict.items():
            if key_name in SKIP_KEYS: 
                continue
            label = key_name.replace("_", " ").title()
            pages[label] = (key_name, nav_key)
    return pages

# EXECUTED ONCE GLOBALLY to prevent UI bloat/delays
INTERNAL_PAGES = build_internal_pages()

# OPTIMIZED: Deferred cache loading - quick_cache is now loaded directly here instead of blocking main.py
if "quick_cache" not in st.session_state:
    st.session_state.quick_cache = read_cache()
if "temp_data" not in st.session_state:
    st.session_state.temp_data = []
if "show_add_panel" not in st.session_state:
    st.session_state.show_add_panel = False
if "new_card_widgets" not in st.session_state:
    st.session_state.new_card_widgets = []


# ── Header ────────────────────────────────────────────────────────────────────
st.header("⚡ Quick Navigation")

hcols = st.columns([0.78, 0.11, 0.11], gap="small", vertical_alignment="bottom")
hcols[0].subheader(body="Home Page", width="stretch", divider="violet")
if hcols[1].button("", icon=":material/drag_pan:", width="stretch", help="Sort / reorder cards"):
    st.session_state.temp_quick_cache = st.session_state.quick_cache
    st.switch_page(st.session_state.nav_hidden["quick_sort"])
if hcols[2].button("", icon=":material/add_box:", width="stretch", help="Add a new card"):
    st.session_state.show_add_panel = not st.session_state.show_add_panel
    st.session_state.new_card_widgets = []

# ── Sidebar ───────────────────────────────────────────────────────────────────
column_amount = st.sidebar.slider("Grid Columns", min_value=1, max_value=5, value=3,
                                  help="Cards shown per row")
card_height = st.sidebar.slider("Card Height (px)", min_value=100, max_value=600, value=250, step=25,
                                help="Fixed height for every card — keeps the grid uniform")

# ── Add-Card Panel ────────────────────────────────────────────────────────────
if st.session_state.show_add_panel:
    INTERNAL_PAGES = build_internal_pages()

    with st.container(border=True):
        st.markdown('<div class="add-panel-label">✦ New Card Builder</div>', unsafe_allow_html=True)

        # Staged widget list preview
        if st.session_state.new_card_widgets:
            with st.expander(f"📋 {len(st.session_state.new_card_widgets)} widget(s) staged — click to review", expanded=False):
                for idx, w in enumerate(st.session_state.new_card_widgets):
                    c1, c2 = st.columns([0.88, 0.12])
                    wtype  = w["widget"]
                    winput = w["input"]
                    if wtype == "link button":
                        parts = winput.split(" | ")
                        desc  = f'**{parts[0]}** → `{parts[1]}`' if len(parts) == 2 else winput
                    elif wtype == "clickable image":
                        parts = winput.split(" | ")
                        desc  = f'Image: `{parts[0]}`  ↗ `{parts[1]}`' if len(parts) == 2 else winput
                    else:
                        desc = winput
                    c1.markdown(f'<span class="preview-badge">{wtype}</span>&nbsp; {desc}', unsafe_allow_html=True)
                    if c2.button("", icon=":material/remove_circle_outline:", key=f"rem_staged_{idx}", help="Remove"):
                        st.session_state.new_card_widgets.pop(idx)
                        st.rerun()

        # Widget type selector
        widget_type = st.selectbox(
            "Widget type", options=WIDGET_OPTIONS, index=None,
            placeholder="Pick a widget type…", label_visibility="collapsed",
            key="panel_widget_type"
        )

        # ── Per-type rich forms ───────────────────────────────────────────────
        widget_input = ""

        if widget_type == "link button":
            st.markdown('<div class="add-panel-label">🔗 Link Button</div>', unsafe_allow_html=True)
            fcols = st.columns(2, gap="small")
            lbl = fcols[0].text_input("Button label", placeholder="e.g. Open GitHub", key="panel_lbl")
            url = fcols[1].text_input("Destination URL", placeholder="https://…", key="panel_url")
            widget_input = f"{lbl} | {url}" if (lbl or url) else ""
            if lbl or url:
                st.markdown('<div class="add-panel-label">Preview</div>', unsafe_allow_html=True)
                with st.container(border=True):
                    preview_label = lbl or "Button"
                    preview_url   = url  or "#"
                    st.link_button(label=preview_label, url=preview_url, width="stretch")
                    st.caption(f"↗ Opens: `{url}`" if url else "↗ No URL set yet")

        elif widget_type == "clickable image":
            st.markdown('<div class="add-panel-label">🖼️ Clickable Image</div>', unsafe_allow_html=True)
            img_url  = st.text_input("Image URL (what to display)", placeholder="https://…/image.jpg",
                                     key="panel_img_url",
                                     help="The image shown on the card")
            link_url = st.text_input("Click destination URL (where to go)", placeholder="https://…",
                                     key="panel_img_link",
                                     help="The page that opens when the user clicks the image")
            widget_input = f"{img_url} | {link_url}" if (img_url or link_url) else ""

            if img_url or link_url:
                st.markdown('<div class="add-panel-label">Preview</div>', unsafe_allow_html=True)
                pcols = st.columns([0.55, 0.45], gap="medium")
                with pcols[0]:
                    st.markdown('<div class="add-panel-label">Image displayed</div>', unsafe_allow_html=True)
                    if img_url:
                        cached = get_image_cache(img_url)
                        if cached:
                            st.image(cached, width="stretch")
                        else:
                            st.warning("Could not load image from that URL.", icon="⚠️")
                    else:
                        st.markdown(
                            '<div style="height:80px;border:1px dashed #7c3aed44;border-radius:6px;'
                            'display:flex;align-items:center;justify-content:center;'
                            'color:#6b7280;font-size:0.75rem;">No image URL yet</div>',
                            unsafe_allow_html=True
                        )
                with pcols[1]:
                    st.markdown('<div class="add-panel-label">On click → opens</div>', unsafe_allow_html=True)
                    if link_url:
                        st.markdown(
                            f'<div style="background:#1e1030;border:1px solid #7c3aed44;border-radius:8px;'
                            f'padding:10px 12px;font-family:monospace;font-size:0.78rem;color:#a78bfa;'
                            f'word-break:break-all;margin-top:4px;">↗ {link_url}</div>',
                            unsafe_allow_html=True
                        )
                    else:
                        st.caption("No destination URL set yet")

        elif widget_type == "image":
            st.markdown('<div class="add-panel-label">🖼️ Static Image</div>', unsafe_allow_html=True)
            img_url = st.text_input("Image URL", placeholder="https://…/image.jpg", key="panel_input")
            widget_input = img_url or ""
            if img_url:
                st.markdown('<div class="add-panel-label">Preview</div>', unsafe_allow_html=True)
                cached = get_image_cache(img_url)
                if cached:
                    st.image(cached, width="stretch")
                else:
                    st.warning("Could not load image from that URL.", icon="⚠️")

        elif widget_type == "internal page":
            st.markdown('<div class="add-panel-label">📌 Internal Page Link</div>', unsafe_allow_html=True)
            page_choice = st.selectbox(
                "Page", options=list(INTERNAL_PAGES.keys()), index=None,
                placeholder="Choose a page…", label_visibility="collapsed",
                key="panel_page_choice"
            )
            widget_input = page_choice or ""
            if page_choice:
                st.markdown('<div class="add-panel-label">Preview</div>', unsafe_allow_html=True)
                with st.container(border=True):
                    st.button(page_choice, width="stretch", disabled=True)
                    st.caption("Will navigate to this page when clicked")

        elif widget_type == "text":
            st.markdown('<div class="add-panel-label">📝 Text</div>', unsafe_allow_html=True)
            widget_input = st.text_area("Text content", placeholder="Enter text…",
                                        label_visibility="collapsed", key="panel_input", height=80)

        elif widget_type == "caption":
            st.markdown('<div class="add-panel-label">💬 Caption</div>', unsafe_allow_html=True)
            widget_input = st.text_input("Caption text", placeholder="Small descriptive text…",
                                         label_visibility="collapsed", key="panel_input")
            if widget_input:
                st.caption(f"Preview: {widget_input}")

        # Action buttons
        acols = st.columns(3, gap="small")
        can_add = bool(widget_type and widget_input.strip())

        if acols[0].button("＋ Add widget", disabled=not can_add, width="stretch", type="secondary"):
            st.session_state.new_card_widgets.append({"widget": widget_type, "input": widget_input.strip()})
            
            # Removed "panel_widget_type" so the builder remembers the last selected widget type
            for k in ("panel_input", "panel_lbl", "panel_url",
                      "panel_page_choice", "panel_img_url", "panel_img_link"):
                if k in st.session_state:
                    del st.session_state[k]
            st.rerun()

        can_save = len(st.session_state.new_card_widgets) > 0
        if acols[1].button("💾 Save card", disabled=not can_save, width="stretch", type="primary"):
            new_cache = st.session_state.quick_cache + [st.session_state.new_card_widgets]
            write_cache(replace_data=new_cache)
            st.session_state.new_card_widgets = []
            st.session_state.show_add_panel = False
            
            # Make sure we clean up the widget type ONLY when completely saving the card
            if "panel_widget_type" in st.session_state:
                del st.session_state["panel_widget_type"]
            st.rerun()

        if acols[2].button("✕ Cancel", width="stretch"):
            st.session_state.show_add_panel = False
            st.session_state.new_card_widgets = []
            if "panel_widget_type" in st.session_state:
                del st.session_state["panel_widget_type"]
            st.rerun()

    st.divider()

# ── Grid Rendering with Limits ────────────────────────────────────────────────
total_cards = len(st.session_state.quick_cache)
CARDS_PER_PAGE = 12
total_pages = max(1, (total_cards + CARDS_PER_PAGE - 1) // CARDS_PER_PAGE)

# UI Paginator Block
page_col, _ = st.columns([1, 4])
current_page = page_col.number_input("Page", min_value=1, max_value=total_pages, value=1)

start_idx = (current_page - 1) * CARDS_PER_PAGE
end_idx = min(start_idx + CARDS_PER_PAGE, total_cards)
slice_cards = st.session_state.quick_cache[start_idx:end_idx]

# Bounded Pagination Loop
for i in range(0, len(slice_cards), column_amount):
    grid_cols = st.columns(spec=column_amount, gap="small", vertical_alignment="top")

    for j in range(column_amount):
        if i + j >= len(slice_cards):
            break

        card_data = slice_cards[i + j]
        idx = start_idx + i + j 
        
        with grid_cols[j]:
            with st.container(border=True, height=card_height):
                for sub_idx, item in enumerate(card_data):
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
                        parts    = widget_input.split(" | ")
                        img_url  = parts[0].strip()
                        dest_url = parts[1].strip() if len(parts) > 1 else ""
                        cached   = get_image_cache(img_url)
                        src      = cached if cached else img_url
                        if dest_url:
                            st.markdown(
                                f'<a href="{dest_url}" target="_blank" rel="noopener noreferrer">'
                                f'<img src="{src}" style="width:100%;border-radius:8px;cursor:pointer;" />'
                                f'</a>',
                                unsafe_allow_html=True,
                            )
                        else:
                            st.image(src, width="stretch")

                    elif widget_type == "internal page":
                        if widget_input in INTERNAL_PAGES:
                            key_name, nav_key = INTERNAL_PAGES[widget_input]
                            nav_dict  = st.session_state.get(nav_key, {})
                            page_path = nav_dict.get(key_name)
                            if page_path and st.button(widget_input, width="stretch", key=f"nav_{idx}_{sub_idx}_{key_name}"):
                                st.switch_page(page_path)
                        else:
                            st.caption(f"⚠️ Page not found: {widget_input}")
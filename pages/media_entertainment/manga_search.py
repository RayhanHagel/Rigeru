import streamlit as st
from streamlit_searchbox import st_searchbox
from utilities.util_manga import save_config, search_titles, asura_get_chapter, mangadex_get_chapter

from utilities.util_network import get_image_cache
from utilities.util_persistent import THEMES


# --- Fetch Current Theme ---
current_theme_name = st.session_state.get("selected_theme", "Nebula (Default)")
theme = THEMES.get(current_theme_name, THEMES["Nebula (Default)"])


# --- State Initialization ---
if "search_lookup" not in st.session_state:
    st.session_state.search_lookup = {}


# --- Source Selection ---
st.header("☄️ Manga and Manhwa")
st.subheader("Select Source")
st.caption("Choosing multiple sources could lead to longer search results.")

website_options = {
    "🌑 AsuraScans": "asurascans.com/",
    "😺 MangaDex": "mangadex.org/"
}
# Using collapsed label for a cleaner UI
selected_website_options = st.pills(
    label="Sources", 
    options=website_options.keys(), 
    selection_mode="multi", 
    label_visibility="collapsed"
)

# --- Search Interface ---
custom_searchbox_theme = {
    "dropdown": {
        "fill": theme['TEXT']
    },
    "clear": {
        "strokeHover": theme['HEADING'],
        "fillHover": theme['HEADING']
    },
    "searchbox": {
        "control": {
            "backgroundColor": theme['UI_BG'],
            "border": f"1px solid {theme['UI_BORDER']}", 
            "boxShadow": "none",
            
            # THE FIX: Add breathing room so the iframe doesn't clip the bottom edge
            "marginBottom": "2px", 
            
            "&:hover": {
                "border": f"1px solid {theme['HEADING']}"
            },
            "&:focus-within": {
                "border": f"1px solid {theme['HEADING']}",
                
                # THE FIX: Draw the focus glow INWARD so it stays inside the boundary
                "boxShadow": f"inset 0 0 0 1px {theme['HEADING']}" 
            }
        },
        # We MUST style menuList instead of menu because styling.tsx ignores 'menu'
        "menuList": {
            "backgroundColor": theme['BG'],
            "border": f"1px solid {theme['UI_BORDER']}",
            "borderRadius": "6px",
            "padding": "0px"
        },
        "option": {
            "color": theme['TEXT'],
            "backgroundColor": "transparent",
            "highlightColor": theme['HEADING'] 
        },
        "singleValue": {
            "color": theme['TEXT'],
        },
        "input": {
            "color": theme['TEXT'],
        },
        "placeholder": {
            "color": theme['TEXT'],
        }
    }
}

if selected_website_options:
    st.subheader("Search Title")
    chapter_title = st_searchbox(
        search_function=lambda search_term: search_titles(
            websites=selected_website_options, 
            title=search_term
        ),
        placeholder="Type manga title here...",
        key="file_search",
        debounce=300,
        style_overrides=custom_searchbox_theme
    )

    # --- Results Rendering ---
    if chapter_title:
        chapter_url = st.session_state.search_lookup.get(chapter_title)
        
        # Safely extract the actual title (removing any prepended source icons/labels)
        clean_title = chapter_title.split(" ", 1)[-1] if " " in chapter_title else chapter_title
        
        # Determine the source website from the URL
        matches = [value for _, value in website_options.items() if value in str(chapter_url)]
        if not matches:
            st.toast(":red[Could not determine source website]", duration="infinite", icon=":material/apps_outage:")
            st.stop()
            
        website = matches[0]
        
        # Fetch Chapter Metadata
        with st.spinner(f"Fetching details for {clean_title}..."):
            chapter_json = None
            if website == "asurascans.com/":
                chapter_json = asura_get_chapter(chapter_url=chapter_url, website=website)
            elif website == "mangadex.org/":
                chapter_json = mangadex_get_chapter(chapter_url=chapter_url, website=website)
        
        # Render the Result Card
        if chapter_json is None:
            st.toast(f":red[Failed to get information on {clean_title}]", duration="infinite", icon=":material/apps_outage:")
        else:
            chapter_json["chapter_read"] = 0
            
            with st.container(border=True):
                col1, col2 = st.columns([1, 2])
                
                with col1:
                    if website == "asurascans.com/":
                        image = get_image_cache(url=chapter_json.get("image", ""), crop=True)
                    else:
                        image = get_image_cache(url=chapter_json.get("image", ""), crop=True, headers={"User-Agent": "MangaApp/1.0"}, use_default_headers=False)
                    
                    st.image(image=image if image else chapter_json.get("image"), width="stretch")
                
                with col2:
                    st.markdown(f"### {clean_title}")
                    st.markdown(
                        f":violet-badge[:material/edit_document: {chapter_json.get('status', 'Unknown')}]  \n"
                        f":violet-badge[:material/menu_book: {chapter_json.get('type', 'Unknown')}]  \n"
                        f":violet-badge[:material/kid_star: Rating {chapter_json.get('rating', 'N/A')}]  \n"
                        f":violet-badge[:material/bookmark: Chapters: {chapter_json.get('chapters_amount', 0)}]"
                    )
                    
                    st.write("") # Spacer
                    
                    btn_col1, btn_col2 = st.columns(2)
                    btn_col1.link_button(label="Go to page", url=chapter_url, icon=":material/open_in_new:", width="stretch")
                    
                    # Instead of using args in on_click (which can trigger weird state reloads), we use a direct action block
                    if btn_col2.button(label="Add to Library", icon=":material/bookmark_add:", width="stretch"):
                        save_config(key=clean_title, value=chapter_json)
                        st.toast(f":green[Successfully saved {clean_title} to library!]", duration="short", icon=":material/bookmark_add:")


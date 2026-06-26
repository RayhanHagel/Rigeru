import streamlit as st
import time
from utilities.util_malsync import (
    load_anime_list, 
    update_progress, 
    remove_from_library, 
    load_manga_list,
    update_manga_progress,
    remove_from_manga_library,
    generate_auth_url,
    exchange_code_for_token,
    get_valid_token,
    sync_user_list_from_mal,
    load_credentials,
    save_credentials
)
from utilities.util_network import get_image_cache


# ─────────────────────────────────────────────
# AUTHENTICATION INTERCEPTOR
# ─────────────────────────────────────────────
params = st.query_params if hasattr(st, "query_params") else st.experimental_get_query_params()

if "code" in params:
    auth_code = params["code"][0] if isinstance(params.get("code"), list) else params["code"]
    st.info("Detected MyAnimeList authorization code! Finalizing connection...", icon=":material/sync:")
    
    with st.spinner("Exchanging code for access token..."):
        success, msg = exchange_code_for_token(auth_code)
        
        if hasattr(st, "query_params"):
            st.query_params.clear()
        else:
            st.experimental_set_query_params()
            
        if success:
            st.success("Successfully linked MyAnimeList account!", icon=":material/check_circle:")
            time.sleep(2) 
            st.rerun()
        else:
            st.error(f"Failed to authenticate: {msg}", icon=":material/error:")
            st.stop()

# ─────────────────────────────────────────────
# SIDEBAR CONTROLS
# ─────────────────────────────────────────────
with st.sidebar:
    st.subheader(":material/tune: Display Options")
    
    # Toggle between Anime and Manga views
    media_type = st.radio("Media Type", ["Anime", "Manga"], horizontal=True)
    st.divider()
    
    search_query = st.text_input("Search Title", placeholder="e.g., Frieren...", icon=":material/search:")
    
    cards_per_row = st.slider("Cards per row", min_value=2, max_value=8, value=4)
    
    # Dynamically update the filter tags based on the selected media type
    active_status_label = "Watching" if media_type == "Anime" else "Reading"
    plan_status_label = "Plan to Watch" if media_type == "Anime" else "Plan to Read"
    
    filter_status = st.selectbox(
        "Filter Status", 
        ["All Titles", active_status_label, "Completed", "On Hold", "Dropped", plan_status_label]
    )
    sort_by = st.selectbox("Sort By", ["Title (A-Z)", "Title (Z-A)", "Progress (High to Low)", "Progress (Low to High)"])

# ─────────────────────────────────────────────
# MAIN UI
# ─────────────────────────────────────────────
st.header(":material/collections_bookmark: Local MAL Tracker")
st.markdown("Track your watching and reading progress locally and sync directly with your MAL account.")

tab_library, tab_sync, tab_settings = st.tabs([
    ":material/library_books: My Library", 
    ":material/sync: Sync with MAL", 
    ":material/settings: Settings"
])

# ─────────────────────────────────────────────
# TAB 1 — Personal Library
# ─────────────────────────────────────────────
with tab_library:
    # Load the correct library based on the sidebar toggle
    library = load_anime_list() if media_type == "Anime" else load_manga_list()
    
    if not library:
        st.info(f"Your {media_type} library is empty. Go to the Sync tab to pull your data!", icon=":material/info:")
    else:
        lib_items = list(library.items())
        
        if search_query:
            lib_items = [item for item in lib_items if search_query.lower() in item[1].get("title", "").lower()]
        
        if filter_status != "All Titles":
            lib_items = [item for item in lib_items if item[1].get("status") == filter_status]
            
        # Standardize the sort key depending on anime/manga
        prog_key = "episodes_watched" if media_type == "Anime" else "chapters_read"
        
        if sort_by == "Title (A-Z)":
            lib_items.sort(key=lambda x: x[1].get("title", "").lower())
        elif sort_by == "Title (Z-A)":
            lib_items.sort(key=lambda x: x[1].get("title", "").lower(), reverse=True)
        elif sort_by == "Progress (High to Low)":
            lib_items.sort(key=lambda x: x[1].get(prog_key, 0), reverse=True)
        elif sort_by == "Progress (Low to High)":
            lib_items.sort(key=lambda x: x[1].get(prog_key, 0))

        if not lib_items:
            st.warning("No titles found matching your search or filter criteria.", icon=":material/filter_list_off:")
        else:
            cols = st.columns(cards_per_row)
            
            for idx, (mal_id, data) in enumerate(lib_items):
                with cols[idx % cards_per_row]:
                    with st.container(border=True, height=550):
                        
                        raw_img_path = get_image_cache(data["image_url"], crop=True, crop_size=(400, 600))
                        
                        if raw_img_path and raw_img_path.startswith("/app/"):
                            display_img = raw_img_path.replace("/app/", "")
                        else:
                            display_img = raw_img_path or data["image_url"]
                            
                        st.image(display_img, width="stretch")
                        
                        title = data['title']
                        display_title = title if len(title) <= 45 else title[:42] + "..."
                        st.markdown(f"**[{display_title}]({data['url']})**", help=title)
                        
                        status = data.get("status", "Unknown")
                        if status == "Completed":
                            pill_color = "#198754" 
                        elif status == "Dropped":
                            pill_color = "#dc3545" 
                        elif status == "On Hold":
                            pill_color = "#ffc107"
                        elif status in ["Plan to Watch", "Plan to Read"]:
                            pill_color = "#6c757d"
                        else:
                            pill_color = "#0d6efd" 
                            
                        st.markdown(
                            f'<div style="background-color: {pill_color}; color: white; padding: 2px 10px; '
                            f'border-radius: 12px; display: inline-block; font-size: 0.8em; margin-bottom: 8px;">'
                            f'<b>{status}</b></div>', 
                            unsafe_allow_html=True
                        )
                        
                        # Dynamically handle Anime vs Manga tracking logic
                        if media_type == "Anime":
                            current_prog = data.get('episodes_watched', 0)
                            total_prog = data.get('episodes_total', 0)
                            prog_label = "Ep"
                            update_fn = update_progress
                            remove_fn = remove_from_library
                        else:
                            current_prog = data.get('chapters_read', 0)
                            total_prog = data.get('chapters_total', 0)
                            prog_label = "Ch"
                            update_fn = update_manga_progress
                            remove_fn = remove_from_manga_library
                        
                        total_str = str(total_prog) if total_prog > 0 else "?"
                        st.markdown(f"**Progress:** {current_prog} / {total_str} {prog_label}")
                        
                        c_minus, c_plus, c_del = st.columns([1, 1, 1])
                        if c_minus.button(" ", icon=":material/remove:", key=f"minus_{mal_id}", use_container_width=True, help="Decrease"):
                            update_fn(mal_id, current_prog - 1)
                            st.rerun()
                            
                        if c_plus.button(" ", icon=":material/add:", key=f"plus_{mal_id}", use_container_width=True, help="Increase"):
                            update_fn(mal_id, current_prog + 1)
                            st.rerun()
                            
                        if c_del.button(" ", icon=":material/delete:", key=f"del_{mal_id}", use_container_width=True, type="primary", help="Remove"):
                            remove_fn(mal_id)
                            st.rerun()

# ─────────────────────────────────────────────
# TAB 2 — Sync via OAuth
# ─────────────────────────────────────────────
with tab_sync:
    creds = load_credentials()
    if not creds.get("client_id"):
        st.warning("Please configure your MyAnimeList Client ID in the **Settings** tab first.", icon=":material/warning:")
    else:
        is_logged_in = get_valid_token() is not None
        
        if not is_logged_in:
            st.warning("You are not connected to MyAnimeList.", icon=":material/link_off:")
            auth_url = generate_auth_url()
            if auth_url:
                st.link_button("Login with MyAnimeList", auth_url, type="primary", icon=":material/lock:", use_container_width=True)
            
        else:
            st.success("Linked to MyAnimeList via OAuth2.", icon=":material/link:")
            st.markdown("Pull your latest Anime and Manga lists directly from your account.")
            
            if st.button("Sync Data from MAL", type="primary", icon=":material/cloud_download:", use_container_width=True):
                with st.spinner("Fetching official lists..."):
                    success, msg = sync_user_list_from_mal()
                    if success:
                        st.toast(msg, icon=":material/sync_saved_locally:")
                        st.rerun()
                    else:
                        st.error(msg, icon=":material/error:")

# ─────────────────────────────────────────────
# TAB 3 — Settings & Configuration (Remains Unchanged)
# ─────────────────────────────────────────────
with tab_settings:
    st.subheader("API Configuration")
    st.markdown("""
    To connect to MyAnimeList, you need an API Client.
    1. Go to [MAL API Settings](https://myanimelist.net/apiconfig)
    2. Create a New Client (App Type: Web)
    3. Set Redirect URL to `http://localhost:8501/malsync`
    """)
    
    with st.container(border=True):
        current_creds = load_credentials()
        new_client_id = st.text_input("Client ID", value=current_creds.get("client_id", ""), type="password")
        new_client_secret = st.text_input("Client Secret (Optional for some apps)", value=current_creds.get("client_secret", ""), type="password")
        
        if st.button("Save Credentials", type="primary", icon=":material/save:", use_container_width=True):
            if new_client_id.strip():
                save_credentials(new_client_id.strip(), new_client_secret.strip())
                st.success("Credentials saved successfully!", icon=":material/check_circle:")
                st.rerun()
            else:
                st.error("Client ID is required.", icon=":material/error:")
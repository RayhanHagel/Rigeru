import streamlit as st
from utilities.util_malsync import load_anime_list, search_mal, add_to_library, update_progress, remove_from_library, import_user_list
from utilities.util_persistent import apply_footer

st.header("⛩️ Local MAL Tracker")
st.markdown("Search MyAnimeList and track your watching progress locally.")

tab_library, tab_search, tab_import = st.tabs(["📚 My Watch List", "🔍 Search & Add Anime", "⬇️ Import Profile"])

# ─────────────────────────────────────────────
# TAB 1 — Personal Library
# ─────────────────────────────────────────────
with tab_library:
    library = load_anime_list()
    
    if not library:
        st.info("Your library is empty. Go to the Search tab to add some Anime!")
    else:
        cols = st.columns(3)
        col_idx = 0
        
        for mal_id, data in library.items():
            with cols[col_idx % 3]:
                with st.container(border=True):
                    # FIX: Replaced invalid width parameter
                    st.image(data["image_url"], width="stretch")
                    st.markdown(f"**[{data['title']}]({data['url']})**")
                    
                    if data["status"] == "Completed":
                        st.success("Completed", icon="✅")
                    else:
                        st.info("Watching", icon="▶️")
                    
                    total_str = str(data['episodes_total']) if data['episodes_total'] > 0 else "?"
                    st.markdown(f"**Progress:** {data['episodes_watched']} / {total_str}")
                    
                    c_minus, c_plus, c_del = st.columns([1, 1, 1])
                    
                    if c_minus.button("➖", key=f"minus_{mal_id}", width="stretch"):
                        update_progress(mal_id, data['episodes_watched'] - 1)
                        st.rerun()
                        
                    if c_plus.button("➕", key=f"plus_{mal_id}", width="stretch"):
                        update_progress(mal_id, data['episodes_watched'] + 1)
                        st.rerun()
                        
                    if c_del.button("🗑️", key=f"del_{mal_id}", width="stretch", type="primary"):
                        remove_from_library(mal_id)
                        st.rerun()
                        
            col_idx += 1

# ─────────────────────────────────────────────
# TAB 2 — Search MyAnimeList
# ─────────────────────────────────────────────
with tab_search:
    search_query = st.text_input("Search Anime Title", placeholder="e.g., Frieren, Jujutsu Kaisen...")
    
    if st.button("Search MAL", type="primary", width="stretch"):
        if not search_query:
            st.warning("Please enter an anime name.")
        else:
            with st.spinner("Querying MyAnimeList database..."):
                success, results = search_mal(search_query)
                
                if success:
                    if not results:
                        st.info("No anime found matching that title.")
                    else:
                        for anime in results:
                            with st.container(border=True):
                                col_img, col_info, col_btn = st.columns([1, 4, 1], vertical_alignment="center")
                                
                                with col_img:
                                    st.image(anime["image_url"], width="stretch")
                                    
                                with col_info:
                                    st.markdown(f"**[{anime['title']}]({anime['url']})**")
                                    eps = anime['episodes'] if anime['episodes'] else "Unknown"
                                    st.caption(f"⭐ {anime['score']} | Episodes: {eps} | Status: {anime['status']}")
                                    
                                with col_btn:
                                    if st.button("➕ Add", key=f"add_{anime['mal_id']}", width="stretch"):
                                        add_success, msg = add_to_library(anime)
                                        if add_success:
                                            st.toast("✅ " + msg)
                                            st.rerun()
                                        else:
                                            st.error(msg)
                else:
                    st.error(results)

# ─────────────────────────────────────────────
# TAB 3 — Import Profile via API
# ─────────────────────────────────────────────
with tab_import:
    with st.expander("ℹ️ How to import a Private Profile (Help Steps)", expanded=True):
        st.markdown("""
        **MyAnimeList blocks external apps from reading private profiles without complex OAuth setups.** To import your progress easily without compromising your account credentials:
        
        1. Log into MyAnimeList.net in your browser.
        2. Go to **Settings -> Anime & Manga List Settings**.
        3. Temporarily set your Anime List to **Public**.
        4. Enter your MAL Username below and click 'Import'.
        5. Once imported, you can revert your MAL settings back to **Private**.
        """)
        
    username = st.text_input("MyAnimeList Username")
    if st.button("⬇️ Import Watching & Completed Data", type="primary", width="stretch"):
        if username:
            with st.spinner(f"Fetching data for {username}..."):
                success, msg = import_user_list(username)
                if success:
                    st.success(msg)
                else:
                    st.error(msg)
        else:
            st.warning("Please enter a username.")

apply_footer()
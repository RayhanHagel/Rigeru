import streamlit as st
import re
import time
import threading
from streamlit.runtime.scriptrunner import add_script_run_ctx

# Import shared utilities
from utilities.util_rss import load_subscriptions, save_subscriptions, fetch_all_feeds, preview_rss_feed, load_disk_cache, save_disk_cache


# --- State Initialization ---
if "rss_urls" not in st.session_state:
    st.session_state.rss_urls = load_subscriptions() 
if "discovery_stack" not in st.session_state:
    st.session_state.discovery_stack = []

# SWR & Lazy Loading States
if "cached_articles" not in st.session_state:
    # Load directly from disk on cold start
    disk_articles, last_mod_time = load_disk_cache()
    st.session_state.cached_articles = disk_articles
    st.session_state.last_fetched = last_mod_time
    
if "is_fetching" not in st.session_state:
    st.session_state.is_fetching = False
if "display_limit" not in st.session_state:
    st.session_state.display_limit = 10

st.header(":material/newspaper: Offline RSS Aggregator")
st.markdown("Read your favorite blogs, news, and updates in one algorithm-free feed.")

# --- Feed Preview Modal ---
@st.dialog("Feed Preview", width="large")
def show_feed_preview(url, original_title):
    with st.spinner("Fetching preview..."):
        success, data = preview_rss_feed(url)
        
        if success:
            st.subheader(data['title'])
            st.write(data['description'])
            st.markdown(f"[Visit Source Website]({data['link']})")
            
            if st.button(":material/add: Subscribe to this Feed", type="primary", use_container_width=True):
                if url not in st.session_state.rss_urls:
                    st.session_state.rss_urls[url] = data['title'] 
                    save_subscriptions(st.session_state.rss_urls)
                    fetch_all_feeds.clear()
                    
                    # Remove from current discovery stack list
                    if st.session_state.discovery_stack:
                        current_feeds = st.session_state.discovery_stack[-1][1]
                        if original_title in current_feeds:
                            del current_feeds[original_title]
                            
                    st.toast(f"Subscribed to {data['title']}!")
                    st.rerun()
                    
            st.divider()
            st.markdown("### Recent Articles")
            for article in data['entries']:
                with st.container(border=True):
                    st.markdown(f"**[{article['title']}]({article['link']})**")
                    st.caption(f":material/schedule: {article['date']}")
                    st.write(article['summary'])
        else:
            st.error(data)

# --- Sidebar: Read-Only Subscription List ---
with st.sidebar:
    st.subheader(":material/rss_feed: Subscribed Feeds")
    if not st.session_state.rss_urls:
        st.info("No feeds added yet.")
    else:
        for url, title in st.session_state.rss_urls.items():
            st.markdown(f"- **{title}**")
        st.caption("Go to the Configuration tab to manage your feeds.")

# --- TABS ---
tab_config, tab_feed = st.tabs([":material/settings: Configuration", ":material/article: Feed Reader"])

# ─────────────────────────────────────────────
# TAB 1 — Configuration
# ─────────────────────────────────────────────
with tab_config:
    st.subheader("Discover & Add Feeds")
    
    with st.expander(":material/auto_awesome: Discover Feeds (GitHub / OPML)", expanded=False):
        st.write("Fetch recommendations dynamically from markdown lists or OPML backups.")
        
        # 1. Fetch from URL
        default_raw_url = "https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/master/README.md"
        raw_url = st.text_input("Raw GitHub or OPML URL", value=default_raw_url)
        
        if st.button(":material/public: Fetch List", use_container_width=True):
            def _fetch_remote_bg():
                from utilities.util_rss import fetch_remote_recommendations
                discovered = fetch_remote_recommendations(raw_url)
                if discovered:
                    st.session_state.discovery_stack = [("Main Directory", discovered)]
                    st.session_state.discovery_complete = True
            
            with st.spinner("Parsing links in background..."):
                fetch_thread = threading.Thread(target=_fetch_remote_bg)
                add_script_run_ctx(fetch_thread)
                fetch_thread.start()
                fetch_thread.join()
                
                if st.session_state.get('discovery_complete'):
                    st.success(f"Found {len(st.session_state.discovery_stack[0][1])} items!")
                    st.rerun()
                else:
                    st.error("No valid links found. Make sure it's a 'Raw' github URL.")
        
        st.markdown("---")
        
        # 2. Upload Local File
        uploaded_file = st.file_uploader("Or Upload .md / .opml file", type=['md', 'opml', 'xml'])
        if uploaded_file is not None:
            if st.button(":material/folder: Extract Local File", use_container_width=True):
                content = uploaded_file.getvalue().decode("utf-8")
                if uploaded_file.name.endswith('.opml') or uploaded_file.name.endswith('.xml'):
                    from utilities.util_rss import parse_opml_links
                    discovered = parse_opml_links(content)
                else:
                    from utilities.util_rss import parse_markdown_links
                    discovered = parse_markdown_links(content)
                
                st.session_state.discovery_stack = [(uploaded_file.name, discovered)]
                st.success(f"Parsed {len(discovered)} feeds from file!")

        # 3. Display Discovered Feeds using the Stack
        if st.session_state.discovery_stack:
            st.markdown("---")
            current_title, current_feeds = st.session_state.discovery_stack[-1]
            
            col_title, col_back = st.columns([3, 2], vertical_alignment="bottom")
            col_title.markdown(f"**:material/folder: {current_title}**")
            
            if len(st.session_state.discovery_stack) > 1:
                if col_back.button(":material/arrow_back: Go Back", use_container_width=True):
                    st.session_state.discovery_stack.pop()
                    st.rerun()
            else:
                if col_back.button(":material/delete: Clear", use_container_width=True):
                    st.session_state.discovery_stack = []
                    st.rerun()
                    
            if not current_feeds:
                st.info("No items left in this category.")
            
            for title, url in list(current_feeds.items()):
                col_a, col_prev, col_add = st.columns([5, 2, 2])
                col_a.caption(title)
                
                is_directory = url.split('?')[0].lower().endswith(('.opml', '.md'))
                
                if is_directory:
                    if col_add.button(":material/folder:", key=f"browse_{url}", help="Open this category"):
                        with st.spinner(f"Loading {title}..."):
                            from utilities.util_rss import fetch_remote_recommendations
                            new_feeds = fetch_remote_recommendations(url)
                            if new_feeds:
                                st.session_state.discovery_stack.append((title, new_feeds))
                                st.rerun()
                            else:
                                st.error("No feeds found inside this category.")
                else:
                    if col_prev.button(":material/visibility:", key=f"prev_{url}", help="Preview Feed"):
                        show_feed_preview(url, title)
                        
                    if col_add.button(":material/add:", key=f"add_{url}", help="Subscribe to Feed"):
                        if url not in st.session_state.rss_urls:
                            st.session_state.rss_urls[url] = title 
                            save_subscriptions(st.session_state.rss_urls)
                            fetch_all_feeds.clear()
                            del current_feeds[title]
                            st.toast(f"Subscribed to {title}!")
                            st.rerun()

    st.divider()

    new_feed = st.text_input("Add Custom RSS URL", placeholder="https://example.com/feed.xml")
    if st.button("Add Custom Feed", use_container_width=True):
        if new_feed and new_feed not in st.session_state.rss_urls:
            def _add_feed_bg():
                from utilities.util_rss import fetch_feed_data
                parsed = fetch_feed_data(new_feed)
                
                feed_title = parsed.feed.get('title', new_feed) if parsed else new_feed
                st.session_state.rss_urls[new_feed] = feed_title
                
                save_subscriptions(st.session_state.rss_urls)
                fetch_all_feeds.clear()
                st.session_state.feed_added = True
            
            with st.spinner("Fetching feed info..."):
                feed_thread = threading.Thread(target=_add_feed_bg)
                add_script_run_ctx(feed_thread)
                feed_thread.start()
                feed_thread.join()
                
                if st.session_state.get('feed_added'):
                    st.rerun()
            
    st.divider()
    st.subheader("Manage Subscriptions")
    
    if not st.session_state.rss_urls:
        st.info("No feeds added yet.")
    else:
        for url, title in list(st.session_state.rss_urls.items()):
            col_url, col_del = st.columns([5, 1], vertical_alignment="center")
            
            col_url.markdown(f"**{title}**\n\n*(<small>{url}</small>)*", unsafe_allow_html=True) 
            
            if col_del.button(":material/close: Remove", key=f"del_{url}", use_container_width=True):
                del st.session_state.rss_urls[url]
                save_subscriptions(st.session_state.rss_urls)
                fetch_all_feeds.clear()
                st.rerun()

# ─────────────────────────────────────────────
# TAB 2 — Feed Reader
# ─────────────────────────────────────────────
with tab_feed:
    if not st.session_state.rss_urls:
        st.warning(":material/west: Please add an RSS feed URL in the Configuration tab to get started.")
    else:
        # Wrap the entire feed rendering logic in a fragment
        @st.fragment
        def render_feed_reader():
            # --- 1. Fragment State Initialization (Read Cache) ---
            if "cached_articles" not in st.session_state:
                disk_articles, last_mod_time = load_disk_cache()
                st.session_state.cached_articles = disk_articles
                st.session_state.last_fetched = last_mod_time
                st.session_state.display_limit = 10
                st.session_state.is_fetching = False

            # --- 2. Handle Cold Start (Empty Cache) ---
            if not st.session_state.cached_articles:
                with st.spinner("Fetching your feeds for the first time..."):
                    fresh_articles = fetch_all_feeds(list(st.session_state.rss_urls.keys()))
                    if fresh_articles:
                        save_disk_cache(fresh_articles)
                        st.session_state.cached_articles = fresh_articles
                        st.session_state.last_fetched = time.time()
                    # It will smoothly continue to render the articles below
            
            # --- 3. SWR Background Fetch (Renew & Replace Stale Data) ---
            else:
                STALE_THRESHOLD = 900 # 15 minutes in seconds
                current_time = time.time()
                is_stale = (current_time - st.session_state.last_fetched) > STALE_THRESHOLD

                if is_stale and not st.session_state.is_fetching:
                    st.session_state.is_fetching = True
                    
                    def _bg_fetch_feeds():
                        try:
                            new_articles = fetch_all_feeds(list(st.session_state.rss_urls.keys()))
                            if new_articles:
                                save_disk_cache(new_articles)
                                st.session_state.cached_articles = new_articles
                                st.session_state.last_fetched = time.time()
                        finally:
                            st.session_state.is_fetching = False
                            
                    # Spin up background thread so the UI doesn't freeze
                    fetch_thread = threading.Thread(target=_bg_fetch_feeds)
                    add_script_run_ctx(fetch_thread)
                    fetch_thread.start()

            # --- 4. UI Controls ---
            col_search, col_refresh = st.columns([4, 1], vertical_alignment="bottom")
            search_filter = col_search.text_input(":material/search: Search Articles", placeholder="Filter by keyword or topic...")

            # Sync refresh trigger using fragment scoping
            if col_refresh.button(":material/sync: Force Refresh", use_container_width=True):
                fetch_all_feeds.clear() 
                with st.spinner("Fetching latest articles..."):
                    fresh_articles = fetch_all_feeds(list(st.session_state.rss_urls.keys()))
                    save_disk_cache(fresh_articles) 
                    st.session_state.cached_articles = fresh_articles
                    st.session_state.last_fetched = time.time()
                    st.session_state.display_limit = 10 
                st.rerun(scope="fragment")

            st.divider()

            # Show background fetching status
            if st.session_state.is_fetching:
                 st.caption(":material/sync: Fetching updates in the background. They will appear on your next interaction.")

            # --- 5. Render Articles ---
            if not st.session_state.cached_articles and not st.session_state.is_fetching:
                st.info("No articles found or feeds are currently unreachable.")
            else:
                filtered_articles = st.session_state.cached_articles
                if search_filter:
                    search_lower = search_filter.lower()
                    filtered_articles = [
                        a for a in st.session_state.cached_articles 
                        if search_lower in a['title'].lower() or search_lower in a['summary'].lower() or search_lower in a['source'].lower()
                    ]
                    st.caption(f"Showing {len(filtered_articles)} results matching '{search_filter}'")

                current_limit = st.session_state.display_limit if not search_filter else 50

                # Render only the current limit (Lazy Load)
                for idx, article in enumerate(filtered_articles[:current_limit]): 
                    with st.container(border=True):
                        st.markdown(f"### [{article['title']}]({article['link']})")
                        st.caption(f"**{article['source']}** •  :material/schedule: {article['date']}")
                        
                        clean_summary = re.sub('<[^<]+>', '', article['summary']) 
                        st.write(clean_summary[:400] + ("..." if len(clean_summary) > 400 else ""))

                # Load More Button
                if not search_filter and current_limit < len(filtered_articles):
                    if st.button(":material/expand_more: Load More Articles", use_container_width=True):
                        st.session_state.display_limit += 10
                        st.rerun(scope="fragment")

        # Execute the fragment
        render_feed_reader()
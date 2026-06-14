import streamlit as st
import re
from utilities.util_rss import load_subscriptions, save_subscriptions, fetch_all_feeds, preview_rss_feed
from utilities.util_persistent import apply_footer

# --- State Initialization ---
if "rss_urls" not in st.session_state:
    st.session_state.rss_urls = load_subscriptions() # Now a dictionary: {url: title}
if "discovery_stack" not in st.session_state:
    st.session_state.discovery_stack = []

st.header("📰 Offline RSS Aggregator")
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
            
            # Fixed Invalid width parameter
            if st.button("➕ Subscribe to this Feed", type="primary", width="stretch"):
                if url not in st.session_state.rss_urls:
                    st.session_state.rss_urls[url] = data['title'] # Save the official title
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
                    st.caption(f"⏱️ {article['date']}")
                    st.write(article['summary'])
        else:
            st.error(data)

# --- Sidebar: Read-Only Subscription List ---
with st.sidebar:
    st.subheader("📡 Subscribed Feeds")
    if not st.session_state.rss_urls:
        st.info("No feeds added yet.")
    else:
        for url, title in st.session_state.rss_urls.items():
            st.markdown(f"- **{title}**")
        st.caption("Go to the Configuration tab to manage your feeds.")

# --- TABS ---
tab_config, tab_feed = st.tabs(["⚙️ Configuration", "📰 Feed Reader"])

# ─────────────────────────────────────────────
# TAB 1 — Configuration
# ─────────────────────────────────────────────
with tab_config:
    st.subheader("Discover & Add Feeds")
    
    with st.expander("✨ Discover Feeds (GitHub / OPML)", expanded=False):
        st.write("Fetch recommendations dynamically from markdown lists or OPML backups.")
        
        # 1. Fetch from URL
        default_raw_url = "https://raw.githubusercontent.com/plenaryapp/awesome-rss-feeds/master/README.md"
        raw_url = st.text_input("Raw GitHub or OPML URL", value=default_raw_url)
        
        if st.button("🌐 Fetch List", width="stretch"):
            from streamlit.runtime.scriptrunner import add_script_run_ctx
            import threading
            
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
            if st.button("📂 Extract Local File", width="stretch"):
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
            col_title.markdown(f"**📂 {current_title}**")
            
            if len(st.session_state.discovery_stack) > 1:
                if col_back.button("🔙 Go Back", width="stretch"):
                    st.session_state.discovery_stack.pop()
                    st.rerun()
            else:
                if col_back.button("🗑️ Clear", width="stretch"):
                    st.session_state.discovery_stack = []
                    st.rerun()
                    
            if not current_feeds:
                st.info("No items left in this category.")
            
            for title, url in list(current_feeds.items()):
                col_a, col_prev, col_add = st.columns([5, 2, 2])
                col_a.caption(title)
                
                is_directory = url.split('?')[0].lower().endswith(('.opml', '.md'))
                
                if is_directory:
                    if col_add.button("📂", key=f"browse_{url}", help="Open this category"):
                        with st.spinner(f"Loading {title}..."):
                            from utilities.util_rss import fetch_remote_recommendations
                            new_feeds = fetch_remote_recommendations(url)
                            if new_feeds:
                                st.session_state.discovery_stack.append((title, new_feeds))
                                st.rerun()
                            else:
                                st.error("No feeds found inside this category.")
                else:
                    if col_prev.button("👁️", key=f"prev_{url}", help="Preview Feed"):
                        show_feed_preview(url, title)
                        
                    if col_add.button("➕", key=f"add_{url}", help="Subscribe to Feed"):
                        if url not in st.session_state.rss_urls:
                            st.session_state.rss_urls[url] = title 
                            save_subscriptions(st.session_state.rss_urls)
                            fetch_all_feeds.clear()
                            del current_feeds[title]
                            st.toast(f"Subscribed to {title}!")
                            st.rerun()

    st.divider()

    new_feed = st.text_input("Add Custom RSS URL", placeholder="https://example.com/feed.xml")
    if st.button("Add Custom Feed", width="stretch"):
        if new_feed and new_feed not in st.session_state.rss_urls:
            from streamlit.runtime.scriptrunner import add_script_run_ctx
            import threading
            
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
        # Loop through the dictionary (URL mapped to Title)
        for url, title in list(st.session_state.rss_urls.items()):
            col_url, col_del = st.columns([5, 1], vertical_alignment="center")
            
            # Display the Title and URL safely
            col_url.markdown(f"**{title}**\n\n*(<small>{url}</small>)*", unsafe_allow_html=True) 
            
            if col_del.button("❌ Remove", key=f"del_{url}", width="stretch"):
                del st.session_state.rss_urls[url]
                save_subscriptions(st.session_state.rss_urls)
                fetch_all_feeds.clear()
                st.rerun()

# ─────────────────────────────────────────────
# TAB 2 — Feed Reader
# ─────────────────────────────────────────────
with tab_feed:
    if not st.session_state.rss_urls:
        st.warning("👈 Please add an RSS feed URL in the Configuration tab to get started.")
    else:
        col_search, col_refresh = st.columns([4, 1], vertical_alignment="bottom")
        search_filter = col_search.text_input("🔍 Search Articles", placeholder="Filter by keyword or topic...")

        if col_refresh.button("🔄 Force Refresh", width="stretch"):
            fetch_all_feeds.clear()
            st.rerun()

        st.divider()

        with st.spinner("Fetching latest articles..."):
            all_articles = fetch_all_feeds(list(st.session_state.rss_urls.keys()))

        if not all_articles:
            st.info("No articles found or feeds are currently unreachable.")
        else:
            filtered_articles = all_articles
            if search_filter:
                search_lower = search_filter.lower()
                filtered_articles = [
                    a for a in all_articles 
                    if search_lower in a['title'].lower() or search_lower in a['summary'].lower() or search_lower in a['source'].lower()
                ]
                st.caption(f"Showing {len(filtered_articles)} results matching '{search_filter}'")

            for idx, article in enumerate(filtered_articles[:50]): 
                with st.container(border=True):
                    st.markdown(f"### [{article['title']}]({article['link']})")
                    st.caption(f"**{article['source']}** •  ⏱️ {article['date']}")
                    
                    clean_summary = re.sub('<[^<]+>', '', article['summary']) 
                    st.write(clean_summary[:400] + ("..." if len(clean_summary) > 400 else ""))

apply_footer()
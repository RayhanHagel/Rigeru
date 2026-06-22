import concurrent.futures
import streamlit as st
from datetime import datetime

# Local imports
from utilities.util_yt_rss import (
    load_tracked_channels, add_channel, delete_channel, fetch_latest_videos, 
    search_youtube_channel, bulk_add_channels, load_feed_cache, save_feed_cache
)

st.header("🔔 YouTube RSS Feed")
st.markdown("Track your favorite YouTube channels locally without logging into an account.")

# --- Add Channel Form ---
with st.expander("➕ Track New Channel", expanded=False):
    tab_search, tab_manual, tab_import = st.tabs(["Search by Name", "Manual ID Entry", "Import Takeout CSV"])
    
    with tab_search:
        with st.form("search_yt_channel"):
            search_query = st.text_input("Channel Name to Search", placeholder="e.g., Linus Tech Tips")
            if st.form_submit_button("Search & Add", type="primary"):
                if search_query:
                    with st.spinner("Searching YouTube..."):
                        found_name, found_id = search_youtube_channel(search_query)
                        if found_id:
                            success, msg = add_channel(found_name, found_id)
                            if success:
                                st.success(f"Found and added: {found_name} ({found_id})")
                                st.rerun()
                            else:
                                st.warning(msg)
                        else:
                            st.error("Could not find a channel matching that name.")
                else:
                    st.warning("Please enter a channel name.")

    with tab_manual:
        with st.form("add_yt_channel_manual"):
            col_name, col_id = st.columns(2)
            c_name = col_name.text_input("Channel Alias", placeholder="e.g., MKBHD")
            c_id = col_id.text_input("Channel ID", placeholder="e.g., UCBJycsmduvYEL83R_U4JriQ")
            
            if st.form_submit_button("Track Channel", type="secondary"):
                if c_name and c_id:
                    with st.spinner("Verifying feed..."):
                        success, msg = add_channel(c_name, c_id)
                        if success:
                            st.success(msg)
                            st.rerun()
                        else:
                            st.error(msg)
                else:
                    st.warning("Please fill out both fields.")

    with tab_import:
        st.markdown("Import a `subscriptions.csv` file directly from Google Takeout.")
        uploaded_file = st.file_uploader("Upload subscriptions.csv", type=["csv"])
        
        if uploaded_file is not None:
            if st.button("Import Subscriptions", type="primary"):
                import csv
                import io
                with st.spinner("Parsing CSV and importing channels..."):
                    content = uploaded_file.getvalue().decode("utf-8-sig")
                    reader = csv.DictReader(io.StringIO(content))
                    
                    channels_to_add = [{"name": r.get('Channel Title'), "id": r.get('Channel Id')} for r in reader if r.get('Channel Id')]
                    
                    if channels_to_add:
                        added, skipped = bulk_add_channels(channels_to_add)
                        if added > 0:
                            st.success(f"Import complete! Added {added} channels. (Skipped {skipped} duplicates)")
                            st.rerun()
                        else:
                            st.info(f"No new channels added. All {skipped} were already tracked.")
                    else:
                        st.error("Invalid CSV format. Could not find 'Channel Id' and 'Channel Title'.")

st.divider()

channels = load_tracked_channels()
cached_data = load_feed_cache()

col_title, col_btn = st.columns([4, 1], vertical_alignment="center")

force_refresh = col_btn.button("🔄 Refresh Feeds", type="secondary", width="stretch")
cached_tracked_ids = cached_data.get("tracked_ids", [])
current_tracked_ids = [c['id'] for c in channels]

needs_fetch = force_refresh or not cached_data or set(cached_tracked_ids) != set(current_tracked_ids)

# OPTIMIZED: Abstracted heavy rendering loop into a non-blocking fragment
@st.fragment
def render_youtube_dashboard():
    if not channels:
        st.info("You aren't tracking any channels yet. Use the 'Track New Channel' button above.")
        return

    all_videos = cached_data.get("all_videos", [])
    channel_data = cached_data.get("channel_data", {})

    if needs_fetch:
        all_videos = []
        channel_data = {}
        
        from streamlit.runtime.scriptrunner import add_script_run_ctx
        import threading
        
        def fetch_single_channel(channel):
            success, videos = fetch_latest_videos(channel['id'], limit=15)
            return channel, success, videos
        
        def _fetch_all_feeds_background():
            with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
                future_to_channel = {executor.submit(fetch_single_channel, ch): ch for ch in channels}
                for future in concurrent.futures.as_completed(future_to_channel):
                    channel, success, videos = future.result()
                    
                    if success and videos:
                        channel_data[channel['id']] = {
                            "name": channel['name'],
                            "videos": videos[:3] 
                        }
                        for v in videos:
                            v['channel_name'] = channel['name']
                            v['channel_id'] = channel['id']
                            all_videos.append(v)
                    else:
                        channel_data[channel['id']] = {"name": channel['name'], "videos": []}
            
            all_videos.sort(key=lambda x: x.get('published', ''), reverse=True)
            save_feed_cache({
                "tracked_ids": current_tracked_ids,
                "channel_data": channel_data,
                "all_videos": all_videos
            })
        
        with st.spinner(f"Fetching feeds for {len(channels)} channels in background..."):
            fetch_thread = threading.Thread(target=_fetch_all_feeds_background)
            add_script_run_ctx(fetch_thread)
            fetch_thread.start()
            fetch_thread.join()

        all_videos.sort(key=lambda x: x.get('published', ''), reverse=True)
        
        save_feed_cache({
            "tracked_ids": current_tracked_ids,
            "channel_data": channel_data,
            "all_videos": all_videos
        })

    tab_timeline, tab_channels = st.tabs(["⏱️ Timeline View", "📺 Channel View"])
    
    with tab_timeline:
        if not all_videos:
            st.info("No videos found in timeline.")
        else:
            unique_ym = sorted(list(set([v['published'][:7] for v in all_videos if len(v.get('published', '')) >= 7])), reverse=True)
            
            ym_labels = []
            for ym in unique_ym:
                try:
                    ym_labels.append(datetime.strptime(ym, "%Y-%m").strftime("%B %Y"))
                except ValueError:
                    ym_labels.append(ym)

            st.markdown("### 🗂️ Jump to Date")
            selected_label = st.select_slider(
                "Timeline",
                options=ym_labels,
                value=ym_labels[0] if ym_labels else None,
                label_visibility="collapsed"
            )
            selected_ym = unique_ym[ym_labels.index(selected_label)] if selected_label else None

            filtered_videos = [v for v in all_videos if selected_ym and v['published'].startswith(selected_ym)]
            
            for vid in filtered_videos:
                with st.container(border=True):
                    st.markdown(f"#### [{vid['title']}]({vid['link']})")
                    st.markdown(f"**{vid['channel_name']}**")
                    
                    try:
                        pub_date = datetime.strptime(vid['published'][:19], "%Y-%m-%dT%H:%M:%S")
                        st.caption(f"📅 Uploaded: {pub_date.strftime('%B %d, %Y at %I:%M %p')}")
                    except ValueError:
                        st.caption(f"📅 Uploaded: {vid['published']}")

    with tab_channels:
        selected_to_delete = [c['id'] for c in channels if st.session_state.get(f"chk_{c['id']}", False)]
        col_search, col_sort, col_del_btn = st.columns([2, 1, 1.5], vertical_alignment="bottom")

        with col_search:
            search_query = st.text_input("🔍 Search Channels", placeholder="Search subscriptions...", label_visibility="collapsed")

        with col_sort:
            sort_option = st.selectbox(
                "Sort Channels",
                options=["Added Order", "A-Z", "Z-A"],
                label_visibility="collapsed"
            )

        with col_del_btn:
            if st.button(f"🗑️ Unsubscribe ({len(selected_to_delete)})", disabled=len(selected_to_delete) == 0, type="primary", width="stretch"):
                for c_id in selected_to_delete:
                    delete_channel(c_id)
                    if f"chk_{c_id}" in st.session_state:
                        del st.session_state[f"chk_{c_id}"]
                st.rerun()
                
        st.divider()

        display_channels = channels.copy()
        
        if search_query:
            display_channels = [c for c in display_channels if search_query.lower() in c['name'].lower()]
            
        if sort_option == "A-Z":
            display_channels.sort(key=lambda x: x['name'].lower())
        elif sort_option == "Z-A":
            display_channels.sort(key=lambda x: x['name'].lower(), reverse=True)

        if not display_channels:
            st.info("No channels match your search.")
        else:
            for channel in display_channels:
                c_id = channel['id']
                c_data = channel_data.get(c_id, {"name": channel["name"], "videos": []})
                c_name = c_data["name"]
                vids = c_data["videos"]
                
                col_chk, col_exp = st.columns([0.5, 10])
                
                with col_chk:
                    st.checkbox("Select", key=f"chk_{c_id}", label_visibility="collapsed")
                    
                with col_exp:
                    with st.expander(f"**{c_name}**"):
                        if not vids:
                            st.write("No recent videos found.")
                        else:
                            for vid in vids:
                                st.markdown(f"**[{vid['title']}]({vid['link']})**")
                                try:
                                    pub_date = datetime.strptime(vid['published'][:19], "%Y-%m-%dT%H:%M:%S")
                                    st.caption(f"📅 {pub_date.strftime('%B %d, %Y')}")
                                except ValueError:
                                    st.caption(f"📅 {vid['published'].split('T')[0]}")
                                st.divider()

# Call the fragment
render_youtube_dashboard()
import os
import threading
import streamlit as st
from streamlit.runtime.scriptrunner import add_script_run_ctx

from utilities.util_yt import search_youtube, download_youtube, open_file_in_os
from utilities.util_network import get_image_cache
from utilities.util_persistent import apply_footer

# --- State Initialization ---
if "yt_dest_folder" not in st.session_state:
    st.session_state.yt_dest_folder = os.path.join(os.path.expanduser('~'), 'Downloads')
if "yt_search_results" not in st.session_state:
    st.session_state.yt_search_results = []
if "yt_last_download" not in st.session_state:
    st.session_state.yt_last_download = ""

st.header("🟥 YouTube Downloader & Search")
st.markdown("Search videos directly or paste a link (including playlists) to download locally. Downloads process in the background.")

# --- Global Output Folder ---
with st.container(border=True):
    new_dest = st.text_input(
        "💾 Save Downloads To:",
        value=st.session_state.yt_dest_folder,
        key="yt_dest_input",
        help="Enter the full path to the folder where downloads will be saved."
    )
    if new_dest:
        st.session_state.yt_dest_folder = new_dest

tab1, tab2 = st.tabs(["🔍 Search & Download", "🔗 Direct URL / Playlist Downloader"])

# ─────────────────────────────────────────────
# TAB 1 — Search & Download
# ─────────────────────────────────────────────
with tab1:
    col_search, col_btn = st.columns([4, 1], vertical_alignment="bottom")
    search_query = col_search.text_input(
        "Search YouTube",
        placeholder="Type a keyword, artist, or video name...",
        key="yt_search_input"
    )

    if col_btn.button("Search", type="primary", width="stretch", key="yt_search_btn"):
        if search_query:
            with st.spinner("Searching YouTube..."):
                success, results = search_youtube(search_query)
                if success:
                    st.session_state.yt_search_results = results
                    if not results:
                        st.info("No non-live results found. Try a different query.")
                else:
                    st.error(f"Search failed: {results}")
                    st.session_state.yt_search_results = []
        else:
            st.warning("Please enter a search term.")

    # --- Search Results ---
    if st.session_state.yt_search_results:
        st.divider()
        st.caption(f"{len(st.session_state.yt_search_results)} results (live streams excluded)")

        for idx, vid in enumerate(st.session_state.yt_search_results):
            with st.container(border=True):
                # Two-column layout: thumbnail | info + controls
                thumb_col, info_col = st.columns([1, 3], vertical_alignment="top")

                # Thumbnail
                with thumb_col:
                    thumb_url = vid.get("thumbnail")
                    if thumb_url:
                        thumb_cached = get_image_cache(thumb_url)
                        if thumb_cached:
                            st.image(thumb_cached, width="stretch")
                        else:
                            st.image(thumb_url, width="stretch")
                    else:
                        st.markdown("🎬")

                # Info + download controls
                with info_col:
                    watch_url = vid.get("webpage_url") or vid.get("url", "")
                    st.markdown(f"**[{vid['title']}]({watch_url})**")
                    st.caption(
                        f"📺 {vid.get('uploader', 'Unknown')}  •  "
                        f"⏱ {vid.get('duration_string', '?')}  •  "
                        f"👁 {vid.get('views', 0):,}"
                    )

                    ctrl_fmt, ctrl_qual, ctrl_dl = st.columns([2, 2, 1], vertical_alignment="bottom")

                    dl_type = ctrl_fmt.selectbox(
                        "Format",
                        ["Video (MP4)", "Audio (MP3)"],
                        key=f"yt_fmt_{idx}",
                        label_visibility="collapsed"
                    )

                    is_audio = "Audio" in dl_type
                    if is_audio:
                        ctrl_qual.selectbox(
                            "Quality",
                            ["Best (192kbps)"],
                            key=f"yt_qual_{idx}",
                            disabled=True,
                            label_visibility="collapsed"
                        )
                        resolution = "Best"
                    else:
                        resolution = ctrl_qual.selectbox(
                            "Quality",
                            ["Best", "1080p", "720p", "480p", "360p"],
                            key=f"yt_qual_{idx}",
                            label_visibility="collapsed"
                        )

                    if ctrl_dl.button("⬇️", key=f"yt_dl_{idx}", help="Download", width="stretch"):
                        status_msg = st.empty()
                        
                        def _search_dl_task(v_url, v_title, audio_flag, res, status_placeholder):
                            success, msg, final_path = download_youtube(
                                url=v_url,
                                output_dir=st.session_state.yt_dest_folder,
                                is_audio=audio_flag,
                                resolution=res
                            )
                            if success:
                                status_placeholder.success(f"✅ {v_title} downloaded successfully!")
                                st.session_state.yt_last_download = final_path
                            else:
                                status_placeholder.error(msg)
                                
                        status_msg.info(f"Downloading '{vid['title']}' in background...")
                        
                        # Dispatch to background thread
                        dl_thread = threading.Thread(
                            target=_search_dl_task, 
                            args=(vid['url'], vid['title'], is_audio, resolution, status_msg)
                        )
                        add_script_run_ctx(dl_thread)
                        dl_thread.start()

# ─────────────────────────────────────────────
# TAB 2 — Direct URL / Playlist
# ─────────────────────────────────────────────
with tab2:
    direct_url = st.text_input(
        "YouTube URL",
        placeholder="https://www.youtube.com/watch?v=...",
        key="yt_direct_url"
    )

    col_fmt, col_res = st.columns(2)
    dl_format_direct = col_fmt.selectbox(
        "Media Format",
        ["Video (MP4)", "Audio (MP3)"],
        key="yt_direct_fmt"
    )

    if "Video" in dl_format_direct:
        dl_resolution = col_res.selectbox(
            "Video Quality",
            ["Best", "1080p", "720p", "480p", "360p"],
            key="yt_direct_res"
        )
    else:
        dl_resolution = "Best"
        col_res.selectbox("Audio Quality", ["Best (192kbps)"], disabled=True, key="yt_direct_audio_q")

    if st.button("🚀 Start Download", type="primary", width="stretch", key="yt_direct_dl_btn"):
        if not direct_url:
            st.warning("Please provide a valid YouTube URL.")
        elif not os.path.isdir(st.session_state.yt_dest_folder):
            st.error("Destination folder does not exist. Please enter a valid path above.")
        else:
            is_audio = "Audio" in dl_format_direct
            
            # Placeholders for thread updates
            progress_bar = st.progress(0.0)
            status_text = st.empty()
            status_text.info("Initializing background download...")

            def yt_progress_hook(d):
                if d['status'] == 'downloading':
                    raw = d.get('_percent_str', '0%')
                    p_str = raw.replace('%', '').replace('\x1b[0;94m', '').replace('\x1b[0m', '').strip()
                    try:
                        progress_bar.progress(float(p_str) / 100.0)
                        status_text.text(
                            f"Downloading... {p_str}%  |  "
                            f"Speed: {d.get('_speed_str', '?')}  |  "
                            f"ETA: {d.get('_eta_str', '?')}"
                        )
                    except ValueError:
                        pass
                elif d['status'] == 'finished':
                    status_text.text("Download complete! Merging/Converting...")

            def _direct_download_task():
                success, msg, final_path = download_youtube(
                    url=direct_url,
                    output_dir=st.session_state.yt_dest_folder,
                    is_audio=is_audio,
                    resolution=dl_resolution,
                    progress_hook=yt_progress_hook
                )

                if success:
                    progress_bar.progress(1.0)
                    status_text.success(msg)
                    st.session_state.yt_last_download = final_path
                else:
                    status_text.error(msg)
            
            # Start background thread to prevent UI freezing
            dl_thread = threading.Thread(target=_direct_download_task)
            add_script_run_ctx(dl_thread) # Allows thread to update Streamlit widgets
            dl_thread.start()

# --- Post-Download Action ---
if st.session_state.yt_last_download and os.path.exists(st.session_state.yt_last_download):
    st.divider()
    st.markdown(f"**Last Downloaded:** `{os.path.basename(st.session_state.yt_last_download)}`")
    if st.button("📂 Open File Location", icon=":material/folder_open:", key="yt_open_file"):
        open_file_in_os(st.session_state.yt_last_download)

apply_footer()
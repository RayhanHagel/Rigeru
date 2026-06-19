import os
import streamlit as st
from utilities.util_subtitles import search_opensubtitles, download_subtitle


st.header("🔤 Local Subtitle Fetcher")
st.markdown("Find the *exact* subtitle for your video. This tool analyzes your local video to generate a tiny digital fingerprint, keeping your media completely private.")

# API Key handling via session state
if "os_api_key" not in st.session_state:
    st.session_state.os_api_key = ""

with st.expander("⚙️ OpenSubtitles Configuration", expanded=not st.session_state.os_api_key):
    st.markdown("You need a free REST API Key from [OpenSubtitles.com](https://opensubtitles.com/).")
    key_input = st.text_input("OpenSubtitles API Key", type="password", value=st.session_state.os_api_key)
    if st.button("Save Key"):
        st.session_state.os_api_key = key_input
        st.success("API Key saved to session!")

st.divider()

with st.container(border=True):
    col_path, col_lang = st.columns([3, 1])
    
    video_path = col_path.text_input(
        "🎬 Local Video File Path", 
        placeholder="e.g., C:\\Movies\\MyMovie.mkv",
        help="Paste the full path to your video file."
    )
    
    # Common language codes
    languages = {"English": "en", "Spanish": "es", "French": "fr", "Indonesian": "id", "Japanese": "ja"}
    lang_selection = col_lang.selectbox("Language", list(languages.keys()))
    
    if st.button("🔍 Search Subtitles", type="primary", width="stretch"):
        if not st.session_state.os_api_key:
            st.error("Please configure your OpenSubtitles API Key first.")
        elif not video_path:
            st.warning("Please provide a path to a video file.")
        else:
            with st.spinner("Calculating local video hash and searching..."):
                success, results = search_opensubtitles(
                    video_path, 
                    st.session_state.os_api_key, 
                    language=languages[lang_selection]
                )
                
                if success:
                    if not results:
                        st.info("No exact matching subtitles found for this video hash.")
                    else:
                        st.session_state.subtitle_results = results
                        st.success(f"Found {len(results)} matching subtitles!")
                else:
                    st.error(results)

# Display Results
if "subtitle_results" in st.session_state and st.session_state.subtitle_results:
    st.markdown("### Match Results")
    
    for idx, sub in enumerate(st.session_state.subtitle_results):
        attrs = sub.get("attributes", {})
        files = attrs.get("files", [])
        
        if not files:
            continue
            
        file_id = files[0].get("file_id")
        file_name = files[0].get("file_name", "Unknown.srt")
        
        with st.container(border=True):
            col_info, col_dl = st.columns([4, 1], vertical_alignment="center")
            
            with col_info:
                st.markdown(f"**{file_name}**")
                st.caption(f"Rating: {attrs.get('ratings', 0)} ⭐ | Downloads: {attrs.get('download_count', 0)}")
                
            with col_dl:
                # Unique key for the download trigger
                dl_key = f"dl_sub_{idx}"
                if st.button("⬇️ Fetch", key=dl_key, width="stretch"):
                    with st.spinner("Fetching file..."):
                        dl_success, sub_bytes, final_name = download_subtitle(file_id, st.session_state.os_api_key)
                        
                        if dl_success:
                            # Use Streamlit's native download button once the bytes are fetched
                            st.download_button(
                                label="💾 Save .SRT",
                                data=sub_bytes,
                                file_name=final_name,
                                mime="text/plain",
                                type="primary",
                                width="stretch",
                                key=f"save_{idx}"
                            )
                        else:
                            st.error(sub_bytes)


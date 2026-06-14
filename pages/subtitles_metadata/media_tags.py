import os
import tempfile
import streamlit as st
from utilities.util_metadata import get_media_metadata, save_media_metadata
from utilities.util_persistent import apply_footer

st.header("🏷️ Media Tags Editor")
st.markdown("Modify internal media tags (ID3/MP4) for your audio and video files.")

# --- File Upload (replaces tkinter) ---
with st.container(border=True):
    uploaded_file = st.file_uploader(
        "Select a media file (MP3, MP4, FLAC, M4A, etc.)",
        type=["mp3", "mp4", "flac", "m4a", "ogg", "wav", "aac", "wma", "mkv"],
        key="media_tags_uploader"
    )
    if uploaded_file:
        st.caption(f"📎 `{uploaded_file.name}`")

st.divider()

# --- Metadata Editor ---
if uploaded_file:
    suffix = os.path.splitext(uploaded_file.name)[1]

    # Write to temp file so mutagen can read it
    if "loaded_tags_name" not in st.session_state or st.session_state.loaded_tags_name != uploaded_file.name:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(uploaded_file.read())
            st.session_state.meta_tags_tmp_path = tmp.name
        st.session_state.meta_tags = get_media_metadata(st.session_state.meta_tags_tmp_path)
        st.session_state.loaded_tags_name = uploaded_file.name

    tags = st.session_state.meta_tags
    tmp_path = st.session_state.meta_tags_tmp_path

    st.markdown("### Edit Internal Tags")

    t_col, a_col = st.columns(2)
    new_title = t_col.text_input("Title", value=tags.get("title", ""), key="tag_title")
    new_artist = a_col.text_input("Artist", value=tags.get("artist", ""), key="tag_artist")

    al_col, d_col = st.columns(2)
    new_album = al_col.text_input("Album", value=tags.get("album", ""), key="tag_album")
    new_date = d_col.text_input("Year / Date", value=tags.get("date", ""), key="tag_date")

    if st.button("💾 Save Media Tags", type="primary", width="stretch"):
        with st.spinner("Writing metadata..."):
            success, msg = save_media_metadata(tmp_path, new_title, new_artist, new_album, new_date)
            if success:
                st.success(msg)
                st.session_state.meta_tags = {
                    "title": new_title,
                    "artist": new_artist,
                    "album": new_album,
                    "date": new_date
                }
            else:
                st.error(msg)
else:
    st.info("Upload a media file (MP3, MP4, etc.) to view and edit its metadata.")

apply_footer()

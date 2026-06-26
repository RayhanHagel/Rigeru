import os
import streamlit as st
from utilities.util_spotify_download import stream_spotdl_download

# Using inline Material Icon syntax for the header
st.header(":material/queue_music: Spotify Playlist Downloader")
st.markdown("Enter a Spotify playlist URL below to download everything directly.")

# --- Settings ---
col1, col2 = st.columns(2)
audio_format = col1.selectbox("Audio Format", ["mp3", "flac", "m4a", "opus"], index=0)
bitrate = col2.selectbox("Bitrate", ["320k", "256k", "192k", "128k"], index=0)

output_dir = st.text_input("Save Folder:", value=os.path.join(os.path.expanduser('~'), 'Music'))
playlist_url = st.text_input("Spotify Playlist URL:")

# Using the icon parameter for the button
if st.button("Download Playlist", type="primary", icon=":material/download:"):
    if not playlist_url:
        st.error("Please enter a URL.", icon=":material/error:")
    elif not os.path.exists(output_dir):
        st.error("Invalid output folder.", icon=":material/folder_off:")
    else:
        st.info("Starting download process...", icon=":material/pending:")
        
        # 1. Create a placeholder to hold our terminal UI
        terminal_placeholder = st.empty()
        log_lines = []
        
        # Initialize the visual terminal to show it's starting
        terminal_placeholder.code("Initializing spotDL...", language="bash")
        
        try:
            # 2. Iterate through the yielded lines from your utility function
            for line in stream_spotdl_download(playlist_url, output_dir, audio_format, bitrate):
                # Append new line to our log (stripping trailing whitespace/newlines)
                log_lines.append(line.rstrip())
                
                # Keep only the last 50 lines to prevent the page from getting too long/slow
                if len(log_lines) > 50:
                    log_lines.pop(0)
                
                # 3. Overwrite the placeholder with the updated log
                terminal_placeholder.code("\n".join(log_lines), language="bash")
                
            # Using the icon parameter for the success message
            st.success(f"Successfully downloaded to {output_dir}", icon=":material/celebration:")
            
        except Exception as e:
            st.error(f"An error occurred during the download: {e}", icon=":material/warning:")
import os
import json
import streamlit as st
from utilities.util_spotify_dl import get_playlist_tracks, download_track_audio

import concurrent.futures


# --- Credential Management ---
def load_creds():
    path = "./cache/spotify_creds.json"
    if os.path.exists(path):
        with open(path, 'r') as f:
            return json.load(f)
    return {"client_id": "", "client_secret": ""}


def save_creds(cid, csec):
    os.makedirs("./cache", exist_ok=True)
    with open("./cache/spotify_creds.json", 'w') as f:
        json.dump({"client_id": cid, "client_secret": csec}, f)


creds = load_creds()

# --- State Initialization ---
if "sp_cid" not in st.session_state:
    st.session_state.sp_cid = creds["client_id"]
if "sp_csec" not in st.session_state:
    st.session_state.sp_csec = creds["client_secret"]
if "sp_dest" not in st.session_state:
    st.session_state.sp_dest = os.path.join(os.path.expanduser('~'), 'Music')
if "sp_tracks" not in st.session_state:
    st.session_state.sp_tracks = []
if "sp_pname" not in st.session_state:
    st.session_state.sp_pname = ""

st.header("🟢 Spotify Playlist Converter")
st.markdown("Fetch tracks from a Spotify playlist and download them locally as MP3s via YouTube.")

# --- API Settings ---
with st.expander("⚙️ Spotify API Credentials (Required)", expanded=not bool(st.session_state.sp_cid)):
    st.markdown("""
    1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
    2. Click **Create app** (Redirect URI can be `http://localhost`).
    3. Go to **Settings** and copy your **Client ID** and **Client Secret**.
    """)
    new_cid = st.text_input("Client ID", value=st.session_state.sp_cid, type="password")
    new_csec = st.text_input("Client Secret", value=st.session_state.sp_csec, type="password")
    if st.button("💾 Save Credentials"):
        save_creds(new_cid, new_csec)
        st.session_state.sp_cid = new_cid
        st.session_state.sp_csec = new_csec
        st.success("Credentials saved!")

st.divider()

# --- Output Folder (text input replaces tkinter) ---
with st.container(border=True):
    new_dest = st.text_input(
        "Save MP3s To:",
        value=st.session_state.sp_dest,
        help="Enter the full path to where MP3s should be saved.",
        key="sp_dest_input"
    )
    if new_dest:
        st.session_state.sp_dest = new_dest

playlist_url = st.text_input("Spotify Playlist URL", placeholder="https://open.spotify.com/playlist/...")

if st.button("🔍 Fetch Tracklist", type="primary", width="stretch"):
    if not playlist_url:
        st.error("Please enter a playlist URL.")
    else:
        with st.spinner("Authenticating with Spotify and fetching tracks..."):
            success, pname, tracks = get_playlist_tracks(playlist_url, st.session_state.sp_cid, st.session_state.sp_csec)
            if success:
                st.session_state.sp_pname = pname
                st.session_state.sp_tracks = tracks
                st.success(f"Found {len(tracks)} tracks in '{pname}'!")
            else:
                st.error(tracks)

# --- Results & Downloader ---
if st.session_state.sp_tracks:
    st.subheader(f"💿 {st.session_state.sp_pname}")
    st.caption(f"Total Tracks: {len(st.session_state.sp_tracks)}")

    with st.expander("View Tracklist", expanded=False):
        st.code("\n".join(st.session_state.sp_tracks), language="text")
    
    if st.button("🚀 Start Bulk YouTube Download", type="primary", width="stretch"):
        if not os.path.isdir(st.session_state.sp_dest):
            st.error(f"Destination folder not found: `{st.session_state.sp_dest}`")
        else:
            safe_pname = "".join(
                c for c in st.session_state.sp_pname if c.isalpha() or c.isdigit() or c == ' '
            ).rstrip()
            final_dest = os.path.join(st.session_state.sp_dest, safe_pname)
            os.makedirs(final_dest, exist_ok=True)

            progress_bar = st.progress(0)
            status_text = st.empty()
            log_box = st.empty()
            download_logs = []

            total = len(st.session_state.sp_tracks)
            
            def _download_worker(idx_query):
                idx, track_query = idx_query
                success, log_msg = download_track_audio(track_query, final_dest)
                return idx, success, log_msg

            with st.spinner(f"Downloading {total} tracks..."):
                with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                    futures = [executor.submit(_download_worker, (idx, tq)) for idx, tq in enumerate(st.session_state.sp_tracks)]
                    
                    for future in concurrent.futures.as_completed(futures):
                        idx, success, log_msg = future.result()
                        download_logs.insert(0, f"{idx + 1}. {log_msg}")
                        log_box.code("\n".join(download_logs[:10]), language="text")
                        progress_bar.progress((idx + 1) / total)

            st.success(f"🎉 Playlist download complete! Saved to: {final_dest}")



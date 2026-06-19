import os
import json
import base64
import streamlit as st
from utilities.util_spotify import check_lastfm, read_cache
from utilities.util_network import get_image_cache


# --- Constants ---
FONT_SERIF = "'Libre Baskerville', Georgia, serif"
FONT_MONO  = "'DM Mono', monospace"

st.header("🎵 Spotify Scrobbler")
st.markdown("Live, auto-refreshing feed of your currently playing and recently listened tracks via Last.fm.")

# --- Configuration Management ---
raw_data = read_cache()
if isinstance(raw_data, list):
    data = {"username": "", "refresh_interval": 60}
else:
    data = raw_data

with st.expander("⚙️ Scrobbler Settings", expanded=not bool(data.get("username"))):
    col1, col2 = st.columns([3, 1], vertical_alignment="bottom")
    new_user = col1.text_input("Last.fm Username", value=data.get("username", ""))

    try:
        saved_interval = int(data.get("refresh_interval", 60))
    except (ValueError, TypeError):
        saved_interval = 60
    saved_interval = max(10, min(300, saved_interval))

    new_interval = col2.number_input(
        "Refresh Interval (s)",
        min_value=10,
        max_value=300,
        value=saved_interval
    )

    # Fixed Invalid width parameter
    if st.button("💾 Save Settings", width="stretch"):
        new_data = {"username": new_user, "refresh_interval": int(new_interval)}
        os.makedirs("./cache", exist_ok=True)
        with open("./cache/spotify_scrobbler.json", "w") as f:
            json.dump(new_data, f, indent=4)
        st.success("Saved!")
        st.rerun()

username = data.get("username", "")
refresh_interval = saved_interval


# --- Helper Functions ---
def img_to_src(img_data, fallback_url: str) -> str:
    if img_data is None:
        return fallback_url or ""
    if isinstance(img_data, bytes):
        b64 = base64.b64encode(img_data).decode()
        return f"data:image/jpeg;base64,{b64}"
    return str(img_data)


SCALES = [
    (110, 22, 14, 11, 1.00, 0, 24),
    ( 82, 18, 13, 10, 0.70, 0, 18),
    ( 62, 15, 12, 10, 0.48, 0, 14),
    ( 48, 13, 11,  9, 0.30, 0, 10),
    ( 38, 12, 10,  9, 0.18, 0,  8),
]

def get_scale(idx):
    return SCALES[min(idx, len(SCALES) - 1)]


# --- Live Feed Renderer ---
if username:
    @st.fragment(run_every=f"{refresh_interval}s")
    def lastfm_feed():
        user_avatar_url, scrobble_amount, _, recent_songs = check_lastfm(username)

        if user_avatar_url is None:
            st.warning("Could not connect to Last.fm. Check your username or network connection.")
            return

        avatar_src = img_to_src(get_image_cache(url=user_avatar_url), user_avatar_url)
        try:
            sc_fmt = f"{int(scrobble_amount):,}"
        except Exception:
            sc_fmt = str(scrobble_amount)

        # Profile Header
        st.markdown(
            f'<div style="display:flex;align-items:center;gap:14px;padding:8px 0 24px;">'
            f'<img src="{avatar_src}" style="width:46px;height:46px;border-radius:50%;border:2px solid rgba(255,255,255,0.12);object-fit:cover;"/>'
            f'<div>'
            f'<div style="font-family:\'Libre Baskerville\',serif;font-style:italic;font-size:12px;color:rgba(255,255,255,0.55);letter-spacing:0.08em;">listening history</div>'
            f'<div style="font-family:\'DM Mono\',monospace;font-size:15px;color:rgba(255,255,255,0.92);letter-spacing:0.04em;">{username}</div>'
            f'</div>'
            f'<div style="margin-left:auto;text-align:right;">'
            f'<div style="font-family:\'DM Mono\',monospace;font-size:20px;color:rgba(255,255,255,0.88);letter-spacing:-0.02em;">{sc_fmt}</div>'
            f'<div style="font-family:\'Libre Baskerville\',serif;font-style:italic;font-size:11px;color:rgba(255,255,255,0.48);">scrobbles</div>'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

        cards = ""
        for idx, current_song in enumerate(recent_songs):
            song_name     = current_song[0]
            song_cover    = current_song[1]
            song_artist   = current_song[2]
            last_listened = current_song[3]

            cover_src = img_to_src(get_image_cache(url=song_cover), song_cover)
            cover_px, title_px, artist_px, time_px, opacity, pt, pb = get_scale(idx)

            is_scrobbling = last_listened.strip().lower() == "scrobbling now"
            playing_class = "playing" if is_scrobbling else ""
            now_badge = '<div class="now-badge"><span class="now-dot"></span>NOW PLAYING</div>' if is_scrobbling else ""

            safe_name   = song_name.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
            safe_artist = song_artist.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
            safe_time   = last_listened.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
            divider     = '<div class="lf-divider"></div>' if idx < len(recent_songs) - 1 else ""

            cards += (
                f'<div style="padding:{pt}px 0 {pb}px;">'
                f'<div class="song-card" style="opacity:{opacity}">'
                f'<div class="cover-wrap {playing_class}">'
                f'<img src="{cover_src}" width="{cover_px}" height="{cover_px}" style="display:block;border-radius:6px;object-fit:cover;"/>'
                f'</div>'
                f'<div class="song-meta">{now_badge}'
                f'<div class="song-name" style="font-size:{title_px}px">{safe_name}</div>'
                f'<div class="song-artist" style="font-size:{artist_px}px">{safe_artist}</div>'
                f'</div>'
                f'<div class="song-time" style="font-size:{time_px}px">{safe_time}</div>'
                f'</div></div>{divider}'
            )

        st.markdown("""
        <style>
            .song-card { display:flex; align-items:center; gap:18px; transition:opacity 0.25s; }
            .song-card:hover { opacity:1!important; }
            .cover-wrap { position:relative; flex-shrink:0; border-radius:6px; box-shadow:0 6px 32px rgba(0,0,0,0.55); }
            .cover-wrap.playing::after {
                content:""; position:absolute; inset:-4px; border-radius:10px;
                border:1.5px solid rgba(255,255,255,0.15); animation:pulse 2.4s ease-in-out infinite;
            }
            @keyframes pulse {
                0%,100% { opacity:0.8; transform:scale(1); }
                50% { opacity:0.2; transform:scale(1.04); }
            }
            .song-meta { flex:1; min-width:0; }
            .now-badge { display:inline-flex; align-items:center; gap:6px; font-size:9px; letter-spacing:0.18em; color:rgba(255,255,255,0.58); margin-bottom:6px; }
            .now-dot { width:5px; height:5px; border-radius:50%; background:#e04e7a; animation:blink 1.4s ease-in-out infinite; flex-shrink:0; }
            @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.15; } }
            .song-name { font-family:"Libre Baskerville",Georgia,serif; color:rgba(255,255,255,0.90); line-height:1.2; margin-bottom:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .song-artist { font-weight:300; color:rgba(255,255,255,0.58); letter-spacing:0.03em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .song-time { font-weight:300; color:rgba(255,255,255,0.42); letter-spacing:0.04em; white-space:nowrap; flex-shrink:0; text-align:right; }
            .lf-divider { height:1px; background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.06) 20%,rgba(255,255,255,0.06) 80%,transparent 100%); }
        </style>
        """, unsafe_allow_html=True)

        st.markdown(cards, unsafe_allow_html=True)

    lastfm_feed()


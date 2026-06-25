import os
import json
import streamlit as st
from datetime import datetime, timedelta, timezone
from utilities.util_spotify import (
    check_lastfm, 
    read_config_cache, 
    read_data_cache, 
    save_data_cache, 
    get_current_theme,
    get_default_cover_src
)

# --- 1. Lightning-Fast One-Time Initialization ---
if "app_initialized" not in st.session_state:
    st.session_state.config_data = read_config_cache()
    st.session_state.DEFAULT_COVER = get_default_cover_src()
    st.session_state.app_initialized = True

theme, font_serif, font_mono = get_current_theme()
DEFAULT_COVER = st.session_state.DEFAULT_COVER


def get_time_ago(timestamp_str: str, tz_str: str) -> str:
    """Parses timestamps and calculates time ago using strict absolute UTC boundaries."""
    if timestamp_str.strip().lower() == "scrobbling now" or timestamp_str == "Unknown":
        return timestamp_str
    
    try:
        tz_hours = int(tz_str.replace("UTC", "").split(":")[0])
        user_tz = timezone(timedelta(hours=tz_hours))

        clean_time_str = timestamp_str.replace("am", "AM").replace("pm", "PM")
        dt = datetime.strptime(clean_time_str, "%A %d %b %Y, %I:%M%p")
        dt = dt.replace(tzinfo=user_tz)
        now = datetime.now(timezone.utc)
        diff = now - dt
        
        seconds = max(0, diff.total_seconds())
        
        if seconds < 60:
            return "just now"
        elif seconds < 3600:
            mins = int(seconds // 60)
            return f"{mins} min{'s' if mins != 1 else ''} ago"
        elif seconds < 86400:
            hours = int(seconds // 3600)
            return f"{hours} hr{'s' if hours != 1 else ''} ago"
        else:
            days = int(seconds // 86400)
            return f"{days} day{'s' if days != 1 else ''} ago"
            
    except Exception:
        return timestamp_str


st.header(":material/music_note: Spotify Scrobbler")
st.markdown("Live, auto-refreshing feed of your currently playing and recently listened tracks via Last.fm.")


# --- 2. Fragmented Settings Module ---
@st.fragment
def scrobbler_settings():
    with st.expander("Scrobbler Settings", icon=":material/settings:", expanded=not bool(st.session_state.config_data.get("username"))):
        # Changed to 3 columns to fit the timezone dropdown
        col1, col2, col3 = st.columns([2, 1, 1], vertical_alignment="bottom")
        
        current_user = st.session_state.config_data.get("username", "")
        new_user = col1.text_input("Last.fm Username", value=current_user)

        try:
            saved_interval = int(st.session_state.config_data.get("refresh_interval", 60))
        except (ValueError, TypeError):
            saved_interval = 60
            
        saved_interval = max(10, min(300, saved_interval))
        new_interval = col2.number_input("Refresh (s)", min_value=10, max_value=300, value=saved_interval)

        # --- NEW: Timezone Dropdown ---
        tz_options = [f"UTC{'+' if i >= 0 else '-'}{abs(i):02d}:00" for i in range(-12, 15)]
        saved_tz = st.session_state.config_data.get("timezone", "UTC+07:00")
        if saved_tz not in tz_options:
            saved_tz = "UTC+07:00"
            
        new_tz = col3.selectbox("Timezone", options=tz_options, index=tz_options.index(saved_tz))

        if st.button("Save Settings", icon=":material/save:", use_container_width=True):
            # Save the new timezone key
            new_data = {"username": new_user, "refresh_interval": int(new_interval), "timezone": new_tz}
            
            st.session_state.config_data = new_data
            
            os.makedirs("./cache", exist_ok=True)
            with open("./cache/spotify_scrobbler.json", "w") as f:
                json.dump(new_data, f, indent=4)
                
            st.toast("Settings Saved!", icon=":material/check_circle:")
            st.rerun()

scrobbler_settings()

# Extract values for the renderer to use
username = st.session_state.config_data.get("username", "")
user_tz_str = st.session_state.config_data.get("timezone", "UTC+07:00") # Extract the timezone
try:
    refresh_interval = int(st.session_state.config_data.get("refresh_interval", 60))
except (ValueError, TypeError):
    refresh_interval = 60


# --- Helper Functions ---
# Scaling curve: (cover_px, title_px, artist_px, time_px, opacity, pt, pb)
SCALES = [
    (120, 24, 16, 12, 1.00,  8, 28),
    ( 90, 20, 14, 11, 0.85,  4, 20),
    ( 72, 18, 13, 11, 0.70,  4, 16),
    ( 58, 16, 12, 10, 0.55,  4, 14),
    ( 48, 14, 11, 10, 0.45,  4, 12),
]


def get_scale(idx):
    return SCALES[min(idx, len(SCALES) - 1)]


# --- Live Feed Renderer ---
if username:
    def render_feed_ui(data_dict):
        """Helper to render the UI using a dictionary of data."""
        if not data_dict.get("avatar_url"):
            return
            
        # The avatar is now already a cached static path from the JSON!
        avatar_src = data_dict["avatar_url"]
        
        scrobble_amount = data_dict["scrobble_amount"]
        try:
            sc_fmt = f"{int(scrobble_amount):,}"
        except Exception:
            sc_fmt = str(scrobble_amount)

        st.markdown(
            f'<div style="display:flex;align-items:center;gap:16px;padding:12px 0 32px;">'
            f'<img src="{avatar_src}" style="width:56px;height:56px;border-radius:50%;border:2px solid {theme["UI_BORDER"]};object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.3);"/>'
            f'<div>'
            f'<div style="font-family:{font_serif};font-style:italic;font-size:13px;color:{theme["TEXT"]};opacity:0.8;letter-spacing:0.06em;">listening history</div>'
            f'<div style="font-family:{font_mono};font-size:16px;font-weight:600;color:{theme["HEADING"]};letter-spacing:0.02em;">{username}</div>'
            f'</div>'
            f'<div style="margin-left:auto;text-align:right;">'
            f'<div style="font-family:{font_mono};font-size:24px;font-weight:600;color:{theme["HEADING"]};letter-spacing:-0.02em;">{sc_fmt}</div>'
            f'<div style="font-family:{font_serif};font-style:italic;font-size:12px;color:{theme["TEXT"]};opacity:0.7;">scrobbles</div>'
            f'</div>'
            f'</div>',
            unsafe_allow_html=True,
        )

        cards = ""
        recent_songs = data_dict.get("recent_songs", [])
        
        for idx, current_song in enumerate(recent_songs):
            song_name     = current_song[0]
            cover_src     = current_song[1] or DEFAULT_COVER 
            song_artist   = current_song[2]
            
            raw_timestamp = current_song[3]
            last_listened = get_time_ago(raw_timestamp, user_tz_str)
            
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
                f'<div class="cover-wrap {playing_class}" style="width:{cover_px}px;height:{cover_px}px;background-color:{theme["UI_BG"]};display:flex;align-items:center;justify-content:center;">'
                f'<img src="{cover_src}" loading="lazy" decoding="async" style="width:100%;height:100%;display:block;"/>'
                f'</div>'
                f'<div class="song-meta">{now_badge}'
                f'<div class="song-name" style="font-size:{title_px}px">{safe_name}</div>'
                f'<div class="song-artist" style="font-size:{artist_px}px">{safe_artist}</div>'
                f'</div>'
                f'<div class="song-time" style="font-size:{time_px}px">{safe_time}</div>'
                f'</div></div>{divider}'
            )

        st.markdown(f"""
        <style>
            .song-card {{ display:flex; align-items:center; gap:20px; transition:all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); }}
            .song-card:hover {{ opacity:1!important; transform: translateX(6px); }}
            .cover-wrap {{ position:relative; flex-shrink:0; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.4); overflow:hidden; }}
            .cover-wrap img {{ border-radius:8px; object-fit:cover; transition: transform 0.4s ease; }}
            .song-card:hover .cover-wrap img {{ transform: scale(1.05); }}
            
            .cover-wrap.playing {{ overflow:visible; box-shadow:0 0 20px {theme["GLOW_2"]}; }}
            .cover-wrap.playing img {{ border-radius:8px; }}
            .cover-wrap.playing::after {{
                content:""; position:absolute; inset:-4px; border-radius:12px;
                border:2px solid {theme["HEADING"]}; animation:pulse 2s ease-out infinite; pointer-events: none;
            }}
            @keyframes pulse {{
                0% {{ opacity:0.8; transform:scale(1); }}
                100% {{ opacity:0; transform:scale(1.15); }}
            }}
            
            .song-meta {{ flex:1; min-width:0; }}
            .now-badge {{ display:inline-flex; align-items:center; gap:6px; font-size:10px; font-weight:700; letter-spacing:0.15em; color:{theme["HEADING"]}; margin-bottom:6px; }}
            .now-dot {{ width:6px; height:6px; border-radius:50%; background:{theme["HEADING"]}; animation:blink 1.2s ease-in-out infinite; flex-shrink:0; box-shadow: 0 0 8px {theme["HEADING"]}; }}
            @keyframes blink {{ 0%,100% {{ opacity:1; }} 50% {{ opacity:0.2; }} }}
            
            .song-name {{ font-family:{font_serif}; color:{theme["HEADING"]}; line-height:1.2; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}
            .song-artist {{ font-family:{font_mono}; font-weight:400; color:{theme["TEXT"]}; opacity: 0.85; letter-spacing:0.03em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }}
            .song-time {{ font-family:{font_mono}; font-weight:400; color:{theme["TEXT"]}; opacity: 0.65; letter-spacing:0.04em; white-space:nowrap; flex-shrink:0; text-align:right; }}
            
            .lf-divider {{ height:1px; background:linear-gradient(90deg,transparent 0%,{theme["UI_BORDER"]} 20%,{theme["UI_BORDER"]} 80%,transparent 100%); }}
        </style>
        """, unsafe_allow_html=True)

        st.markdown(cards, unsafe_allow_html=True)


    # 1. Load from disk cache ONCE per session
    if "lastfm_data" not in st.session_state:
        st.session_state.lastfm_data = read_data_cache()
        st.session_state.trigger_swr = True  # Flag to trigger the Stale-While-Revalidate flush

    # 2. SWR Check: If this is the initial load, paint the stale cache and yield.
    if st.session_state.get("trigger_swr"):
        if st.session_state.lastfm_data:
            render_feed_ui(st.session_state.lastfm_data)
        else:
            st.info("Fetching latest listening history...", icon=":material/downloading:")
        
        # Turn off the flag and force Streamlit to flush the HTML to the browser instantly
        st.session_state.trigger_swr = False
        st.rerun()

    # 3. Subsequent Runs: Mount the auto-refreshing fragment
    else:
        @st.fragment(run_every=f"{refresh_interval}s")
        def lastfm_feed():
            ui_placeholder = st.empty()
            
            # 1. ALWAYS render the UI first so the user isn't looking at a blank screen
            with ui_placeholder.container():
                if st.session_state.lastfm_data:
                    render_feed_ui(st.session_state.lastfm_data)
                else:
                    st.info("Fetching latest listening history...", icon=":material/downloading:")

            # 2. QUEUE PROCESSOR: Fetch ONE missing cover per fragment run
            if st.session_state.lastfm_data:
                for song in st.session_state.lastfm_data.get("recent_songs", []):
                    # Ensure backwards compatibility with older 4-item cache arrays
                    if len(song) > 4:
                        cover_src = song[1]
                        song_link = song[4]
                        
                        # If image is None and we have a valid link
                        if cover_src is None and song_link is not None:
                            from utilities.util_spotify import get_album_cover
                            
                            # Fetch ONE cover
                            fetched_cover = get_album_cover(song_link)
                            
                            # Mark it so we don't retry forever if it fails
                            song[1] = fetched_cover if fetched_cover else "NOT_FOUND" 
                            
                            # Save and instantly refresh just this fragment
                            save_data_cache(st.session_state.lastfm_data)
                            st.rerun(scope="fragment") 
                            return # Exit function early! We only do ONE per run.

            # 3. MAIN NETWORK FETCH: Only runs if all covers are fully loaded
            user_avatar_url, scrobble_amount, scrobble_artist, recent_songs = check_lastfm(username)
            
            if user_avatar_url is None:
                if not st.session_state.lastfm_data:
                    with ui_placeholder.container():
                        st.warning("Could not connect to Last.fm. Check your network.", icon=":material/wifi_off:")
                return
                
            fresh_data = {
                "avatar_url": user_avatar_url,
                "scrobble_amount": scrobble_amount,
                "recent_songs": recent_songs
            }

            # Overwrite UI if new data is found (ignoring the 'NOT_FOUND' flags in cache comparison)
            if fresh_data != st.session_state.lastfm_data:
                st.session_state.lastfm_data = fresh_data
                save_data_cache(fresh_data)
                st.rerun(scope="fragment")

        lastfm_feed()
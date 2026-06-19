import streamlit as st
from utilities.util_twitch import check_live_status, read_cache, save_config

from streamlit_autorefresh import st_autorefresh

# --- State Initialization ---
if 'twitch_cache' not in st.session_state:
    st.session_state.twitch_cache = read_cache()

st.header("📺 Twitch Watch")
st.markdown("Monitor your tracked streamers and watch live directly from your dashboard.")

tab_config, tab_watch = st.tabs(["⚙️ Configuration", "📺 Watch Stream"])

# ─────────────────────────────────────────────
# TAB 1 — Configuration
# ─────────────────────────────────────────────
with tab_config:
    st.subheader("General Settings")
    col_interval, col_domain = st.columns(2)
    
    minutes = col_interval.slider("Refresh Interval (minutes)", min_value=1, max_value=15, value=5)
    st_autorefresh(interval=minutes * 60000, key="twitchcheck")

    embed_parent = col_domain.text_input(
        "Embed Parent Domain",
        value="localhost",
        help="Change to your host IP if accessing from another device (e.g., 192.168.1.50)"
    )

    st.divider()
    st.subheader("Manage Channels")

    with st.expander("✏️ Add / Edit Channel List", expanded=False):
        current_channels = list(st.session_state.get('twitch_cache', []))
        st.caption("One channel per line. Order = priority (top shown first when multiple are live).")

        channels_text = st.text_area(
            "Channels",
            value="\n".join(current_channels),
            height=180,
            label_visibility="collapsed",
            key="twitch_channel_editor"
        )

        col_save, col_clear = st.columns(2)
        if col_save.button("💾 Save List", width="stretch", key="twitch_save_btn"):
            new_list = [c.strip().lower() for c in channels_text.splitlines() if c.strip()]
            seen = set()
            deduped = [c for c in new_list if not (c in seen or seen.add(c))]
            save_config(channel="", replace_data=deduped)
            st.session_state.twitch_cache = deduped
            st.success(f"Saved {len(deduped)} channel(s)!")
            st.rerun()

        if col_clear.button("🗑️ Clear All", width="stretch", key="twitch_clear_btn"):
            save_config(channel="", replace_data=[])
            st.session_state.twitch_cache = []
            st.rerun()

    st.divider()
    st.markdown("**Tracked Channels:**")
    
    cached_channels = st.session_state.get('twitch_cache', [])
    if cached_channels:
        for ch in cached_channels:
            col_ch, col_rm = st.columns([5, 1], vertical_alignment="center")
            col_ch.markdown(f"**{ch}**")
            
            if col_rm.button("❌ Remove", key=f"rm_{ch}", help=f"Remove {ch}", width="stretch"):
                updated = [c for c in cached_channels if c != ch]
                save_config(channel="", replace_data=updated)
                st.session_state.twitch_cache = updated
                st.rerun()
    else:
        st.info("No channels tracked yet.")

# ─────────────────────────────────────────────
# TAB 2 — Watch Stream
# ─────────────────────────────────────────────
with tab_watch:
    cached_channels = st.session_state.get('twitch_cache', [])
    live_channels = []

    if cached_channels:
        with st.spinner("Checking live status..."):
            for channel in cached_channels:
                if check_live_status(channel):
                    live_channels.append(channel)

    if not cached_channels:
        st.info("👈 Add Twitch channels in the Configuration tab to start monitoring.")
    elif not live_channels:
        st.info(f"No tracked channels are currently live. Monitoring: {', '.join(cached_channels)}")
    else:
        selected_channel = st.selectbox("🔴 Live Now (Select to watch):", options=live_channels)

        if selected_channel:
            st.divider()
            col_vid, col_chat = st.columns([3, 1])

            with col_vid:
                video_url = f"https://player.twitch.tv/?channel={selected_channel}&parent={embed_parent}"
                st.iframe(video_url, height=650)

            with col_chat:
                chat_url = f"https://www.twitch.tv/embed/{selected_channel}/chat?parent={embed_parent}"
                st.iframe(chat_url, height=650)


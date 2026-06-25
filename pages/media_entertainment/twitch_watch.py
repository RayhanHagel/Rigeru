import streamlit as st
from streamlit_sortables import sort_items
from utilities.util_twitch import read_cache, save_config, get_all_live_statuses
from utilities.util_persistent import get_sortables_style


# --- State Initialization ---
if 'twitch_cache' not in st.session_state:
    st.session_state.twitch_cache = read_cache()
if 'cold_start_complete' not in st.session_state:
    st.session_state.cold_start_complete = False
if 'embed_parent' not in st.session_state:
    st.session_state.embed_parent = "localhost"
if 'refresh_interval' not in st.session_state:
    st.session_state.refresh_interval = 5

st.header(":material/tv: Twitch Watch")
st.markdown("Monitor your tracked streamers and watch live directly from your dashboard.")

view_selection = st.radio(
    label="Navigation",
    options=[":material/settings: Configuration", ":material/live_tv: Watch Stream"],
    horizontal=True,
    label_visibility="collapsed"
)




# ─────────────────────────────────────────────
# Fragment: The Auto-Updating Live Checker
# ─────────────────────────────────────────────
@st.fragment(run_every=st.session_state.refresh_interval * 60)
def render_twitch_player(cached_channels, embed_parent):
    with st.spinner("Syncing live status..."):
        live_channels = get_all_live_statuses(tuple(cached_channels))

    if not live_channels:
        st.info(f"No tracked channels are currently live. Monitoring: {', '.join(cached_channels)}")
    else:
        selected_channel = st.selectbox(":material/radio_button_checked: Live Now (Select to watch):", options=live_channels)
        if selected_channel:
            st.divider()
            col_vid, col_chat = st.columns([3, 1])
            with col_vid:
                video_url = f"https://player.twitch.tv/?channel={selected_channel}&parent={embed_parent}"
                st.iframe(video_url, height=650)
            with col_chat:
                chat_url = f"https://www.twitch.tv/embed/{selected_channel}/chat?parent={embed_parent}"
                st.iframe(chat_url, height=650)


# ─────────────────────────────────────────────
# Configuration View
# ─────────────────────────────────────────────
if view_selection == ":material/settings: Configuration":
    st.subheader("General Settings")
    col_interval, col_domain = st.columns(2)
    
    st.session_state.refresh_interval = col_interval.slider(
        "Auto-Refresh Interval (minutes)", 
        min_value=1, max_value=15, 
        value=st.session_state.refresh_interval
    )

    st.session_state.embed_parent = col_domain.text_input(
        "Embed Parent Domain",
        value=st.session_state.embed_parent,
        help="Change to your host IP if accessing from another device (e.g., 192.168.1.50)"
    )

    st.divider()
    st.subheader("Manage Channels")
    
    # --- 1. Add Channel ---
    col_input, col_add_btn = st.columns([4, 1], vertical_alignment="bottom")
    new_channel = col_input.text_input("Add New Channel", placeholder="e.g., shroud", label_visibility="collapsed")
    if col_add_btn.button(":material/add: Add", width="stretch"):
        clean_channel = new_channel.strip().lower()
        if clean_channel and clean_channel not in st.session_state.twitch_cache:
            st.session_state.twitch_cache.append(clean_channel)
            save_config(channel="", replace_data=st.session_state.twitch_cache)
            st.rerun()

    # --- 2. Drag and Drop Sort ---
    st.caption("Drag and drop to reorder priority. Top = highest priority.")
    current_channels = st.session_state.get('twitch_cache', [])
    
    if current_channels:
        # The drag and drop component
        sorted_channels = sort_items(current_channels, custom_style=get_sortables_style())
        col_save, col_clear = st.columns(2)
        
        if col_save.button(":material/save: Save New Order", width="stretch"):
            save_config(channel="", replace_data=sorted_channels)
            st.session_state.twitch_cache = sorted_channels
            st.success("New order saved!")
            st.rerun()

        if col_clear.button(":material/delete: Clear All", width="stretch"):
            save_config(channel="", replace_data=[])
            st.session_state.twitch_cache = []
            st.rerun()

        # --- 3. Remove Channels ---
        st.divider()
        st.markdown("**Remove Channels:**")
        for ch in current_channels:
            col_name, col_rm_btn = st.columns([5, 1], vertical_alignment="center")
            col_name.markdown(f"**{ch}**")
            
            if col_rm_btn.button(":material/close: Remove", key=f"rm_{ch}", width="stretch"):
                updated = [c for c in current_channels if c != ch]
                save_config(channel="", replace_data=updated)
                st.session_state.twitch_cache = updated
                st.rerun()
    else:
        st.info("No channels tracked yet.")


# ─────────────────────────────────────────────
# Watch Stream View
# ─────────────────────────────────────────────
elif view_selection == ":material/live_tv: Watch Stream":
    cached_channels = st.session_state.get('twitch_cache', [])

    if not cached_channels:
        st.info(":material/arrow_back: Add Twitch channels in the Configuration tab to start monitoring.")
    elif not st.session_state.cold_start_complete:
        st.info(":material/rocket_launch: Booting up Twitch Watch... checking live status.")
    else:
        render_twitch_player(cached_channels, st.session_state.embed_parent)


if not st.session_state.cold_start_complete:
    st.session_state.cold_start_complete = True
    st.rerun()
import os
import json
import concurrent.futures
import streamlit as st
from utilities.util_network import better_get
from streamlit.runtime.scriptrunner import add_script_run_ctx, get_script_run_ctx


CACHE_FOLDER = os.path.join("cache", "twitch")
PRIORITY_FILE = os.path.join(CACHE_FOLDER, "twitch_priority.json")


def check_live_status(channel: str) -> bool:
    """Checks if a Twitch channel is currently live by scraping the metadata."""
    if not channel:
        return False

    response = better_get(f'https://www.twitch.tv/{channel}', timeout=5)
    if response is None:
        return False

    return 'isLiveBroadcast' in response.content.decode('utf-8', errors='ignore')


@st.cache_data(ttl=5*60)
def get_all_live_statuses(channels: tuple) -> list:
    """Fetches all live statuses concurrently and caches the ENTIRE list."""
    live_channels = []
    ctx = get_script_run_ctx()

    def thread_safe_check(channel):
        add_script_run_ctx(ctx=ctx)
        return check_live_status(channel)

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(channels) or 1) as executor:
        future_to_channel = {executor.submit(thread_safe_check, ch): ch for ch in channels}
        for future in concurrent.futures.as_completed(future_to_channel):
            channel = future_to_channel[future]
            try:
                if future.result():
                    live_channels.append(channel)
            except Exception:
                pass
                
    return live_channels


def read_cache() -> list:
    """Reads the saved Twitch channel priority list."""
    if os.path.exists(PRIORITY_FILE):
        try:
            with open(PRIORITY_FILE, "r") as file:
                return json.load(file)
        except Exception:
            pass

    # Initialize clean cache if it doesn't exist
    os.makedirs(CACHE_FOLDER, exist_ok=True)
    with open(PRIORITY_FILE, 'w') as f:
        json.dump([], f, indent=4)
    return []


def save_config(channel: str, replace_data: list = None):
    """Saves a new channel or a completely new list to the cache."""
    os.makedirs(CACHE_FOLDER, exist_ok=True)

    if replace_data is None:
        if channel not in st.session_state.get('twitch_cache', []):
            if 'twitch_cache' not in st.session_state:
                st.session_state.twitch_cache = read_cache()
            st.session_state.twitch_cache.append(channel)

        with open(PRIORITY_FILE, "w") as f:
            json.dump(st.session_state.twitch_cache, f, indent=4)
    else:
        with open(PRIORITY_FILE, "w") as f:
            json.dump(replace_data, f, indent=4)
        st.session_state.twitch_cache = replace_data
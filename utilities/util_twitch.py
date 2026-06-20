import os
import json
import streamlit as st
from utilities.util_network import better_get


@st.cache_data(ttl=5*60)
def check_live_status(channel: str) -> bool:
    """Checks if a Twitch channel is currently live by scraping the metadata."""
    if not channel:
        return False

    # 5 second timeout so the UI doesn't hang if Twitch is blocking us
    response = better_get(f'https://www.twitch.tv/{channel}', timeout=5)
    if response is None:
        return False

    return 'isLiveBroadcast' in response.content.decode('utf-8', errors='ignore')


def read_cache() -> list:
    """Reads the saved Twitch channel priority list."""
    path = "./cache/twitch_priority.json"

    if os.path.exists(path):
        try:
            with open(path, "r") as file:
                return json.load(file)
        except Exception:
            pass

    # Initialize clean cache if it doesn't exist
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump([], f, indent=4)
    return []


def save_config(channel: str, replace_data: list = None):
    """Saves a new channel or a completely new list to the cache."""
    config_path = "./cache/twitch_priority.json"
    os.makedirs(os.path.dirname(config_path), exist_ok=True)

    if replace_data is None:
        if channel not in st.session_state.get('twitch_cache', []):
            if 'twitch_cache' not in st.session_state:
                st.session_state.twitch_cache = read_cache()
            st.session_state.twitch_cache.append(channel)

        with open(config_path, "w") as f:
            json.dump(st.session_state.twitch_cache, f, indent=4)
    else:
        with open(config_path, "w") as f:
            json.dump(replace_data, f, indent=4)
        st.session_state.twitch_cache = replace_data

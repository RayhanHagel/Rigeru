import os
import json
import concurrent.futures
from utilities.util_network import better_get
from utilities.util_json import load_json


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


def get_all_live_statuses(channels: tuple) -> list:
    """Fetches all live statuses concurrently."""
    live_channels = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(channels) or 1) as executor:
        future_to_channel = {executor.submit(check_live_status, ch): ch for ch in channels}
        for future in concurrent.futures.as_completed(future_to_channel):
            channel = future_to_channel[future]
            try:
                if future.result():
                    live_channels.append(channel)
            except Exception:
                pass
                
    # Sort by the original priority order
    return sorted(live_channels, key=lambda ch: channels.index(ch))


def read_cache() -> list:
    """Reads the saved Twitch channel priority list."""
    data = load_json(PRIORITY_FILE, lambda: None)
    if data is not None:
        return data

    # Initialize clean cache if it doesn't exist
    os.makedirs(CACHE_FOLDER, exist_ok=True)
    with open(PRIORITY_FILE, 'w') as f:
        json.dump([], f, indent=4)
    return []


def save_config(channel: str, replace_data: list = None):
    """Saves a new channel or a completely new list to the cache."""
    os.makedirs(CACHE_FOLDER, exist_ok=True)
    
    current_cache = read_cache()

    if replace_data is None:
        if channel and channel not in current_cache:
            current_cache.append(channel)

        with open(PRIORITY_FILE, "w") as f:
            json.dump(current_cache, f, indent=4)
    else:
        with open(PRIORITY_FILE, "w") as f:
            json.dump(replace_data, f, indent=4)
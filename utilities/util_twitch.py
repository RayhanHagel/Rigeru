import os
import concurrent.futures
from utilities.util_network import better_get
from utilities.util_store import get_data, set_data


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
    return get_data("twitch_priority") or []


def save_config(channel: str, replace_data: list = None):
    """Saves a new channel or a completely new list to the store."""
    current_cache = read_cache()

    if replace_data is None:
        if channel and channel not in current_cache:
            current_cache.append(channel)
        replace_data = current_cache

    set_data("twitch_priority", replace_data)


import subprocess
import sys

def check_streamlink_installed() -> bool:
    try:
        subprocess.run(["streamlink", "--version"], check=True, capture_output=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False

def install_streamlink() -> bool:
    try:
        subprocess.run(["scoop.cmd", "install", "streamlink"], check=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False

def launch_streamlink(channel: str) -> bool:
    try:
        # 0x08000000 is CREATE_NO_WINDOW
        subprocess.Popen(
            ["streamlink", f"twitch.tv/{channel}", "best"],
            creationflags=0x08000000
        )
        return True
    except Exception:
        return False
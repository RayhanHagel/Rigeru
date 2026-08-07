import os
from utilities.util_store import get_data, set_data


# Import the list functions to execute in the background
from utilities.util_package_winget import list_installed as list_winget_installed
from utilities.util_package_scoop import list_installed as list_scoop_installed
from utilities.util_package_choco import list_installed as list_choco_installed


def load_local_cache() -> dict:
    """Loads the stale packages instantly from the store."""
    return get_data("installed_packages") or {"winget": [], "scoop": [], "choco": []}


def save_local_cache(data: dict):
    """Saves the fresh packages to the store."""
    set_data("installed_packages", data)

def fetch_all_fresh_data(current_cache: dict) -> dict:
    """Runs the slow CLI commands sequentially and returns the updated dataset."""
    w_success, w_apps = list_winget_installed()
    s_success, s_apps = list_scoop_installed()
    c_success, c_apps = list_choco_installed()

    # If a CLI command fails (e.g., winget is busy), fallback to the existing cache for that tool
    return {
        "winget": w_apps if w_success else current_cache.get("winget", []),
        "scoop": s_apps if s_success else current_cache.get("scoop", []),
        "choco": c_apps if c_success else current_cache.get("choco", [])
    }
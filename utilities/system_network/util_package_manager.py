import os
from typing import Any
from utilities.core.util_store import get_data, set_data


# Import the list functions to execute in the background
from utilities.system_network.util_package_winget import list_installed as list_winget_installed
from utilities.system_network.util_package_scoop import list_installed as list_scoop_installed
from utilities.system_network.util_package_choco import list_installed as list_choco_installed


def load_local_cache() -> dict[str, Any]:
    """

            Load installed package inventories from the SQLite store cache.

            Returns:
                dict[str, Any]: Dictionary mapping manager names ('winget', 'scoop', 'choco') to lists of packages.
            
    """
    return get_data("installed_packages") or {"winget": [], "scoop": [], "choco": []}


def save_local_cache(data: dict[str, Any]) -> None:
    """

            Persist discovered installed package inventories to the SQLite store cache.

            Args:
                data (dict[str, Any]): Package lists dictionary by manager.

            Returns:
                None
            
    """
    set_data("installed_packages", data)

def fetch_all_fresh_data(current_cache: dict[str, Any]) -> dict[str, Any]:
    """

            Execute CLI discovery commands across WinGet, Scoop, and Chocolatey, falling back to cache on failure.

            Args:
                current_cache (dict[str, Any]): Existing package snapshot cache.

            Returns:
                dict[str, Any]: Updated package inventories by manager.
            
    """
    w_success, w_apps = list_winget_installed()
    s_success, s_apps = list_scoop_installed()
    c_success, c_apps = list_choco_installed()

    # If a CLI command fails (e.g., winget is busy), fallback to the existing cache for that tool
    return {
        "winget": w_apps if w_success else current_cache.get("winget", []),
        "scoop": s_apps if s_success else current_cache.get("scoop", []),
        "choco": c_apps if c_success else current_cache.get("choco", [])
    }

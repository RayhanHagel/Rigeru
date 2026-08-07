import os
from utilities.util_store import get_data, set_data

def get_quick_cache_data() -> list:
    """Returns the quick cache data for the dashboard."""
    return get_data("frontend_preferences").get("quick_navigation", []) if get_data("frontend_preferences") else []

def save_quick_cache_data(items: list) -> None:
    """Updates the quick cache order."""
    data = get_data("frontend_preferences") or {}
    data["quick_navigation"] = items
    set_data("frontend_preferences", data)

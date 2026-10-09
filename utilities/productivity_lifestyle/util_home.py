import os
from utilities.core.util_store import get_data, set_data

def get_quick_cache_data() -> list:
    """Returns the quick navigation cache data for the dashboard.

    Returns:
        list: List of quick navigation item dictionaries.
    """
    return get_data("frontend_preferences").get("quick_navigation", []) if get_data("frontend_preferences") else []

def save_quick_cache_data(items: list) -> None:
    """Updates the quick navigation items and cache order.

    Args:
        items (list): Ordered list of navigation item dicts to store.

    Returns:
        None
    """
    data = get_data("frontend_preferences") or {}
    data["quick_navigation"] = items
    set_data("frontend_preferences", data)

import os
from utilities.util_json import load_json, save_json

def get_quick_cache_data() -> list:
    """Returns the quick cache data for the dashboard."""
    path = "./cache/quick_navigation.json"
    if not os.path.exists(path):
        return []
    return load_json(path, default_factory=list)

def save_quick_cache_data(items: list) -> None:
    """Updates the quick cache order."""
    path = "./cache/quick_navigation.json"
    save_json(path, items)

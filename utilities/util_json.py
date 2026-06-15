import os
import json

def load_json(filepath: str, default_factory=dict):
    """
    Safely loads a JSON file from disk. 
    If the file does not exist or is corrupted, returns the default_factory (usually an empty dict or list).
    """
    if not os.path.exists(filepath):
        return default_factory()
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default_factory()

def save_json(filepath: str, data):
    """
    Safely saves data to a JSON file, creating parent directories if they don't exist.
    """
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4)
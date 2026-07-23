import os
import json
from functools import lru_cache

CONFIG_FILE = os.path.join(".", "cache", "models_config.json")

# Default global configurations
DEFAULT_CONFIG = {
    "expense_tracker": "Qwen/Qwen2-VL-2B-Instruct",
    "math_latex": "prithivMLmods/Qwen2-VL-OCR-2B-Instruct",
    "audio_transcription": "base",
    "speaker_diarization": "pyannote/speaker-diarization-3.1",
    "object_detection": "yolov8n.pt",
    "face_blur": "buffalo_l",
    "background_removal": "u2net",
    "device_preference": "Auto-Detect",
    "hardware_optimization": "PyTorch (Standard)"
}

def load_all_config() -> dict:
    if not os.path.exists(CONFIG_FILE):
        return DEFAULT_CONFIG.copy()
        
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Merge with defaults to ensure all keys exist
            merged = DEFAULT_CONFIG.copy()
            merged.update(data)
            return merged
    except Exception:
        return DEFAULT_CONFIG.copy()

def save_all_config(config: dict):
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=4)

def get_model_config(key: str) -> str:
    """Returns the current model selected for the given feature key."""
    config = load_all_config()
    return config.get(key, DEFAULT_CONFIG.get(key, ""))

def set_model_config(key: str, val: str):
    config = load_all_config()
    config[key] = val
    save_all_config(config)

import os
from functools import lru_cache
from utilities.util_store import get_data, set_data

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
    "hardware_optimization": "PyTorch (Standard)",
    "obsidian_provider": "Hugging Face API",
    "obsidian_ollama_model": "llama3:8b-instruct-q4_K_M",
    "obsidian_scraper_max_urls": "2",
    "obsidian_context_length": "8192",
    "obsidian_embedding_model": "nomic-embed-text",
    "obsidian_summarize_searches": "false",
    "voice_cloning_tts": "k2-fsa/OmniVoice"
}

def load_all_config() -> dict:
    """
    Loads all configurations from the ai_settings models namespace.
    Merges saved configurations with default values.
    """
    ai_settings = get_data("ai_settings") or {}
    data = ai_settings.get("models", {})
    if not data:
        return DEFAULT_CONFIG.copy()
        
    merged = DEFAULT_CONFIG.copy()
    merged.update(data)
    return merged

def save_all_config(config: dict):
    """
    Saves the provided configuration dictionary to the ai_settings namespace.
    """
    ai_settings = get_data("ai_settings") or {}
    ai_settings["models"] = config
    set_data("ai_settings", ai_settings)

def get_model_config(key: str) -> str:
    """Returns the current model selected for the given feature key."""
    config = load_all_config()
    return config.get(key, DEFAULT_CONFIG.get(key, ""))

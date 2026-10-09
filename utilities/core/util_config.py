import os
from functools import lru_cache
from typing import Any, Dict
from utilities.core.util_store import get_data, set_data

# Default global configurations
DEFAULT_CONFIG: dict[str, str] = {
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
    "voice_cloning_tts": "k2-fsa/OmniVoice",
    "searxng_url": "http://127.0.0.1:8080/search",
    "searxng_use_local_docker": "true"
}

def load_all_config() -> dict[str, str]:
    """
    Load all machine learning and system configurations, falling back to defaults for missing keys.

    Returns:
        dict[str, str]: Merged configuration dictionary mapping feature keys to active models.
    """
    ai_settings = get_data("ai_settings") or {}
    data = ai_settings.get("models", {})
    if not data:
        return DEFAULT_CONFIG.copy()
        
    merged = DEFAULT_CONFIG.copy()
    merged.update(data)
    return merged

def save_all_config(config: dict[str, str]) -> None:
    """
    Persist the updated configuration dictionary under the ai_settings namespace.

    Args:
        config (dict[str, str]): Key-value model configuration pairs to save.

    Returns:
        None
    """
    ai_settings = get_data("ai_settings") or {}
    ai_settings["models"] = config
    set_data("ai_settings", ai_settings)

def get_model_config(key: str) -> str:
    """
    Query the active model architecture or hardware preference configuration for a given feature key.

    Args:
        key (str): Feature setting identifier (e.g. 'object_detection', 'face_blur').

    Returns:
        str: Model identifier string or setting value.
    """
    config = load_all_config()
    return config.get(key, DEFAULT_CONFIG.get(key, ""))

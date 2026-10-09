"""Utilities package for Rigeru.

Provides grouped utilities for core primitives, audio/video, computer vision,
documents, file tools, system/network, web downloaders, entertainment, and productivity.
Includes full backward compatibility aliases for legacy imports.
"""

import importlib
import importlib.abc
import importlib.machinery
import sys

# Mapping of legacy utility module names to new grouped subpackage locations
LEGACY_MODULE_MAP = {
    # Core
    "util_config": "utilities.core.util_config",
    "util_store": "utilities.core.util_store",
    "util_device": "utilities.core.util_device",
    "util_network": "utilities.core.util_network",
    "util_tor": "utilities.core.util_tor",
    "util_huggingface": "utilities.core.util_huggingface",
    "util_os": "utilities.core.util_os",
    "util_stream": "utilities.core.util_stream",
    "util_time_format": "utilities.core.util_time_format",
    "util_preview": "utilities.core.util_preview",

    # Audio & Video
    "util_audio": "utilities.audio_video.util_audio",
    "util_ffmpeg": "utilities.audio_video.util_ffmpeg",
    "util_video_stream": "utilities.audio_video.util_video_stream",
    "util_noise_reduction": "utilities.audio_video.util_noise_reduction",
    "util_subtitles": "utilities.audio_video.util_subtitles",
    "util_ass_merger": "utilities.audio_video.util_ass_merger",
    "util_tts": "utilities.audio_video.util_tts",

    # Vision
    "util_face_blur": "utilities.vision.util_face_blur",
    "util_face_blur_folder": "utilities.vision.util_face_blur_folder",
    "util_object_detect": "utilities.vision.util_object_detect",
    "util_depth_estimation": "utilities.vision.util_depth_estimation",
    "util_censor": "utilities.vision.util_censor",
    "util_bg_remove": "utilities.vision.util_bg_remove",
    "util_upscale": "utilities.vision.util_upscale",
    "util_image_compress": "utilities.vision.util_image_compress",
    "util_image_fx": "utilities.vision.util_image_fx",
    "util_code_image": "utilities.vision.util_code_image",
    "util_color_picker": "utilities.vision.util_color_picker",
    "util_fisheye": "utilities.vision.util_fisheye",
    "util_pinhole": "utilities.vision.util_pinhole",
    "util_virtual_camera": "utilities.vision.util_virtual_camera",
    "util_webcam_fx": "utilities.vision.util_webcam_fx",

    # Documents
    "util_pdf_advanced": "utilities.documents.util_pdf_advanced",
    "util_pdf_compress": "utilities.documents.util_pdf_compress",
    "util_pdf_convert": "utilities.documents.util_pdf_convert",
    "util_pdf_diff": "utilities.documents.util_pdf_diff",
    "util_pdf_images": "utilities.documents.util_pdf_images",
    "util_pdf_metadata": "utilities.documents.util_pdf_metadata",
    "util_pdf_ops": "utilities.documents.util_pdf_ops",
    "util_pdf_redact": "utilities.documents.util_pdf_redact",
    "util_pdf_search": "utilities.documents.util_pdf_search",
    "util_pdf_security": "utilities.documents.util_pdf_security",
    "util_pdf_sign": "utilities.documents.util_pdf_sign",
    "util_pdf_web": "utilities.documents.util_pdf_web",
    "util_cv_builder": "utilities.documents.util_cv_builder",
    "util_excel": "utilities.documents.util_excel",
    "util_charts": "utilities.documents.util_charts",
    "util_math_latex": "utilities.documents.util_math_latex",
    "util_whiteboard": "utilities.documents.util_whiteboard",
    "util_obsidian_agent": "utilities.documents.util_obsidian_agent",

    # File Tools
    "util_everything": "utilities.file_tools.util_everything",
    "util_file_explorer": "utilities.file_tools.util_file_explorer",
    "util_file_mover": "utilities.file_tools.util_file_mover",
    "util_hash": "utilities.file_tools.util_hash",
    "util_exif": "utilities.file_tools.util_exif",
    "util_metadata": "utilities.file_tools.util_metadata",

    # System & Network
    "bluetooth_tracker": "utilities.system_network.bluetooth_tracker",
    "lan_radar": "utilities.system_network.lan_radar",
    "wifi_mapper": "utilities.system_network.wifi_mapper",
    "windows_tweaks": "utilities.system_network.windows_tweaks",
    "util_tracker": "utilities.system_network.util_tracker",
    "util_ping": "utilities.system_network.util_ping",
    "util_network_monitor": "utilities.system_network.util_network_monitor",
    "util_docker": "utilities.system_network.util_docker",
    "util_env": "utilities.system_network.util_env",
    "util_services": "utilities.system_network.util_services",
    "util_sys_monitor": "utilities.system_network.util_sys_monitor",
    "util_package_base": "utilities.system_network.util_package_base",
    "util_package_manager": "utilities.system_network.util_package_manager",
    "util_package_winget": "utilities.system_network.util_package_winget",
    "util_package_choco": "utilities.system_network.util_package_choco",
    "util_package_scoop": "utilities.system_network.util_package_scoop",

    # Web
    "util_yt": "utilities.web.util_yt",
    "util_yt_rss": "utilities.web.util_yt_rss",
    "util_spotify_download": "utilities.web.util_spotify_download",
    "util_rss": "utilities.web.util_rss",
    "util_scraper": "utilities.web.util_scraper",
    "util_crawler": "utilities.web.util_crawler",
    "util_playwright": "utilities.web.util_playwright",
    "util_price_monitor": "utilities.web.util_price_monitor",
    "util_mega": "utilities.web.util_mega",

    # Entertainment
    "util_manga": "utilities.entertainment.util_manga",
    "util_manga_db": "utilities.entertainment.util_manga_db",
    "util_malsync": "utilities.entertainment.util_malsync",
    "util_twitch": "utilities.entertainment.util_twitch",
    "util_spotify_listening": "utilities.entertainment.util_spotify_listening",

    # Productivity & Lifestyle
    "util_korean_srs": "utilities.productivity_lifestyle.util_korean_srs",
    "util_expense": "utilities.productivity_lifestyle.util_expense",
    "util_qr": "utilities.productivity_lifestyle.util_qr",
    "util_currency": "utilities.productivity_lifestyle.util_currency",
    "util_home": "utilities.productivity_lifestyle.util_home",
    "util_ai_tools": "utilities.productivity_lifestyle.util_ai_tools",
    "util_llm_chat": "utilities.productivity_lifestyle.util_llm_chat",
    "util_nlp": "utilities.productivity_lifestyle.util_nlp",
}

class _LegacyAliasLoader(importlib.abc.Loader):
    def __init__(self, target_module_name: str):
        self.target_module_name = target_module_name

    def create_module(self, spec):
        mod = importlib.import_module(self.target_module_name)
        sys.modules[spec.name] = mod
        return mod

    def exec_module(self, module):
        pass

class _LegacyAliasFinder(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path, target=None):
        if fullname.startswith("utilities."):
            subname = fullname[len("utilities."):]
            if subname in LEGACY_MODULE_MAP:
                target = LEGACY_MODULE_MAP[subname]
                return importlib.machinery.ModuleSpec(fullname, _LegacyAliasLoader(target))
        return None

# Register meta path finder for backward-compatible submodule imports
if not any(isinstance(finder, _LegacyAliasFinder) for finder in sys.meta_path):
    sys.meta_path.insert(0, _LegacyAliasFinder())

def __getattr__(name: str):
    """Dynamic attribute lookup to support `from utilities import util_xxx` and `utilities.util_xxx`."""
    if name in LEGACY_MODULE_MAP:
        target = LEGACY_MODULE_MAP[name]
        mod = importlib.import_module(target)
        sys.modules[f"utilities.{name}"] = mod
        globals()[name] = mod
        return mod
    raise AttributeError(f"module 'utilities' has no attribute '{name}'")

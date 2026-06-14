import streamlit as st
import os

from utilities.util_manga import read_cache as manga_rc
from utilities.util_quick import read_cache as quick_rc
from utilities.util_twitch import read_cache as twitch_rc
from utilities.util_persistent import apply_logo, apply_theme, render_theme_selector


# -- If Logging is Needed --
logging_state = False
if logging_state:
    import time
    import logging
    logging.basicConfig(
        filename="app.log",
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s"
    )

# --- Session State Initialization ---
if "quick_cache" not in st.session_state:
    st.session_state.quick_cache = quick_rc()

if "manga_cache" not in st.session_state:
    st.session_state.manga_cache = manga_rc()

if "twitch_cache" not in st.session_state:
    st.session_state.twitch_cache = twitch_rc()


# --- Page Routing Definitions (Updated to match new folder structure) ---

st.session_state.nav_home = {
    "quick_home":  os.path.join("pages", "home", "home.py"),
    "quick_sort":  os.path.join("pages", "home", "sort.py"),
}

st.session_state.nav_manga = { 
    "manga_search":  os.path.join("pages", "media_entertainment", "manga_search.py"),
    "manga_library": os.path.join("pages", "media_entertainment", "manga_library.py"),
}

st.session_state.nav_media_feeds = { 
    "twitch_player":     os.path.join("pages", "media_entertainment", "twitch_watch.py"),
    "spotify_scrobbler": os.path.join("pages", "media_entertainment", "spotify_listen.py"),
    "youtube":           os.path.join("pages", "web_downloads", "youtube_download.py"),
    "spotify":           os.path.join("pages", "web_downloads", "spotify_download.py"),
    "rss":               os.path.join("pages", "web_downloads", "rss_manager.py"),
}

st.session_state.nav_file_mgmt = { 
    "file_mover":   os.path.join("pages", "files_documents", "file_organizer.py"),
    "hash":         os.path.join("pages", "files_documents", "hash_integrity.py"),
    "mega_cleaner": os.path.join("pages", "files_documents", "mega_cleaner.py"),
    "doc_search":   os.path.join("pages", "files_documents", "document_search.py"),
}

st.session_state.nav_metadata = { 
    "media_tags": os.path.join("pages", "subtitles_metadata", "media_tags.py"),
    "timestamps": os.path.join("pages", "subtitles_metadata", "file_timestamps.py"),
}

st.session_state.nav_media_proc = { 
    "media":        os.path.join("pages", "media_vision_processing", "media_compressor.py"),
    "upscaler":     os.path.join("pages", "media_vision_processing", "image_upscaler.py"),
    "color_picker": os.path.join("pages", "media_vision_processing", "color_picker.py"),
    "bg_remove":    os.path.join("pages", "media_vision_processing", "background_remove.py"),
    "face_blur":    os.path.join("pages", "media_vision_processing", "face_blur.py"),
    "depth_estimate": os.path.join("pages", "media_vision_processing", "depth_estimation.py"),
    "audio":        os.path.join("pages", "subtitles_metadata", "subtitle_studio.py"),
    "exif":         os.path.join("pages", "subtitles_metadata", "exif_remover.py"),
    "sub_fetcher":  os.path.join("pages", "subtitles_metadata", "subtitle_fetcher.py"),
    "sub_merger":   os.path.join("pages", "subtitles_metadata", "subtitle_merger.py"),
}

st.session_state.nav_system = { 
    "scoop":    os.path.join("pages", "system_network", "scoop_manager.py"),
    "winget":   os.path.join("pages", "system_network", "winget_manager.py"),
    "choco":    os.path.join("pages", "system_network", "chocolatey_manager.py"),
    "env":      os.path.join("pages", "system_network", "environment_variable_manager.py"),
    "services": os.path.join("pages", "system_network", "services.py"),
    "network":  os.path.join("pages", "system_network", "network_monitor.py"),
    "ping":     os.path.join("pages", "system_network", "ping_test.py"),
    "monitor":  os.path.join("pages", "system_network", "system_monitor.py"),
    "docker":   os.path.join("pages", "system_network", "docker_manager.py"),
}

st.session_state.nav_vision = { 
    "math_latex":    os.path.join("pages", "files_documents", "math_latex.py"),
    "expense":       os.path.join("pages", "files_documents", "expense_tracker.py"),
    "object_detect": os.path.join("pages", "media_vision_processing", "object_detect.py"),
    "nsfw_censor":   os.path.join("pages", "media_vision_processing", "vision_censor.py"),
}

st.session_state.nav_data_mgmt = { 
    "excel_cleaner": os.path.join("pages", "files_documents", "excel_cleaner.py"),
    "diff_checker":  os.path.join("pages", "files_documents", "data_diff.py"),
    "pdf_redact":    os.path.join("pages", "files_documents", "pdf_redact.py"),
}

st.session_state.nav_web_feeds = { 
    "malsync":       os.path.join("pages", "media_entertainment", "malsync.py"),
    "currency":      os.path.join("pages", "web_downloads", "currency_view.py"),
    "web_scraper":   os.path.join("pages", "web_downloads", "web_scraper.py"),
    "price_monitor": os.path.join("pages", "web_downloads", "price_monitor.py"),
    "yt_rss":        os.path.join("pages", "web_downloads", "youtube_rss.py"),
}

# --- UI Configuration ---
apply_logo()
render_theme_selector()
apply_theme()


# --- Streamlit Navigation Structure (Workflow Optimized) ---
pages = {
    "🏠 Dashboard": [
        st.Page(st.session_state.nav_home["quick_home"], title="Quick Navigation", icon=":material/bolt:"),
        st.Page(st.session_state.nav_home["quick_sort"], title="Quick Sort",       icon=":material/drag_pan:"),
    ],

    "📺 Media & Entertainment": [
        st.Page(st.session_state.nav_manga["manga_library"],       title="Manga Library",      icon=":material/menu_book:"),
        st.Page(st.session_state.nav_manga["manga_search"],        title="Manga Search",       icon=":material/search:"),
        st.Page(st.session_state.nav_media_feeds["twitch_player"], title="Twitch Watch",       icon=":material/live_tv:"),
        st.Page(st.session_state.nav_media_feeds["spotify_scrobbler"], title="Spotify Scrobbler", icon=":material/graphic_eq:"),
        st.Page(st.session_state.nav_web_feeds["malsync"],         title="MAL Local Tracker",  icon=":material/collections_bookmark:"),
    ],

    "📥 Web & Downloads": [
        st.Page(st.session_state.nav_media_feeds["youtube"], title="YouTube Downloader", icon=":material/smart_display:"),
        st.Page(st.session_state.nav_media_feeds["spotify"], title="Spotify Downloader", icon=":material/music_note:"),
        st.Page(st.session_state.nav_media_feeds["rss"],     title="RSS Feed Manager",   icon=":material/rss_feed:"),
        st.Page(st.session_state.nav_web_feeds["yt_rss"],    title="YouTube RSS Feed",   icon=":material/subscriptions:"),
        st.Page(st.session_state.nav_web_feeds["web_scraper"], title="Visual Scraper",   icon=":material/travel_explore:"),
        st.Page(st.session_state.nav_web_feeds["price_monitor"], title="Price Drop Monitor", icon=":material/trending_down:"),
        st.Page(st.session_state.nav_web_feeds["currency"],  title="Currency Tracker",   icon=":material/currency_exchange:"),
    ],

    "🎨 Media & Vision Processing": [
        st.Page(st.session_state.nav_media_proc["media"],        title="Image/Video Compressor", icon=":material/photo_library:"),
        st.Page(st.session_state.nav_media_proc["upscaler"],     title="AI Image Upscaler",      icon=":material/high_quality:"),
        st.Page(st.session_state.nav_media_proc["bg_remove"],    title="BG Remover",             icon=":material/layers_clear:"),
        st.Page(st.session_state.nav_media_proc["color_picker"], title="Color Picker",           icon=":material/colorize:"),
        st.Page(st.session_state.nav_media_proc["depth_estimate"], title="Depth Estimator",      icon=":material/lens_blur:"),
        st.Page(st.session_state.nav_vision["object_detect"],    title="Object Detection",       icon=":material/center_focus_strong:"),
        st.Page(st.session_state.nav_media_proc["face_blur"],    title="Face Blurring",          icon=":material/face_retouching_off:"),
        st.Page(st.session_state.nav_vision["nsfw_censor"],      title="Video Censor",           icon=":material/security:"),
    ],
    
    "📝 Subtitles & Metadata": [
        st.Page(st.session_state.nav_media_proc["audio"],       title="Subtitle Studio",      icon=":material/subtitles:"),
        st.Page(st.session_state.nav_media_proc["sub_fetcher"], title="Sub Fetcher",          icon=":material/closed_caption:"),
        st.Page(st.session_state.nav_media_proc["sub_merger"],  title="ASS Subtitle Merger",  icon=":material/merge:"),
        st.Page(st.session_state.nav_metadata["media_tags"],    title="Media Tags Editor",    icon=":material/audiotrack:"),
        st.Page(st.session_state.nav_metadata["timestamps"],    title="Timestamp Modifier",   icon=":material/update:"),
        st.Page(st.session_state.nav_media_proc["exif"],        title="EXIF Stripper",        icon=":material/visibility_off:"),
    ],

    "🗂️ Files & Documents": [
        st.Page(st.session_state.nav_file_mgmt["file_mover"],   title="File Mover",             icon=":material/drive_file_move:"),
        st.Page(st.session_state.nav_file_mgmt["doc_search"],   title="Document Search",        icon=":material/search:"),
        st.Page(st.session_state.nav_data_mgmt["pdf_redact"],   title="PDF Redactor",           icon=":material/ink_eraser:"),
        st.Page(st.session_state.nav_data_mgmt["excel_cleaner"], title="Excel Cleaner",         icon=":material/table_chart:"),
        st.Page(st.session_state.nav_data_mgmt["diff_checker"], title="Diff Checker",           icon=":material/difference:"),
        st.Page(st.session_state.nav_vision["expense"],         title="Receipt Scanner",        icon=":material/receipt_long:"),
        st.Page(st.session_state.nav_vision["math_latex"],      title="Math to LaTeX",          icon=":material/calculate:"),
        st.Page(st.session_state.nav_file_mgmt["hash"],         title="File Integrity Checker", icon=":material/security:"),
        st.Page(st.session_state.nav_file_mgmt["mega_cleaner"], title="Mega Link Cleaner",      icon=":material/folder_delete:"),
    ],

    "⚙️ System & Network": [
        st.Page(st.session_state.nav_system["scoop"],    title="Scoop Manager",         icon=":material/inventory_2:"),
        st.Page(st.session_state.nav_system["winget"],   title="Winget Manager",        icon=":material/widgets:"),
        st.Page(st.session_state.nav_system["choco"],    title="Chocolatey Manager",    icon=":material/cookie:"),
        st.Page(st.session_state.nav_system["docker"],   title="Docker Manager",        icon=":material/terminal:"),
        st.Page(st.session_state.nav_system["env"],      title="Environment Variables", icon=":material/account_tree:"),
        st.Page(st.session_state.nav_system["services"], title="Startup & Services",    icon=":material/speed:"),
        st.Page(st.session_state.nav_system["monitor"],  title="System Monitor",        icon=":material/memory:"),
        st.Page(st.session_state.nav_system["network"],  title="Network Monitor",       icon=":material/radar:"),
        st.Page(st.session_state.nav_system["ping"],     title="Ping Test",             icon=":material/network_ping:"),
    ],
}

# --- Initialization & Rendering ---
pg = st.navigation(pages=pages, expanded=False)

if logging_state:
    start_time = time.time()

pg.run()

if logging_state:
    end_time = time.time()
    load_duration = end_time - start_time
    with st.sidebar:
        st.divider()
        if load_duration > 1.5:
            st.error(f"🐢 Slow Load Detected: {load_duration:.3f}s")
        else:
            st.caption(f"⚡ Page Load Time: **{load_duration:.3f}s**")
    logging.info(f"Page execution cycle completed in {load_duration:.3f} seconds.")
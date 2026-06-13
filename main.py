import streamlit as st
import os

from utilities.util_manga import read_cache as manga_rc
from utilities.util_quick import read_cache as quick_rc
from utilities.util_twitch import read_cache as twitch_rc
from utilities.util_persistent import apply_logo, apply_theme


# --- Session State Initialization ---
if "quick_cache" not in st.session_state:
    st.session_state.quick_cache = quick_rc()

if "manga_cache" not in st.session_state:
    st.session_state.manga_cache = manga_rc()

if "twitch_cache" not in st.session_state:
    st.session_state.twitch_cache = twitch_rc()


# --- Page Routing Definitions ---

st.session_state.nav_home = {
    "quick_home":  os.path.join("pages", "home", "home.py"),
    "quick_sort":  os.path.join("pages", "home", "sort.py"),
}

st.session_state.nav_manga = {
    "manga_search": os.path.join("pages", "manga", "manga_search.py"),
    "manga_library": os.path.join("pages", "manga", "manga_library.py"),
}

st.session_state.nav_media_feeds = {
    "twitch_player":     os.path.join("pages", "media_feeds", "twitch_watch.py"),
    "spotify_scrobbler": os.path.join("pages", "media_feeds", "spotify_listen.py"),
    "youtube":           os.path.join("pages", "media_feeds",   "youtube_download.py"),
    "spotify":           os.path.join("pages", "media_feeds",   "spotify_download.py"),
    "rss":               os.path.join("pages", "media_feeds",   "rss_manager.py"),
}

st.session_state.nav_file_mgmt = {
    "file_mover": os.path.join("pages", "file_management", "file_organizer.py"),
    "hash":       os.path.join("pages", "file_management", "hash_integrity.py"),
    "mega_cleaner": os.path.join("pages", "file_management", "mega_cleaner.py"),
    "doc_search": os.path.join("pages", "file_management", "document_search.py"),
}

st.session_state.nav_metadata = {
    "media_tags": os.path.join("pages", "file_metadata", "media_tags.py"),
    "timestamps": os.path.join("pages", "file_metadata", "file_timestamps.py"),
}

st.session_state.nav_media_proc = {
    "media":    os.path.join("pages", "media_process", "media_compressor.py"),
    "upscaler": os.path.join("pages", "media_process", "image_upscaler.py"),
    "audio":    os.path.join("pages", "media_process", "subtitle_studio.py"),
    "color_picker": os.path.join("pages", "media_process", "color_picker.py"),
    "bg_remove":    os.path.join("pages", "media_process", "background_remove.py"),
    "exif":         os.path.join("pages", "media_process", "exif_remover.py"),
    "sub_fetcher":  os.path.join("pages", "media_process", "subtitle_fetcher.py"),
    "face_blur":    os.path.join("pages", "media_process", "face_blur.py"),
    "sub_merger":   os.path.join("pages", "media_process", "subtitle_merger.py"),
    "depth_estimate":   os.path.join("pages", "media_process", "depth_estimation.py"),
}

st.session_state.nav_system = {
    "scoop":    os.path.join("pages", "system", "scoop_manager.py"),
    "winget":   os.path.join("pages", "system", "winget_manager.py"),
    "choco":    os.path.join("pages", "system", "chocolatey_manager.py"),
    "env":      os.path.join("pages", "system", "environment_variable_manager.py"),
    "services": os.path.join("pages", "system", "services.py"),
    "network":  os.path.join("pages", "system", "network_monitor.py"),
    "ping":     os.path.join("pages", "system", "ping_test.py"),
    "monitor":  os.path.join("pages", "system", "system_monitor.py"),
    "docker":   os.path.join("pages", "system", "docker_manager.py"),
}

st.session_state.nav_vision = {
    "math_latex": os.path.join("pages", "vision", "math_latex.py"),
    "expense":    os.path.join("pages", "vision", "expense_tracker.py"),
    "object_detect": os.path.join("pages", "vision", "object_detect.py"),
    "nsfw_censor":   os.path.join("pages", "vision", "vision_censor.py"),
}

st.session_state.nav_data_mgmt = {
    "excel_cleaner": os.path.join("pages", "data_management", "excel_cleaner.py"),
    "diff_checker":  os.path.join("pages", "data_management", "data_diff.py"),
    "pdf_redact":    os.path.join("pages", "data_management", "pdf_redact.py"),
}

st.session_state.nav_web_feeds = {
    "currency": os.path.join("pages", "web_feeds", "currency_view.py"),
    "web_scraper":  os.path.join("pages", "web_feeds", "web_scraper.py"),
    "price_monitor": os.path.join("pages", "web_feeds", "price_monitor.py"),
    "malsync":       os.path.join("pages", "web_feeds", "malsync.py"),
    "yt_rss":        os.path.join("pages", "web_feeds", "youtube_rss.py"),
}

# --- UI Configuration ---
apply_logo()
apply_theme()


# --- Streamlit Navigation Structure ---
pages = {
    # Home: Quick Navigation + Quick Sort (moved from hidden)
    "🏠 Home": [
        st.Page(st.session_state.nav_home["quick_home"], title="Quick Navigation", icon=":material/bolt:"),
        st.Page(st.session_state.nav_home["quick_sort"],  title="Quick Sort",       icon=":material/drag_pan:"),
    ],

    # Manga: its own dedicated dropdown section
    "📚 Manga": [
        st.Page(st.session_state.nav_manga["manga_search"], title="Manga Search", icon=":material/search:"),
        st.Page(st.session_state.nav_manga["manga_library"], title="Reading Library", icon=":material/menu_book:"),
    ],

    "📡 Media & Feeds": [
        st.Page(st.session_state.nav_media_feeds["twitch_player"],     title="Twitch Watch",        icon=":material/live_tv:"),
        st.Page(st.session_state.nav_media_feeds["spotify_scrobbler"], title="Spotify Scrobbler",   icon=":material/graphic_eq:"),
        st.Page(st.session_state.nav_media_feeds["youtube"],           title="YouTube Downloader",  icon=":material/smart_display:"),
        st.Page(st.session_state.nav_media_feeds["spotify"],           title="Spotify Downloader",  icon=":material/music_note:"),
        st.Page(st.session_state.nav_media_feeds["rss"],               title="RSS Feed Manager",    icon=":material/rss_feed:"),
    ],

    "🗂️ File Management": [
        st.Page(st.session_state.nav_file_mgmt["file_mover"],   title="File Mover",            icon=":material/drive_file_move:"),
        st.Page(st.session_state.nav_file_mgmt["hash"],         title="File Integrity Checker",icon=":material/security:"),
        st.Page(st.session_state.nav_file_mgmt["mega_cleaner"], title="Mega Link Cleaner",     icon=":material/folder_delete:"),
        st.Page(st.session_state.nav_file_mgmt["doc_search"],   title="Document Search",       icon=":material/search:"),
    ],

    "🏷️ Metadata Tools": [
        st.Page(st.session_state.nav_metadata["media_tags"], title="Media Tags Editor",   icon=":material/audiotrack:"),
        st.Page(st.session_state.nav_metadata["timestamps"], title="Timestamp Modifier",  icon=":material/update:"),
    ],

    "🎞️ Media Processing": [
        st.Page(st.session_state.nav_media_proc["media"],     title="Image/Video Compressor", icon=":material/photo_library:"),
        st.Page(st.session_state.nav_media_proc["upscaler"],  title="AI Image Upscaler",      icon=":material/high_quality:"),
        st.Page(st.session_state.nav_media_proc["audio"],     title="Subtitle Studio",        icon=":material/subtitles:"),
        st.Page(st.session_state.nav_media_proc["color_picker"], title="Color Picker",        icon=":material/colorize:"),
        st.Page(st.session_state.nav_media_proc["bg_remove"],    title="BG Remover",      icon=":material/layers_clear:"),
        st.Page(st.session_state.nav_media_proc["exif"],         title="EXIF Stripper",   icon=":material/visibility_off:"),
        st.Page(st.session_state.nav_media_proc["sub_fetcher"],  title="Sub Fetcher",     icon=":material/closed_caption:"),
        st.Page(st.session_state.nav_media_proc["face_blur"],    title="Face Blurring",   icon=":material/face_retouching_off:"),
        st.Page(st.session_state.nav_media_proc["sub_merger"],   title="ASS Subtitle Merger", icon=":material/merge:"),
        st.Page(st.session_state.nav_media_proc["depth_estimate"],   title="Depth Estimator", icon=":material/lens_blur:"),
    ],

    "⚙️ System & Network": [
        st.Page(st.session_state.nav_system["scoop"],    title="Scoop Manager",         icon=":material/inventory_2:"),
        st.Page(st.session_state.nav_system["winget"],   title="Winget Manager",        icon=":material/widgets:"),
        st.Page(st.session_state.nav_system["choco"],    title="Chocolatey Manager",    icon=":material/cookie:"),
        st.Page(st.session_state.nav_system["env"],      title="Environment Variables", icon=":material/account_tree:"),
        st.Page(st.session_state.nav_system["services"], title="Startup & Services",    icon=":material/speed:"),
        st.Page(st.session_state.nav_system["network"],  title="Network Monitor",       icon=":material/radar:"),
        st.Page(st.session_state.nav_system["ping"],     title="Ping Test",             icon=":material/network_ping:"),
        st.Page(st.session_state.nav_system["monitor"],  title="System Monitor",        icon=":material/memory:"),
        st.Page(st.session_state.nav_system["docker"],   title="Docker Manager",        icon=":material/terminal:"),
    ],
    
    "🧠 AI & Vision Tools": [
        st.Page(st.session_state.nav_vision["math_latex"], title="Math to LaTeX", icon=":material/calculate:"),
        st.Page(st.session_state.nav_vision["expense"],    title="Receipt Scanner",   icon=":material/receipt_long:"),
        st.Page(st.session_state.nav_vision["object_detect"], title="Object Detection",  icon=":material/center_focus_strong:"),
        st.Page(st.session_state.nav_vision["nsfw_censor"],   title="Video Censor",       icon=":material/security:"),
    ],
    
    "📊 Data Management": [
        st.Page(st.session_state.nav_data_mgmt["excel_cleaner"], title="Excel Cleaner", icon=":material/table_chart:"),
        st.Page(st.session_state.nav_data_mgmt["diff_checker"],  title="Diff Checker",  icon=":material/difference:"),
        st.Page(st.session_state.nav_data_mgmt["pdf_redact"],    title="PDF Redactor",  icon=":material/ink_eraser:"),
    ],
    
    "🌐 Web & Trackers": [
        st.Page(st.session_state.nav_web_feeds["currency"], title="Currency Tracker", icon=":material/currency_exchange:"),
        st.Page(st.session_state.nav_web_feeds["web_scraper"], title="Visual Scraper",   icon=":material/travel_explore:"),
        st.Page(st.session_state.nav_web_feeds["price_monitor"], title="Price Drop Monitor", icon=":material/trending_down:"),
        st.Page(st.session_state.nav_web_feeds["malsync"],       title="MAL Local Tracker",  icon=":material/collections_bookmark:"),
        st.Page(st.session_state.nav_web_feeds["yt_rss"],        title="YouTube RSS Feed",   icon=":material/subscriptions:"),
    ],
}

# --- Initialization & Rendering ---
pg = st.navigation(pages=pages, expanded=False, position="top")
pg.run()

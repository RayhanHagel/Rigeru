import streamlit as st
import os
import time
from datetime import datetime
from utilities.util_persistent import apply_logo, apply_theme, render_theme_selector, apply_footer

# --- Page Routing Definitions (Categorized to match UI) ---

st.session_state.nav_dashboard = {
    "quick_home":  os.path.join("pages", "home", "home.py"),
}

st.session_state.nav_media_entertainment = { 
    "manga_library":     os.path.join("pages", "media_entertainment", "manga_library.py"),
    "twitch_player":     os.path.join("pages", "media_entertainment", "twitch_watch.py"),
    "spotify_scrobbler": os.path.join("pages", "media_entertainment", "spotify_listen.py"),
    "malsync":           os.path.join("pages", "media_entertainment", "malsync.py"),
}

st.session_state.nav_web_downloads = { 
    "youtube":           os.path.join("pages", "web_downloads", "youtube_download.py"),
    "spotify":           os.path.join("pages", "web_downloads", "spotify_download.py"),
    "rss":               os.path.join("pages", "web_downloads", "rss_manager.py"),
    "yt_rss":            os.path.join("pages", "web_downloads", "youtube_rss.py"),
    "web_scraper":       os.path.join("pages", "web_downloads", "web_scraper.py"),
    "price_monitor":     os.path.join("pages", "web_downloads", "price_monitor.py"),
    "currency":          os.path.join("pages", "web_downloads", "currency_view.py"),
}

st.session_state.nav_media_vision_processing = { 
    "media":             os.path.join("pages", "media_vision_processing", "media_compressor.py"),
    "upscaler":          os.path.join("pages", "media_vision_processing", "image_upscaler.py"),
    "bg_remove":         os.path.join("pages", "media_vision_processing", "background_remove.py"),
    "color_picker":      os.path.join("pages", "media_vision_processing", "color_picker.py"),
    "depth_estimate":    os.path.join("pages", "media_vision_processing", "depth_estimation.py"),
    "object_detect":     os.path.join("pages", "media_vision_processing", "object_detect.py"),
    "face_blur":         os.path.join("pages", "media_vision_processing", "face_blur.py"),
    "nsfw_censor":       os.path.join("pages", "media_vision_processing", "vision_censor.py"),
}

st.session_state.nav_subtitles_metadata = { 
    "audio":             os.path.join("pages", "subtitles_metadata", "subtitle_studio.py"),
    "sub_fetcher":       os.path.join("pages", "subtitles_metadata", "subtitle_fetcher.py"),
    "sub_merger":        os.path.join("pages", "subtitles_metadata", "subtitle_merger.py"),
    "media_tags":        os.path.join("pages", "subtitles_metadata", "media_tags.py"),
    "timestamps":        os.path.join("pages", "subtitles_metadata", "file_timestamps.py"),
    "exif":              os.path.join("pages", "subtitles_metadata", "exif_remover.py"),
}

st.session_state.nav_files_documents = { 
    "pdf_studio":        os.path.join("pages", "files_documents", "pdf_studio.py"),
    "file_mover":        os.path.join("pages", "files_documents", "file_organizer.py"),
    "excel_cleaner":     os.path.join("pages", "files_documents", "excel_cleaner.py"),
    "expense":           os.path.join("pages", "files_documents", "expense_tracker.py"),
    "math_latex":        os.path.join("pages", "files_documents", "math_latex.py"),
    "hash":              os.path.join("pages", "files_documents", "hash_integrity.py"),
    "mega_cleaner":      os.path.join("pages", "files_documents", "mega_cleaner.py"),
}

st.session_state.nav_system_network = {
    "package":           os.path.join("pages", "system_network", "package_manager.py"),
    "docker":            os.path.join("pages", "system_network", "docker_manager.py"),
    "env":               os.path.join("pages", "system_network", "environment_variable_manager.py"),
    "services":          os.path.join("pages", "system_network", "services.py"),
    "monitor":           os.path.join("pages", "system_network", "system_monitor.py"),
    "network":           os.path.join("pages", "system_network", "network_monitor.py"),
    "ping":              os.path.join("pages", "system_network", "ping_test.py"),
}

st.session_state.nav_hidden = {
    "quick_sort":        os.path.join("pages", "home", "sort.py"),
    "manga_search":      os.path.join("pages", "media_entertainment", "manga_search.py"),
    "manga_read":        os.path.join("pages", "media_entertainment", "manga_read.py"),
    "manga_sort":        os.path.join("pages", "media_entertainment", "manga_sort.py"),
    "manga_pdf":         os.path.join("pages", "media_entertainment", "manga_pdf.py")
}

# --- UI Configuration ---
apply_logo()
apply_theme()


# --- Streamlit Navigation Structure (Workflow Optimized) ---
pages = {
    ":material/home: Dashboard": [
        st.Page(st.session_state.nav_dashboard["quick_home"], title="Quick Navigation", icon=":material/bolt:")
    ],

    ":material/tv: Media & Entertainment": [
        st.Page(st.session_state.nav_media_entertainment["manga_library"],       title="Manga Library",      icon=":material/menu_book:"),
        st.Page(st.session_state.nav_media_entertainment["twitch_player"],       title="Twitch Watch",       icon=":material/live_tv:"),
        st.Page(st.session_state.nav_media_entertainment["spotify_scrobbler"],   title="Spotify Scrobbler",  icon=":material/graphic_eq:"),
        st.Page(st.session_state.nav_media_entertainment["malsync"],             title="MAL Local Tracker",  icon=":material/collections_bookmark:"),
    ],

    ":material/download: Web & Downloads": [
        st.Page(st.session_state.nav_web_downloads["youtube"],       title="YouTube Downloader", icon=":material/smart_display:"),
        st.Page(st.session_state.nav_web_downloads["spotify"],       title="Spotify Downloader", icon=":material/music_note:"),
        st.Page(st.session_state.nav_web_downloads["rss"],           title="RSS Feed Manager",   icon=":material/rss_feed:"),
        st.Page(st.session_state.nav_web_downloads["yt_rss"],        title="YouTube RSS Feed",   icon=":material/subscriptions:"),
        st.Page(st.session_state.nav_web_downloads["web_scraper"],   title="Visual Scraper",     icon=":material/travel_explore:"),
        st.Page(st.session_state.nav_web_downloads["price_monitor"], title="Price Drop Monitor", icon=":material/trending_down:"),
        st.Page(st.session_state.nav_web_downloads["currency"],      title="Currency Tracker",   icon=":material/currency_exchange:"),
    ],

    ":material/palette: Media & Vision Processing": [
        st.Page(st.session_state.nav_media_vision_processing["media"],          title="Image/Video Compressor", icon=":material/photo_library:"),
        st.Page(st.session_state.nav_media_vision_processing["upscaler"],       title="AI Image Upscaler",      icon=":material/high_quality:"),
        st.Page(st.session_state.nav_media_vision_processing["bg_remove"],      title="BG Remover",             icon=":material/layers_clear:"),
        st.Page(st.session_state.nav_media_vision_processing["color_picker"],   title="Color Picker",           icon=":material/colorize:"),
        st.Page(st.session_state.nav_media_vision_processing["depth_estimate"], title="Depth Estimator",      icon=":material/lens_blur:"),
        st.Page(st.session_state.nav_media_vision_processing["object_detect"],  title="Object Detection",       icon=":material/center_focus_strong:"),
        st.Page(st.session_state.nav_media_vision_processing["face_blur"],      title="Face Blurring",          icon=":material/face_retouching_off:"),
        st.Page(st.session_state.nav_media_vision_processing["nsfw_censor"],    title="Video Censor",           icon=":material/security:"),
    ],
    
    ":material/description: Subtitles & Metadata": [
        st.Page(st.session_state.nav_subtitles_metadata["audio"],       title="Subtitle Studio",      icon=":material/subtitles:"),
        st.Page(st.session_state.nav_subtitles_metadata["sub_fetcher"], title="Sub Fetcher",          icon=":material/closed_caption:"),
        st.Page(st.session_state.nav_subtitles_metadata["sub_merger"],  title="ASS Subtitle Merger",  icon=":material/merge:"),
        st.Page(st.session_state.nav_subtitles_metadata["media_tags"],  title="Media Tags Editor",    icon=":material/audiotrack:"),
        st.Page(st.session_state.nav_subtitles_metadata["timestamps"],  title="Timestamp Modifier",   icon=":material/update:"),
        st.Page(st.session_state.nav_subtitles_metadata["exif"],        title="EXIF Stripper",        icon=":material/visibility_off:"),
    ],

    ":material/folder: Files & Documents": [
        st.Page(st.session_state.nav_files_documents["pdf_studio"],     title="Document Studio",        icon=":material/edit_document:"),
        st.Page(st.session_state.nav_files_documents["file_mover"],     title="File Mover",             icon=":material/drive_file_move:"),
        st.Page(st.session_state.nav_files_documents["excel_cleaner"],  title="Excel Cleaner",         icon=":material/table_chart:"),
        st.Page(st.session_state.nav_files_documents["expense"],        title="Receipt Scanner",        icon=":material/receipt_long:"),
        st.Page(st.session_state.nav_files_documents["math_latex"],     title="Math to LaTeX",          icon=":material/calculate:"),
        st.Page(st.session_state.nav_files_documents["hash"],           title="File Integrity Checker", icon=":material/security:"),
        st.Page(st.session_state.nav_files_documents["mega_cleaner"],   title="Mega Link Cleaner",      icon=":material/folder_delete:"),
    ],

    ":material/settings: System & Network": [
        st.Page(st.session_state.nav_system_network["package"],  title="Package Manager",       icon=":material/widgets:"),
        st.Page(st.session_state.nav_system_network["docker"],   title="Docker Manager",        icon=":material/terminal:"),
        st.Page(st.session_state.nav_system_network["env"],      title="Environment Variables", icon=":material/account_tree:"),
        st.Page(st.session_state.nav_system_network["services"], title="Startup & Services",    icon=":material/speed:"),
        st.Page(st.session_state.nav_system_network["monitor"],  title="System Monitor",        icon=":material/memory:"),
        st.Page(st.session_state.nav_system_network["network"],  title="Network Monitor",       icon=":material/radar:"),
        st.Page(st.session_state.nav_system_network["ping"],     title="Ping Test",             icon=":material/network_ping:"),
    ],
    
    "Hidden" : [
        st.Page(st.session_state.nav_hidden["quick_sort"],      title="Quick Sort",     icon=":material/drag_pan:",     visibility="hidden"),
        st.Page(st.session_state.nav_hidden["manga_search"],    title="Manga Search",   icon=":material/search:",       visibility="hidden"),
        st.Page(st.session_state.nav_hidden["manga_read"],      title="Manga Reader",   icon=":material/book:",         visibility="hidden"),
        st.Page(st.session_state.nav_hidden["manga_sort"],      title="Manga Sort",     icon=":material/book:",         visibility="hidden"),
        st.Page(st.session_state.nav_hidden["manga_pdf"],       title="Manga PDF",      icon=":material/book:",         visibility="hidden"),
    ]
}

# --- Initialization & Rendering ---
pg = st.navigation(pages=pages, expanded=False)

# Track Start Time
start_time = time.time()

# Execute Active Page
pg.run()

# Track End Time and Calculate Duration
load_time = time.time() - start_time

# Render Widget to Sidebar
st.sidebar.divider()
st.sidebar.metric(label="⏱️ Page Load Time", value=f"{load_time:.3f} s")

# Log Results to File
log_file_path = "./cache/page_load_times.log"
timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
log_entry = f"[{timestamp}] Page: '{pg.title}' | Load Time: {load_time:.3f}s\n"

with open(log_file_path, "a") as f:
    f.write(log_entry)

# --- START OF NEW AUTOMATION CODE ---
# 1. Flatten your 'pages' dictionary into a single list of st.Page objects
all_pages = []
for section, page_list in pages.items():
    all_pages.extend(page_list)

# 2. Add a button to the sidebar to start the test
st.sidebar.divider()
if st.sidebar.button("🚀 Run Auto-Benchmark All Pages"):
    # Initialize the automated state
    st.session_state.auto_benchmark = True
    st.session_state.benchmark_index = 0
    # Jump to the very first page to start the loop
    st.switch_page(all_pages[0])

# 3. The Automation Loop: If benchmarking is active, switch to the next page
if st.session_state.get("auto_benchmark", False):
    current_idx = st.session_state.benchmark_index
    next_idx = current_idx + 1
    
    if next_idx < len(all_pages):
        # Update the index for the next run
        st.session_state.benchmark_index = next_idx
        # A tiny delay prevents overloading the Streamlit websocket
        time.sleep(0.2) 
        st.switch_page(all_pages[next_idx])
    else:
        # Reached the end of the pages list
        st.session_state.auto_benchmark = False
        st.sidebar.success("✅ Auto-Benchmark Complete! Check page_load_times.log")
# --- END OF NEW AUTOMATION CODE ---

# --- UI Configuration ---
render_theme_selector()
apply_footer()
import os
import sys
import subprocess


def search_youtube(query: str, limit: int = 10) -> tuple[bool, list | str]:
    """
    Searches YouTube and returns structured video results.
    Live streams are excluded. Each result includes a thumbnail URL.
    """
    import yt_dlp
    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'no_warnings': True,
        # FIX: Force english locale to prevent YouTube from automatically translating
        # the genuine title into the user's regional IP language.
        'http_headers': {'Accept-Language': 'en-US,en;q=0.9'},
        'extractor_args': {'youtube': ['lang=en']} 
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"ytsearch{limit}:{query}", download=False)
            entries = info.get('entries', [])

            results = []
            for vid in entries:
                if vid.get('live_status') in ('is_live', 'is_upcoming') or vid.get('duration') is None:
                    continue

                duration_raw = vid.get('duration', 0)
                duration_val = int(duration_raw) if duration_raw else 0
                duration_str = f"{duration_val // 60}:{duration_val % 60:02d}" if duration_val > 0 else "Unknown"

                thumbnails = vid.get('thumbnails', [])
                thumb_url = thumbnails[-1].get('url') if thumbnails else None

                # Fetch original_title if available before defaulting to the standard title
                title = vid.get('original_title') or vid.get('title', 'Unknown Title')

                results.append({
                    "title":           title,
                    "url":             vid.get('url', ''),
                    "webpage_url":     vid.get('url', ''),   
                    "duration_string": duration_str,
                    "views":           vid.get('view_count', 0),
                    "uploader":        vid.get('uploader', 'Unknown Channel'),
                    "thumbnail":       thumb_url,
                })

            return True, results
    except Exception as e:
        return False, str(e)


def get_available_resolutions(url: str) -> list[str]:
    """
    Fetches the available video resolutions for a given URL.
    Returns a list like ['Best', '1080p', '720p', '480p', '360p'].
    """
    import yt_dlp
    ydl_opts = {'quiet': True, 'no_warnings': True}
    resolutions = {'Best'}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            for fmt in info.get('formats', []):
                h = fmt.get('height')
                if h:
                    resolutions.add(f"{h}p")
    except Exception:
        pass

    order = ['Best', '2160p', '1440p', '1080p', '720p', '480p', '360p', '240p', '144p']
    return [r for r in order if r in resolutions] or ['Best', '1080p', '720p', '480p']


def download_youtube(
    url: str,
    output_dir: str,
    is_audio: bool = False,
    resolution: str = "Best",
    progress_hook=None
) -> tuple[bool, str, str | None]:
    """Downloads video/audio and passes progress back to Streamlit."""
    import yt_dlp
    if not os.path.isdir(output_dir):
        return False, "Invalid output directory.", None

    ydl_opts = {
        'outtmpl':      os.path.join(output_dir, '%(title)s.%(ext)s'),
        'noplaylist':   False,
        'quiet':        True,
        'no_warnings':  True,
        'ignoreerrors': True,
        # Applies the same translation bypass to the download naming
        'http_headers': {'Accept-Language': 'en-US,en;q=0.9'},
        'extractor_args': {'youtube': ['lang=en']}
    }

    if progress_hook:
        ydl_opts['progress_hooks'] = [progress_hook]

    if is_audio:
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }]
    else:
        if resolution == "Best":
            ydl_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
        else:
            res_val = resolution.replace("p", "")
            ydl_opts['format'] = (
                f'bestvideo[height<={res_val}][ext=mp4]+bestaudio[ext=m4a]'
                f'/best[height<={res_val}][ext=mp4]/best'
            )
        ydl_opts['merge_output_format'] = 'mp4'

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=True)
            if not info_dict:
                return False, "Failed to extract video info.", None

            # Attempt to use the original un-translated title for saving
            title = info_dict.get('original_title') or info_dict.get('title', 'Video_Playlist')

            if 'entries' in info_dict:
                return True, f"✅ Successfully downloaded playlist: {title}", output_dir

            ext = "mp3" if is_audio else "mp4"
            final_path = os.path.join(output_dir, f"{title}.{ext}")
            return True, f"✅ Successfully downloaded: {title}", final_path

    except Exception as e:
        return False, f"❌ Download error: {str(e)}", None


def open_file_in_os(file_path: str):
    """Opens the downloaded file or folder in the OS file manager."""
    if not os.path.exists(file_path):
        return
    try:
        if sys.platform == "win32":
            os.startfile(file_path)
        elif sys.platform == "darwin":
            subprocess.call(["open", file_path])
        else:
            subprocess.call(["xdg-open", file_path])
    except Exception as e:
        print(f"Failed to open {file_path}: {e}")
import subprocess
import os
import sys

def _get_spotdl_path() -> str:
    """Resolve the spotdl executable from the current Python interpreter's Scripts directory.
    Falls back to bare 'spotdl' if not found (relies on PATH)."""
    scripts_dir = os.path.dirname(sys.executable)
    candidates = [
        os.path.join(scripts_dir, "spotdl.exe"),
        os.path.join(scripts_dir, "spotdl"),
    ]
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    return "spotdl"  # fallback to PATH

def download_playlist_cli(playlist_url: str, output_dir: str, audio_format: str, bitrate: str) -> bool:
    """Uses the spotDL CLI directly to avoid Python threading/asyncio conflicts."""
    
    spotdl_path = _get_spotdl_path()

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Construct the spotdl command
    # --format, --bitrate, and --output are standard spotDL CLI flags
    cmd = [
        spotdl_path,
        playlist_url,
        "--format", audio_format,
        "--bitrate", bitrate,
        "--output", os.path.join(output_dir, "{artists} - {title}.{output-ext}")
    ]
    
    try:
        # Run the command and let it handle its own terminal output
        # shell=False for security, check=True raises an error if it fails
        subprocess.run(cmd, check=True)
        return True
    except FileNotFoundError:
        raise RuntimeError(
            "spotdl executable not found. Install it with: pip install spotdl"
        )
    except subprocess.CalledProcessError:
        return False



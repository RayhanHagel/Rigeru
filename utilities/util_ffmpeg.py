import os
import shutil
import subprocess
from functools import lru_cache

def process_video(
    input_path: str,
    output_dir: str,
    start_t: float,
    end_t: float,
    target_res: str,
    crf: int = 23,
    preset: str = "fast",
    keep_all_audio: bool = False,
    audio_codec: str = "aac"
) -> tuple[bool, str]:
    """
    Trims, scales, and compresses a video using FFmpeg with advanced configuration.
    Returns: (Success Boolean, Status Message)
    """
    if not os.path.isfile(input_path):
        return False, "Input video file does not exist."
    if not os.path.exists(output_dir):
        return False, "Output directory does not exist."

    base_name = os.path.basename(input_path)
    name, ext = os.path.splitext(base_name)
    output_path = os.path.join(output_dir, f"{name}_compressed.mp4")

    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-ss", str(start_t)
    ]

    if end_t < 90000:
        cmd.extend(["-to", str(end_t)])

    scale_filter = None
    if target_res == "1080p":
        scale_filter = "scale=-2:1080"
    elif target_res == "720p":
        scale_filter = "scale=-2:720"
    elif target_res == "480p":
        scale_filter = "scale=-2:480"

    if scale_filter:
        cmd.extend(["-vf", scale_filter])

    # Video Encoding settings
    cmd.extend([
        "-c:v", "libx264",
        "-crf", str(crf),
        "-preset", preset
    ])

    # Audio mapping logic (Supports multi-track audio)
    if keep_all_audio:
        cmd.extend(["-map", "0:v:0", "-map", "0:a?"])
    else:
        cmd.extend(["-map", "0:v:0", "-map", "0:a:0?"])

    # Audio encoding settings
    if audio_codec == "copy":
        cmd.extend(["-c:a", "copy"])
    else:
        cmd.extend(["-c:a", "aac", "-b:a", "128k"])

    cmd.append(output_path)

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True, f"Video saved to: {output_path}"
    except subprocess.CalledProcessError:
        return False, "FFmpeg failed to process the video. Ensure FFmpeg is installed."
    except FileNotFoundError:
        return False, "FFmpeg executable not found on the system."

@lru_cache(maxsize=1)
def get_available_encoders():
    """Probes local FFmpeg for available hardware accelerated encoders."""
    if not shutil.which("ffmpeg"):
        return ["cv2 (No FFmpeg / Fallback)"]

    try:
        res = subprocess.run(["ffmpeg", "-encoders"], capture_output=True, text=True)
        hw_candidates = {
            'h264_nvenc':        'h264_nvenc (Nvidia GPU)',
            'hevc_nvenc':        'hevc_nvenc (Nvidia GPU H.265)',
            'h264_videotoolbox': 'h264_videotoolbox (Apple Silicon)',
            'h264_qsv':          'h264_qsv (Intel QuickSync)',
            'h264_amf':          'h264_amf (AMD GPU)'
        }

        available = ["libx264 (CPU Standard)"]
        for enc, label in hw_candidates.items():
            if enc in res.stdout:
                available.append(label)
        return available
    except Exception:
        return ["libx264 (CPU Standard)"]

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
    """Trims, scales, and compresses a video using FFmpeg with advanced configuration.

    Args:
        input_path (str): Path to input video file.
        output_dir (str): Output destination directory.
        start_t (float): Trimming start time offset in seconds.
        end_t (float): Trimming end time offset in seconds.
        target_res (str): Target resolution profile ('1080p', '720p', '480p', or other).
        crf (int): Constant Rate Factor quality setting (lower is better quality). Defaults to 23.
        preset (str): FFmpeg x264 encoding preset ('ultrafast', 'fast', 'slow', etc.). Defaults to 'fast'.
        keep_all_audio (bool): Whether to map all audio tracks from input. Defaults to False.
        audio_codec (str): Audio codec to use ('aac' or 'copy'). Defaults to 'aac'.

    Returns:
        tuple[bool, str]: (success flag, resulting output path or error description).
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
def get_available_encoders() -> list[str]:
    """Probes local FFmpeg for available hardware accelerated encoders.

    Returns:
        list[str]: List of encoder names and hardware acceleration descriptions.
    """
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

def convert_video_to_gif(input_path: str, output_path: str, fps: int = 15, scale: int = 480) -> tuple[bool, str]:
    """Converts a video to a high-quality GIF with palette generation.

    Args:
        input_path (str): Path to input video file.
        output_path (str): Path to save the resulting animated GIF.
        fps (int): Target frame rate. Defaults to 15.
        scale (int): Maximum width in pixels, keeping aspect ratio. Defaults to 480.

    Returns:
        tuple[bool, str]: (success flag, resulting GIF path or error message).
    """
    if not os.path.isfile(input_path):
        return False, "Input video file does not exist."
        
    vf_param = f"fps={fps},scale={scale}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse"
    
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", vf_param,
        "-loop", "0", output_path
    ]
    
    try:
        process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if process.returncode != 0:
            err_msg = process.stderr.decode('utf-8', errors='ignore')
            return False, f"FFmpeg failed to convert video: {err_msg}"
        return True, output_path
    except Exception as e:
        return False, str(e)

def trim_audio(input_path: str, output_path: str, start: float, end: float) -> tuple[bool, str]:
    """Trims an audio file using FFmpeg.

    Args:
        input_path (str): Path to input audio file.
        output_path (str): Path to write the trimmed audio file.
        start (float): Start time offset in seconds.
        end (float): End time offset in seconds.

    Returns:
        tuple[bool, str]: (success flag, resulting audio file path or error message).
    """
    if not os.path.isfile(input_path):
        return False, "Input audio file does not exist."
        
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-ss", str(start),
        "-to", str(end),
        output_path
    ]
    
    try:
        process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if process.returncode != 0:
            err_msg = process.stderr.decode('utf-8', errors='ignore')
            return False, f"FFmpeg failed to trim audio: {err_msg}"
            
        if not os.path.exists(output_path):
            return False, f"FFmpeg succeeded but output file {output_path} was not created."
            
        return True, output_path
    except Exception as e:
        return False, str(e)


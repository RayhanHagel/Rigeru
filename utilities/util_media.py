import os
import subprocess
from PIL import Image, UnidentifiedImageError, ImageOps, ImageFilter


def _init_tkinter():
    """Helper to initialize a hidden, top-most tkinter root window."""
    import tkinter as tk
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    return root, tk


def open_file_dialog() -> str:
    """Opens a native OS file dialog to select a single file."""
    from tkinter import filedialog
    root, _ = _init_tkinter()
    file_path = filedialog.askopenfilename(
        title="Select Media File",
        filetypes=[("All Files", "*.*")]
    )
    root.destroy()
    return file_path


def open_folder_dialog(initial_dir: str = "") -> str:
    """Opens a native OS folder dialog to select a directory."""
    from tkinter import filedialog
    root, _ = _init_tkinter()

    # Fallback to home directory if the provided initial_dir is invalid
    if not initial_dir or not os.path.exists(initial_dir):
        initial_dir = os.path.expanduser('~')

    folder_path = filedialog.askdirectory(
        title="Select Directory",
        initialdir=initial_dir
    )
    root.destroy()
    return folder_path


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
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL)
        return True, f"Video saved to: {output_path}"
    except subprocess.CalledProcessError:
        return False, "FFmpeg failed to process the video. Ensure FFmpeg is installed."
    except FileNotFoundError:
        return False, "FFmpeg executable not found on the system."


def batch_compress_images(
    input_dir: str,
    output_dir: str,
    quality: int,
    max_width: int,
    max_height: int,
    fit_mode: str
) -> tuple[bool, str]:
    """
    Resizes and compresses images in a directory using specific fit modes.
    Returns: (Success Boolean, Status Message)
    """
    if not os.path.isdir(input_dir):
        return False, "Input directory does not exist."
    if not os.path.isdir(output_dir):
        return False, "Output directory does not exist."

    valid_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    processed_count = 0
    error_count = 0

    for filename in os.listdir(input_dir):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in valid_extensions:
            continue

        input_path = os.path.join(input_dir, filename)
        name = os.path.splitext(filename)[0]
        output_path = os.path.join(output_dir, f"{name}_compressed.jpg")

        try:
            with Image.open(input_path) as img:
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")

                if max_width > 0 and max_height > 0:
                    if fit_mode == "Stretch to Fit":
                        img = img.resize((max_width, max_height),
                                         Image.Resampling.LANCZOS)
                    elif fit_mode == "Pad with Black Bars":
                        img = ImageOps.pad(
                            img, (max_width, max_height), color="black")
                    elif fit_mode == "Pad with White Bars":
                        img = ImageOps.pad(
                            img, (max_width, max_height), color="white")
                    elif fit_mode == "Pad with Blurred Background":
                        # Create a zoomed/blurred background filling the box
                        bg = ImageOps.fit(
                            img, (max_width, max_height), Image.Resampling.LANCZOS)
                        bg = bg.filter(ImageFilter.GaussianBlur(radius=20))

                        # Resize the original image maintaining aspect ratio
                        img.thumbnail((max_width, max_height),
                                      Image.Resampling.LANCZOS)

                        # Paste centered
                        offset = ((max_width - img.width) // 2,
                                  (max_height - img.height) // 2)
                        bg.paste(img, offset)
                        img = bg
                    else:  # "Maintain Aspect Ratio (Fit Inside)"
                        img.thumbnail((max_width, max_height),
                                      Image.Resampling.LANCZOS)

                elif max_width > 0:  # Fallback if only width is provided
                    ratio = max_width / float(img.width)
                    new_height = int(float(img.height) * float(ratio))
                    img = img.resize((max_width, new_height),
                                     Image.Resampling.LANCZOS)

                img.save(output_path, "JPEG", quality=quality, optimize=True)
                processed_count += 1

        except UnidentifiedImageError:
            error_count += 1
        except Exception:
            error_count += 1

    if processed_count == 0 and error_count == 0:
        return False, "No valid images found in the input directory."

    msg = f"Successfully compressed {processed_count} images."
    if error_count > 0:
        msg += f" (Skipped {error_count} corrupted or unsupported files)."

    return True, msg

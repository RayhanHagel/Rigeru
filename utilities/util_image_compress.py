import os
import concurrent.futures


def _process_single_image(args):
    """Worker function for compressing a single image in a parallel process."""
    input_path, output_path, quality, max_width, max_height, fit_mode = args
    from PIL import Image, UnidentifiedImageError, ImageOps, ImageFilter
    
    try:
        with Image.open(input_path) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")

            if max_width > 0 and max_height > 0:
                if fit_mode == "Stretch to Fit":
                    img = img.resize((max_width, max_height), Image.Resampling.LANCZOS)
                elif fit_mode == "Pad with Black Bars":
                    img = ImageOps.pad(img, (max_width, max_height), color="black")
                elif fit_mode == "Pad with White Bars":
                    img = ImageOps.pad(img, (max_width, max_height), color="white")
                elif fit_mode == "Pad with Blurred Background":
                    bg = ImageOps.fit(img, (max_width, max_height), Image.Resampling.LANCZOS)
                    bg = bg.filter(ImageFilter.GaussianBlur(radius=20))
                    img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
                    offset = ((max_width - img.width) // 2, (max_height - img.height) // 2)
                    bg.paste(img, offset)
                    img = bg
                else:  # "Maintain Aspect Ratio (Fit Inside)"
                    img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)

            elif max_width > 0:  # Fallback if only width is provided
                ratio = max_width / float(img.width)
                new_height = int(float(img.height) * float(ratio))
                img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)

            img.save(output_path, "JPEG", quality=quality, optimize=True)
            return True
    except Exception:
        return False


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
    tasks = []

    for filename in os.listdir(input_dir):
        ext = os.path.splitext(filename)[1].lower()
        if ext not in valid_extensions:
            continue
        
        input_path = os.path.join(input_dir, filename)
        name = os.path.splitext(filename)[0]
        output_path = os.path.join(output_dir, f"{name}_compressed.jpg")
        
        tasks.append((input_path, output_path, quality, max_width, max_height, fit_mode))

    if not tasks:
        return False, "No valid images found in the input directory."

    processed_count = 0
    error_count = 0

    with concurrent.futures.ProcessPoolExecutor() as executor:
        for success in executor.map(_process_single_image, tasks):
            if success:
                processed_count += 1
            else:
                error_count += 1

    msg = f"Successfully compressed {processed_count} images."
    if error_count > 0:
        msg += f" (Skipped {error_count} corrupted or unsupported files)."

    return True, msg

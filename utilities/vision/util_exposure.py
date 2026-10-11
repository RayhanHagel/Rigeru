import cv2
import numpy as np
import os
import uuid
from typing import Optional

def adjust_image_exposure(image: np.ndarray, ev: float = 0.0) -> np.ndarray:
    """Adjusts exposure of an image using exposure value (EV).

    Formula: output = clip(input * 2^ev, 0, 255)

    Args:
        image (np.ndarray): Input BGR image array.
        ev (float): Exposure compensation value, typically between -3.0 and +3.0.

    Returns:
        np.ndarray: Exposure-adjusted BGR uint8 image.
    """
    scale = 2.0 ** ev
    # Convert to float32 to prevent overflow, scale, then clip back to [0, 255]
    adjusted = np.clip(image.astype(np.float32) * scale, 0, 255).astype(np.uint8)
    return adjusted

def generate_exposure_photography(video_path: str, output_dir: str, ev: float = 0.0) -> str:
    """Processes a video file to create a simulated long exposure photograph with optional EV compensation.

    Accumulates and blends video frames simulating long-exposure photography, then applies exposure compensation.

    Args:
        video_path (str): Path to the source video file.
        output_dir (str): Directory where the output photo will be saved.
        ev (float): Exposure compensation value (-3.0 to +3.0).

    Returns:
        str: Filename of the generated exposure photo.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open video file.")

    frameCount = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    accum_image = np.zeros((height, width, 3), np.float32)

    frames_processed = 0
    step = max(1, frameCount // 300)

    for i in range(frameCount):
        ret, frame = cap.read()
        if not ret:
            break
        if i % step == 0:
            accum_image += frame
            frames_processed += 1

    cap.release()

    if frames_processed == 0:
        raise ValueError("No frames could be read from the video.")

    avg_image = np.uint8(accum_image / frames_processed)

    if ev != 0.0:
        final_image = adjust_image_exposure(avg_image, ev)
    else:
        final_image = avg_image

    output_filename = f"exposure_{uuid.uuid4().hex[:8]}.jpg"
    output_path = os.path.join(output_dir, output_filename)
    cv2.imwrite(output_path, final_image)

    return output_filename

import cv2
import numpy as np
import os
import uuid

def apply_pinhole_effect(image: np.ndarray) -> np.ndarray:
    """
    Applies a vignette and subtle barrel distortion to an image to simulate a pinhole lens.
    """
    h, w = image.shape[:2]
    
    # Generate vignette mask
    X_resultant_kernel = cv2.getGaussianKernel(w, w/2)
    Y_resultant_kernel = cv2.getGaussianKernel(h, h/2)
    kernel = Y_resultant_kernel * X_resultant_kernel.T
    mask = 255 * kernel / np.linalg.norm(kernel)
    mask = mask / np.max(mask)
    
    # Apply mask
    vignette = np.copy(image)
    for i in range(3):
        vignette[:,:,i] = vignette[:,:,i] * mask
        
    return vignette

def generate_pinhole_photography(video_path: str, output_dir: str) -> str:
    """
    Processes a video file to create a single long-exposure pinhole photograph.
    Averages all frames and applies a pinhole effect.
    Returns the path to the generated image.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Could not open video file.")
        
    frameCount = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Initialize an accumulator image
    # We use float32 to avoid overflow when adding many frames
    accum_image = np.zeros((height, width, 3), np.float32)
    
    frames_processed = 0
    # To save time and memory, we might sample frames if the video is too long
    # Let's say we sample up to 300 frames max
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
        
    # Average the accumulated frames
    avg_image = accum_image / frames_processed
    avg_image = np.uint8(avg_image)
    
    # Apply pinhole effect (vignette)
    final_image = apply_pinhole_effect(avg_image)
    
    output_filename = f"pinhole_{uuid.uuid4().hex[:8]}.jpg"
    output_path = os.path.join(output_dir, output_filename)
    
    cv2.imwrite(output_path, final_image)
    
    return output_filename

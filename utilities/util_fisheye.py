import cv2
import numpy as np
import os

def apply_fisheye(input_path: str, output_path: str, strength: float = 0.5):
    img = cv2.imread(input_path)
    if img is None:
        raise ValueError(f"Image not found: {input_path}")
        
    h, w = img.shape[:2]
    
    y, x = np.mgrid[0:h, 0:w]
    cx, cy = w / 2.0, h / 2.0
    
    max_c = max(cx, cy)
    nx = (x - cx) / max_c
    ny = (y - cy) / max_c
    
    r = np.sqrt(nx**2 + ny**2)
    
    # Scale calculation for fisheye effect
    scale = 1.0 / (1.0 + (strength * r**2))
    
    map_x = nx * scale * max_c + cx
    map_y = ny * scale * max_c + cy
    
    result = cv2.remap(img, map_x.astype(np.float32), map_y.astype(np.float32), 
                       interpolation=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
                       
    cv2.imwrite(output_path, result)
    return output_path

def make_blur_fn(blur_intensity: int, blur_type: str):
    """
    Creates a blur function (Gaussian or Pixelated/Resize) based on the provided parameters.
    """
    import cv2
    if blur_type == "Gaussian":
        k = int(blur_intensity) * 2 + 1
        return lambda roi: cv2.GaussianBlur(roi, (k, k), 30)
    else:
        ratio = max(1, 100 - blur_intensity) / 100.0

        def _blur(roi):
            h, w = roi.shape[:2]
            sw, sh = max(1, int(w * ratio)), max(1, int(h * ratio))
            return cv2.resize(
                cv2.resize(roi, (sw, sh), interpolation=cv2.INTER_LINEAR), 
                (w, h), 
                interpolation=cv2.INTER_NEAREST
            )
        return _blur


def apply_blur_fn(image, x: int, y: int, w: int, h: int, blur_fn):
    """
    Applies the provided blur function to a specific bounding box within an image.
    Modifies the image in-place and returns it.
    """
    ih, iw = image.shape[:2]
    x, y = max(0, x), max(0, y)
    x2, y2 = min(iw, x + w), min(ih, y + h)
    
    if x2 > x and y2 > y:
        image[y:y2, x:x2] = blur_fn(image[y:y2, x:x2])
        
    return image
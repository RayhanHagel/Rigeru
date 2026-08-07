import os
from functools import lru_cache

_MODEL_CONFIG = {
    2: {"weights": "RealESRGAN_x2plus.pth", "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth", "num_block": 23},
    4: {"weights": "RealESRGAN_x4plus.pth", "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth", "num_block": 23},
    8: {"weights": "RealESRGAN_x4plus.pth", "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth", "num_block": 23},
}


@lru_cache(maxsize=4)
def _load_upscale_model(scale: int, device: str):
    """Loads the Real-ESRGAN model, downloading weights if necessary, and caches it in memory."""
    import torch
    import urllib.request
    import sys
    
    # 1. APPLY HOTFIX FIRST
    # This must happen before basicsr or realesrgan are imported
    try:
        import torchvision.transforms.functional as TF
        sys.modules['torchvision.transforms.functional_tensor'] = TF
    except ImportError:
        pass

    # 2. IMPORT DEPENDENCIES SECOND
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    cfg = _MODEL_CONFIG.get(scale)
    weights_path = os.path.join(os.path.abspath("cache"), "models", cfg["weights"])
    os.makedirs(os.path.dirname(weights_path), exist_ok=True)

    if not os.path.exists(weights_path):
        urllib.request.urlretrieve(cfg["url"], weights_path)

    model_scale = 4 if scale == 8 else scale

    model = RRDBNet(
        num_in_ch=3, num_out_ch=3,
        num_feat=64, num_block=cfg["num_block"],
        num_grow_ch=32, scale=model_scale
    )

    return RealESRGANer(
        scale=model_scale, model_path=weights_path, model=model, 
        tile=400, tile_pad=10, pre_pad=0, half=(device != "cpu"), device=torch.device(device)
    )


def upscale_image(image_path: str, scale: int = 4, device: str = None):
    """Upscales an image by a factor (2, 4, or 8) using Real-ESRGAN."""
    try:
        from utilities.util_config import get_model_config
        import cv2
        from PIL import Image

        if device is None:
            device_pref = get_model_config("device_preference")
            device = "cpu"
            if device_pref != "CPU Only":
                import torch
                if torch.cuda.is_available():
                    device = "cuda"

        img_bgr = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return False, "Failed to read image with OpenCV."

        upsampler = _load_upscale_model(scale, device)

        if scale == 8:
            output, _ = upsampler.enhance(img_bgr, outscale=4)
            output, _ = upsampler.enhance(output, outscale=2)
        else:
            output, _ = upsampler.enhance(img_bgr, outscale=scale)

        return True, Image.fromarray(cv2.cvtColor(output, cv2.COLOR_BGR2RGB))
    except Exception as e:
        return False, str(e)


# check_model_downloaded removed as it was unused


def get_compute_device() -> list[str]:
    """Detects available compute devices (CUDA vs CPU)."""
    try:
        import torch
        if torch.cuda.is_available():
            return ["cuda", "cpu"]
    except ImportError:
        pass
    return ["cpu"]

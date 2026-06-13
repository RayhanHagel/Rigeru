import os
import sys
import torch
from PIL import Image
import streamlit as st

# --- HOTFIX FOR MODERN TORCHVISION ---
try:
    import torchvision.transforms.functional as TF
    sys.modules['torchvision.transforms.functional_tensor'] = TF
except ImportError:
    pass

# Model configuration table — covers all scales exposed in the UI
_MODEL_CONFIG = {
    2: {
        "weights": "RealESRGAN_x2plus.pth",
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth",
        "num_block": 23,
    },
    4: {
        "weights": "RealESRGAN_x4plus.pth",
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        "num_block": 23,
    },
    8: {
        # x8 is achieved by running x4 twice — there is no official x8 model weight
        "weights": "RealESRGAN_x4plus.pth",
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        "num_block": 23,
    },
}


@st.cache_resource(show_spinner=False)
def _load_upscale_model(scale: int, device: str):
    """Loads the Real-ESRGAN model into memory (cached per scale+device)."""
    from basicsr.archs.rrdbnet_arch import RRDBNet
    from realesrgan import RealESRGANer

    cfg = _MODEL_CONFIG.get(scale)
    if cfg is None:
        raise ValueError(f"Unsupported scale {scale}. Supported: {list(_MODEL_CONFIG.keys())}")

    weights_dir = os.path.join(os.path.abspath("cache"), "weights")
    os.makedirs(weights_dir, exist_ok=True)
    weights_path = os.path.join(weights_dir, cfg["weights"])

    if not os.path.exists(weights_path):
        import urllib.request
        urllib.request.urlretrieve(cfg["url"], weights_path)

    # x8 uses the x4 model weights but applies the upscaler twice
    model_scale = 4 if scale == 8 else scale

    model = RRDBNet(
        num_in_ch=3, num_out_ch=3,
        num_feat=64, num_block=cfg["num_block"],
        num_grow_ch=32, scale=model_scale
    )

    upsampler = RealESRGANer(
        scale=model_scale,
        model_path=weights_path,
        model=model,
        tile=0,
        tile_pad=10,
        pre_pad=0,
        half=(device != "cpu"),
        device=torch.device(device)
    )
    return upsampler


def upscale_image(image_path: str, scale: int = 4, device: str = "cpu") -> tuple[bool, str | Image.Image]:
    """
    Upscales an image by the given scale factor.
    Scale 8 is handled by running the x4 model twice.
    """
    try:
        import cv2
        img_bgr = cv2.imread(image_path, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return False, "Failed to read image with OpenCV."

        upsampler = _load_upscale_model(scale, device)

        if scale == 8:
            # First pass: x4
            output, _ = upsampler.enhance(img_bgr, outscale=4)
            # Second pass: x2 (reuse x4 model with outscale=2 to reach x8 total)
            output, _ = upsampler.enhance(output, outscale=2)
        else:
            output, _ = upsampler.enhance(img_bgr, outscale=scale)

        output_rgb = cv2.cvtColor(output, cv2.COLOR_BGR2RGB)
        return True, Image.fromarray(output_rgb)
    except Exception as e:
        return False, str(e)


def check_model_downloaded(scale: int) -> bool:
    """Returns True if the weights file for the given scale is already cached locally."""
    cfg = _MODEL_CONFIG.get(scale)
    if cfg is None:
        return False
    weights_path = os.path.join(os.path.abspath("cache"), "models", cfg["weights"])
    return os.path.exists(weights_path)


def get_compute_device() -> list[str]:
    """Returns available compute devices (CUDA GPU(s) + CPU)."""
    try:
        if torch.cuda.is_available():
            return ["cuda", "cpu"]
    except Exception:
        pass
    return ["cpu"]

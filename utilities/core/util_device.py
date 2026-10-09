import os
from functools import lru_cache
from typing import List, Tuple, Any

@lru_cache(maxsize=1)
def get_device(override: str | None = None) -> str:
    """Resolves compute device based on global preferences.

    - 'CPU Only' -> 'cpu'
    - 'GPU Preference' -> 'cuda' (if available, else 'cpu')
    - 'Auto-Detect' -> 'cuda' (if available, else 'cpu')

    Args:
        override (str | None): Optional device override string ('CPU Only', 'GPU Preference', 'Auto-Detect'). Defaults to None.

    Returns:
        str: Target compute device identifier ('cpu' or 'cuda').
    """
    if override and override != "Auto-Detect":
        if override == "CPU Only":
            return "cpu"
        if override == "GPU Preference":
            try:
                import torch
                return "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                return "cpu"

    from utilities.core.util_config import get_model_config
    pref = get_model_config("device_preference")
    if pref == "CPU Only":
        return "cpu"
    
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def get_torch_dtype(device: str | None = None) -> Any:
    """Resolves torch dtype based on device and hardware optimization preferences.

    - 'FP16 (GPU Speedup)' -> torch.float16
    - 'INT8 (Max GPU Memory Save)' -> 8-bit quantization flag indicator
    - Standard -> torch.float32 (or bfloat16 for modern cuda)

    Args:
        device (str | None): Device string ('cpu' or 'cuda'). If None, resolved automatically. Defaults to None.

    Returns:
        Any: Resolved PyTorch torch.dtype object.
    """
    import torch
    if device is None:
        device = get_device()

    if device == "cpu":
        return torch.float32

    from utilities.core.util_config import get_model_config
    opt = get_model_config("hardware_optimization")
    if "FP16" in opt:
        return torch.float16
    if "INT8" in opt:
        return torch.int8
    return torch.float16 if device == "cuda" else torch.float32


def get_onnx_providers(engine: str | None = None) -> list[Any]:
    """Resolves ONNX Runtime execution providers based on preference and available hardware.

    Args:
        engine (str | None): Target engine ('tensorrt', 'onnx', etc.). If None, reads from global config. Defaults to None.

    Returns:
        list[Any]: List of available execution provider strings or tuples.
    """
    import onnxruntime as ort
    available = ort.get_available_providers()
    device = get_device()

    from utilities.core.util_config import get_model_config
    global_engine = engine or get_model_config("global_compute_engine")

    providers = []
    if device != "cpu":
        if global_engine == "tensorrt" and "TensorrtExecutionProvider" in available:
            providers.append("TensorrtExecutionProvider")
        if "CUDAExecutionProvider" in available:
            providers.append("CUDAExecutionProvider")

    providers.append("CPUExecutionProvider")
    return [p for p in providers if p in available or isinstance(p, tuple)]


def get_ctranslate2_compute_type(device: str | None = None) -> str:
    """Returns optimal compute_type for CTranslate2 / Faster-Whisper.

    Args:
        device (str | None): Compute device string ('cpu' or 'cuda'). If None, resolved automatically. Defaults to None.

    Returns:
        str: CTranslate2 compute type string ('int8', 'int8_float16', or 'float16').
    """
    if device is None:
        device = get_device()
    if device == "cpu":
        return "int8"
    from utilities.core.util_config import get_model_config
    opt = get_model_config("hardware_optimization")
    if "INT8" in opt:
        return "int8_float16"
    return "float16"

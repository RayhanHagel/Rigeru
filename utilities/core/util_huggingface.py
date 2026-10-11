import os
from typing import Optional
from utilities.core.util_store import get_data, set_data

CACHE_DIR = os.path.join(".", "cache")

def load_hf_token() -> str:
    """Read the cached Hugging Face token, or return empty string.

    Returns:
        str: Cached token or empty string if not found.
    """
    ai_settings = get_data("ai_settings") or {}
    return ai_settings.get("huggingface", {}).get("hf_token", "")


def save_hf_token(token: str) -> None:
    """Persist a Hugging Face token to the local store.

    Args:
        token (str): The Hugging Face API token to save.
    """
    ai_settings = get_data("ai_settings") or {}
    hf_data = ai_settings.get("huggingface", {})
    hf_data["hf_token"] = token.strip()
    ai_settings["huggingface"] = hf_data
    set_data("ai_settings", ai_settings)


def download_hf_file(repo_id: str, filename: str, output_path: str, repo_type: str = "model", token: Optional[str] = None) -> bool:
    """Downloads a file from Hugging Face Hub and moves it to the target output_path.

    If the downloaded file is a zip, it extracts it into the directory of output_path.

    Args:
        repo_id (str): The repository identifier on Hugging Face.
        filename (str): The name of the file to download.
        output_path (str): Destination filesystem path for the file.
        repo_type (str): Type of repository ('model', 'dataset', or 'space').
        token (Optional[str]): Optional Hugging Face authorization token.

    Returns:
        bool: True if downloaded or already exists, False on failure.
    """
    import zipfile
    import shutil
    import os
    
    if os.path.exists(output_path):
        return True

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    try:
        from huggingface_hub import hf_hub_download
        downloaded_path = hf_hub_download(
            repo_id=repo_id, 
            filename=filename, 
            repo_type=repo_type, 
            token=token
        )
        
        if filename.endswith(".zip"):
            with zipfile.ZipFile(downloaded_path, 'r') as zip_ref:
                zip_ref.extractall(os.path.dirname(output_path))
        else:
            shutil.copy2(downloaded_path, output_path)
            
        return True
    except Exception as e:
        print(f"Failed to download {filename} from {repo_id}: {e}")
        return False

def quantize_onnx_model(model_path: str, quant_path: str) -> str:
    """Dynamically quantizes an FP32 ONNX model to INT8.

    Args:
        model_path (str): Path to input FP32 ONNX model file.
        quant_path (str): Target output path for the quantized INT8 model.

    Returns:
        str: The quant_path if successful, otherwise falls back to model_path.
    """
    import os
    if os.path.exists(quant_path):
        return quant_path

    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
        print(f"Quantizing {model_path} to INT8...")
        quantize_dynamic(model_path, quant_path, weight_type=QuantType.QUInt8)
        return quant_path
    except Exception as e:
        print(f"Quantization failed: {e}. Falling back to FP32.")
        return model_path

def get_directory_size(path: str) -> int:
    """Returns total size of a directory in bytes.

    Args:
        path (str): Directory path on disk.

    Returns:
        int: Total size in bytes.
    """
    total = 0
    try:
        for dirpath, _, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                if not os.path.islink(fp):
                    total += os.path.getsize(fp)
    except Exception:
        pass
    return total

def list_cached_models() -> list[dict]:
    """Returns a clean, deduplicated list of downloaded models across all architectures with their sizes.

    Returns:
        list[dict]: List of metadata dictionaries for cached models.
    """
    models_dir = os.path.join(CACHE_DIR, "models")
    if not os.path.exists(models_dir):
        return []
        
    models = []
    seen_repos = set()
    
    for root, dirs, files in os.walk(models_dir):
        # Ignore locks and hidden directories
        dirs[:] = [d for d in dirs if not d.startswith(".") and d != ".locks"]
        rel_path = os.path.relpath(root, models_dir)
        
        if rel_path == ".":
            for f in files:
                if f.endswith((".pt", ".pth", ".onnx")) and not f.startswith("."):
                    full_path = os.path.join(root, f)
                    repo_id = f
                    if f == "u2net.onnx":
                        repo_id = "u2net"
                    elif f == "depth_anything_v2_small.onnx":
                        repo_id = "onnx-community/depth-anything-v2-small"
                    elif f == "depth_anything_v2_base.onnx":
                        repo_id = "onnx-community/depth-anything-v2-base"

                    if repo_id not in seen_repos:
                        seen_repos.add(repo_id)
                        models.append({
                            "id": f,
                            "repo_id": repo_id,
                            "size_bytes": os.path.getsize(full_path),
                            "path": full_path
                        })
            continue
            
        entry = os.path.basename(root)
        
        # 1. HuggingFace default cache format
        if entry.startswith("models--"):
            repo_id = entry.replace("models--", "").replace("--", "/")
            if repo_id not in seen_repos:
                size = get_directory_size(root)
                if size > 1024:
                    seen_repos.add(repo_id)
                    models.append({
                        "id": rel_path.replace("\\", "/"),
                        "repo_id": repo_id,
                        "size_bytes": size,
                        "path": root
                    })
            dirs.clear()
            
        # 2. InsightFace model packs
        elif entry in ["buffalo_l", "buffalo_m", "buffalo_s", "antelopev2"]:
            if entry not in seen_repos:
                seen_repos.add(entry)
                models.append({
                    "id": entry,
                    "repo_id": entry,
                    "size_bytes": get_directory_size(root),
                    "path": root
                })
            dirs.clear()

        # 3. Faster-Whisper local directory or CTranslate2
        elif ("model.bin" in files or "config.json" in files) and ("faster-whisper" in rel_path or "Systran" in rel_path or "nllb" in rel_path):
            clean_rel = rel_path.replace("\\", "/")
            if clean_rel not in seen_repos:
                seen_repos.add(clean_rel)
                models.append({
                    "id": clean_rel,
                    "repo_id": clean_rel,
                    "size_bytes": get_directory_size(root),
                    "path": root
                })
            dirs.clear()
            
    return sorted(models, key=lambda x: x["size_bytes"], reverse=True)

def delete_cached_model(folder_id: str) -> bool:
    """Deletes a specific model cache file or folder by ID or repo ID.

    Args:
        folder_id (str): Folder identifier, filename, or repository ID.

    Returns:
        bool: True if successfully removed, False otherwise.
    """
    import shutil
    
    # Security check to prevent path traversal
    if ".." in folder_id:
        return False
        
    models_dir = os.path.join(CACHE_DIR, "models")
    clean_id = folder_id.strip()

    # Direct target check
    candidates = [
        os.path.join(models_dir, clean_id),
        os.path.join(models_dir, clean_id.replace("/", "--")),
        os.path.join(models_dir, f"models--{clean_id.replace('/', '--')}"),
    ]
    
    # Aliases
    if clean_id in ["u2net", "u2net.onnx"]:
        candidates.append(os.path.join(models_dir, "u2net.onnx"))
    elif "depth-anything-v2-small" in clean_id:
        candidates.append(os.path.join(models_dir, "depth_anything_v2_small.onnx"))
    elif "depth-anything-v2-base" in clean_id:
        candidates.append(os.path.join(models_dir, "depth_anything_v2_base.onnx"))

    deleted = False
    for target_path in candidates:
        if os.path.exists(target_path):
            try:
                if os.path.isdir(target_path):
                    shutil.rmtree(target_path)
                else:
                    os.remove(target_path)
                deleted = True
            except Exception:
                pass

    return deleted

DOWNLOAD_PROGRESS = {}

class ProgressTqdm:
    """Tqdm wrapper to track Hugging Face download progress."""

    def __init__(self, *args: object, **kwargs: object) -> None:
        self.n = 0
        self.total = kwargs.get('total', 100) or 100
        self.desc = kwargs.get('desc', 'Downloading')
        self.repo_id = getattr(huggingface_hub.utils, 'CURRENT_DOWNLOAD_REPO', "unknown")
        
    def update(self, n: int = 1) -> None:
        self.n += n
        if self.repo_id in DOWNLOAD_PROGRESS:
            DOWNLOAD_PROGRESS[self.repo_id] = {
                "status": "downloading", 
                "progress": self.n,
                "total": self.total,
                "desc": self.desc
            }

    def close(self) -> None:
        pass
    
    def __enter__(self) -> "ProgressTqdm":
        return self
        
    def __exit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        pass
        
    def set_description(self, desc: str) -> None:
        self.desc = desc

import huggingface_hub.utils
huggingface_hub.utils.tqdm = ProgressTqdm

def download_model(repo_id: str) -> bool:
    """Downloads a full model repository or weight file to the cache directory.

    Args:
        repo_id (str): Hugging Face model repository ID or model identifier.

    Returns:
        bool: True if model downloaded successfully, False otherwise.
    """
    from huggingface_hub import snapshot_download
    models_dir = os.path.join(CACHE_DIR, "models")
    os.makedirs(models_dir, exist_ok=True)
    
    clean_repo = repo_id.strip()
    DOWNLOAD_PROGRESS[clean_repo] = {"status": "starting", "progress": 0, "total": 100, "desc": "Starting download..."}
    setattr(huggingface_hub.utils, 'CURRENT_DOWNLOAD_REPO', clean_repo)
    
    # 1. Rembg u2net model
    if clean_repo.lower() in ["u2net", "u2net.onnx"]:
        try:
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "downloading", "progress": 50, "total": 100, "desc": "Fetching u2net ONNX session..."}
            import rembg
            rembg.new_session("u2net")
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "finished"}
            return True
        except Exception as e:
            print(f"Failed to download u2net: {e}")
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "error", "desc": str(e)}
            return False

    # 2. Real-ESRGAN Super-Resolution weights
    if clean_repo in ["RealESRGAN_x2plus.pth", "RealESRGAN_x4plus.pth", "realesrgan_x2", "realesrgan_x4"]:
        try:
            import urllib.request
            scale = 2 if ("x2" in clean_repo.lower()) else 4
            filename = f"RealESRGAN_x{scale}plus.pth"
            url = f"https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth" if scale == 2 else "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
            target = os.path.join(models_dir, filename)
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "downloading", "progress": 30, "total": 100, "desc": f"Downloading {filename}..."}
            urllib.request.urlretrieve(url, target)
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "finished"}
            return True
        except Exception as e:
            print(f"Failed to download RealESRGAN weights: {e}")
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "error", "desc": str(e)}
            return False

    # 3. Depth Anything V2 ONNX
    if "depth-anything-v2" in clean_repo.lower():
        try:
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "downloading", "progress": 40, "total": 100, "desc": "Downloading Depth Anything ONNX model..."}
            from utilities.vision.util_depth_estimation import _ensure_depth_model
            size_key = "base" if "base" in clean_repo.lower() else "small"
            path = _ensure_depth_model(size_key)
            success = bool(path and os.path.exists(path))
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "finished" if success else "error"}
            return success
        except Exception as e:
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "error", "desc": str(e)}
            return False

    # 4. InsightFace models
    insightface_models = {
        "buffalo_l": "buffalo_l.zip",
        "buffalo_m": "buffalo_m.zip",
        "buffalo_s": "buffalo_s.zip",
        "antelopev2": "antelopev2.zip"
    }
    if clean_repo in insightface_models:
        zip_target = os.path.join(models_dir, insightface_models[clean_repo])
        success = download_hf_file(
            "vladmandic/insightface-faceanalysis", 
            insightface_models[clean_repo], 
            zip_target, 
            token=load_hf_token() or None
        )
        DOWNLOAD_PROGRESS[clean_repo] = {"status": "finished" if success else "error"}
        return success

    # 5. YOLO models (.pt files)
    if clean_repo.endswith(".pt") or ("yolo" in clean_repo.lower() and "/" not in clean_repo):
        pt_name = clean_repo if clean_repo.endswith(".pt") else f"{clean_repo}.pt"
        try:
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "downloading", "progress": 50, "total": 100, "desc": f"Fetching YOLO model {pt_name}..."}
            from ultralytics import YOLO
            YOLO(os.path.join(models_dir, pt_name))
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "finished"}
            return True
        except Exception as e:
            print(f"Failed to download YOLO model {clean_repo}: {e}")
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "error", "desc": str(e)}
            return False

    # 6. Whisper / Faster-Whisper models
    if clean_repo.startswith("Systran/faster-whisper-") or clean_repo.startswith("faster-whisper-"):
        actual_repo = clean_repo if clean_repo.startswith("Systran/") else f"Systran/{clean_repo}"
        try:
            target_dir = os.path.join(models_dir, actual_repo)
            snapshot_download(
                repo_id=actual_repo,
                local_dir=target_dir,
                local_dir_use_symlinks=False,
                token=load_hf_token() or None
            )
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "finished"}
            return True
        except Exception as e:
            print(f"Failed to download faster-whisper {clean_repo}: {e}")
            DOWNLOAD_PROGRESS[clean_repo] = {"status": "error", "desc": str(e)}
            return False

    # 7. Model aliases mapping
    target_hf_repo = clean_repo
    if clean_repo == "briaai-rmbg-1.4":
        target_hf_repo = "briaai/RMBG-1.4"
    elif clean_repo == "briaai-rmbg-2.0":
        target_hf_repo = "briaai/RMBG-2.0"

    try:
        snapshot_download(
            repo_id=target_hf_repo,
            cache_dir=models_dir,
            local_dir_use_symlinks=False,
            token=load_hf_token() or None
        )
        DOWNLOAD_PROGRESS[clean_repo] = {"status": "finished"}
        return True
    except Exception as e:
        print(f"Failed to download model {clean_repo}: {e}")
        DOWNLOAD_PROGRESS[clean_repo] = {"status": "error", "desc": str(e)}
        return False
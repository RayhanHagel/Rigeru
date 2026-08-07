import os
from typing import Optional
from utilities.util_store import get_data, set_data

CACHE_DIR = os.path.join(".", "cache")

def load_hf_token() -> str:
    """Read the cached Hugging Face token, or return empty string."""
    ai_settings = get_data("ai_settings") or {}
    return ai_settings.get("huggingface", {}).get("hf_token", "")


def save_hf_token(token: str) -> None:
    """Persist a Hugging Face token to the local store."""
    ai_settings = get_data("ai_settings") or {}
    hf_data = ai_settings.get("huggingface", {})
    hf_data["hf_token"] = token.strip()
    ai_settings["huggingface"] = hf_data
    set_data("ai_settings", ai_settings)


def download_hf_file(repo_id: str, filename: str, output_path: str, repo_type: str = "model", token: Optional[str] = None) -> bool:
    """
    Downloads a file from Hugging Face Hub and moves it to the target output_path.
    If the downloaded file is a zip, it extracts it into the directory of output_path.
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
    """
    Dynamically quantizes an FP32 ONNX model to INT8.
    Returns the quant_path if successful, otherwise falls back to model_path.
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
    """Returns total size of a directory in bytes."""
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

def list_cached_models() -> list:
    """Returns a list of downloaded models in ./cache/models/ with their sizes."""
    models_dir = os.path.join(CACHE_DIR, "models")
    if not os.path.exists(models_dir):
        return []
        
    models = []
    
    for root, dirs, files in os.walk(models_dir):
        rel_path = os.path.relpath(root, models_dir)
        if rel_path == ".":
            # Add standalone .pt files (YOLO)
            for f in files:
                if f.endswith(".pt"):
                    full_path = os.path.join(root, f)
                    models.append({
                        "id": f,
                        "repo_id": f,
                        "size_bytes": os.path.getsize(full_path),
                        "path": full_path
                    })
            # Skip hidden folders
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            continue
            
        entry = os.path.basename(root)
        
        # 1. HuggingFace default cache format
        if entry.startswith("models--"):
            repo_id = entry.replace("models--", "").replace("--", "/")
            if repo_id.startswith("Systran/Systran/faster-whisper-"):
                repo_id = repo_id.replace("Systran/Systran/faster-whisper-", "")
            models.append({
                "id": rel_path.replace("\\", "/"),
                "repo_id": repo_id,
                "size_bytes": get_directory_size(root),
                "path": root
            })
            dirs.clear() # Stop recursing inside
            
        # 2. InsightFace or Explicit local_dir models
        elif "config.json" in files or ".gitattributes" in files or entry in ["buffalo_l", "buffalo_m", "buffalo_s", "antelopev2"]:
            repo_id = rel_path.replace("\\", "/")
            models.append({
                "id": repo_id,
                "repo_id": repo_id,
                "size_bytes": get_directory_size(root),
                "path": root
            })
            dirs.clear() # Stop recursing inside
            
    return sorted(models, key=lambda x: x["size_bytes"], reverse=True)

def delete_cached_model(folder_id: str) -> bool:
    """Deletes a specific model cache folder."""
    import shutil
    
    # Security check to prevent path traversal
    if ".." in folder_id:
        return False
        
    models_dir = os.path.join(CACHE_DIR, "models")
    target_path = os.path.join(models_dir, folder_id)
    
    if os.path.exists(target_path):
        try:
            if os.path.isdir(target_path):
                shutil.rmtree(target_path)
            else:
                os.remove(target_path)
            return True
        except Exception:
            return False
    return False

DOWNLOAD_PROGRESS = {}

class ProgressTqdm:
    def __init__(self, *args, **kwargs):
        self.n = 0
        self.total = kwargs.get('total', 100) or 100
        self.desc = kwargs.get('desc', 'Downloading')
        # find the active download id from the global state if any
        self.repo_id = getattr(huggingface_hub.utils, 'CURRENT_DOWNLOAD_REPO', "unknown")
        
    def update(self, n=1):
        self.n += n
        if self.repo_id in DOWNLOAD_PROGRESS:
            # We just track bytes downloaded vs total for the current file
            # Since a repo has multiple files, we'll just send raw stats
            DOWNLOAD_PROGRESS[self.repo_id] = {
                "status": "downloading", 
                "progress": self.n,
                "total": self.total,
                "desc": self.desc
            }

    def close(self):
        pass
    
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass
        
    def set_description(self, desc):
        self.desc = desc

import huggingface_hub.utils
# Patch the tqdm class
huggingface_hub.utils.tqdm = ProgressTqdm

def download_model(repo_id: str) -> bool:
    """Downloads a full model repository to the cache directory."""
    from huggingface_hub import snapshot_download
    models_dir = os.path.join(CACHE_DIR, "models")
    os.makedirs(models_dir, exist_ok=True)
    
    DOWNLOAD_PROGRESS[repo_id] = {"status": "starting", "progress": 0, "total": 100, "desc": "Starting download..."}
    setattr(huggingface_hub.utils, 'CURRENT_DOWNLOAD_REPO', repo_id)
    
    # Handle custom InsightFace models
    insightface_models = {
        "buffalo_l": "buffalo_l.zip",
        "buffalo_m": "buffalo_m.zip",
        "buffalo_s": "buffalo_s.zip",
        "antelopev2": "antelopev2.zip"
    }
    
    if repo_id in insightface_models:
        zip_target = os.path.join(models_dir, insightface_models[repo_id])
        success = download_hf_file(
            "vladmandic/insightface-faceanalysis", 
            insightface_models[repo_id], 
            zip_target, 
            token=load_hf_token() or None
        )
        if success and os.path.exists(zip_target):
            try:
                import zipfile
                with zipfile.ZipFile(zip_target, 'r') as zip_ref:
                    zip_ref.extractall(os.path.join(models_dir, repo_id))
                os.remove(zip_target)
            except:
                pass
        DOWNLOAD_PROGRESS[repo_id] = {"status": "finished" if success else "error"}
        return success

    # Handle YOLO models (.pt files)
    if repo_id.endswith(".pt") and ("yolo" in repo_id.lower() or "sam" in repo_id.lower()):
        try:
            from ultralytics import YOLO
            # This triggers ultralytics to download it to that exact path
            YOLO(os.path.join(models_dir, repo_id))
            DOWNLOAD_PROGRESS[repo_id] = {"status": "finished"}
            return True
        except Exception as e:
            print(f"Failed to download YOLO model {repo_id}: {e}")
            DOWNLOAD_PROGRESS[repo_id] = {"status": "error"}
            return False

    # Handle Whisper / Faster-Whisper models
    whisper_models = {"tiny", "base", "small", "medium", "large-v1", "large-v2", "large-v3"}
    if repo_id.startswith("Systran/faster-whisper-"):
        actual_repo = repo_id.replace("Systran/faster-whisper-", "")
    elif repo_id.startswith("whisper-"):
        actual_repo = repo_id.replace("whisper-", "")
    else:
        actual_repo = repo_id
    
    # We only let whisperx download itself since it relies on specific formatting.
    # We let faster-whisper be downloaded via snapshot_download to explicitly manage local_dir.
    if actual_repo in whisper_models and not repo_id.startswith("Systran/faster-whisper-"):
        try:
            import whisperx
            whisperx.load_model(actual_repo, "cpu", download_root=models_dir)
            DOWNLOAD_PROGRESS[repo_id] = {"status": "finished"}
            return True
        except Exception as e:
            print(f"Failed to download Whisper model {repo_id}: {e}")
            DOWNLOAD_PROGRESS[repo_id] = {"status": "error"}
            return False

    try:
        # Download all models (including faster-whisper) directly to their local folder structure
        # This completely replaces the default HuggingFace cache structure (models-- namespace)
        target_dir = os.path.join(models_dir, repo_id)
        snapshot_download(
            repo_id=repo_id,
            local_dir=target_dir,
            local_dir_use_symlinks=False,
            token=load_hf_token() or None
        )
        DOWNLOAD_PROGRESS[repo_id] = {"status": "finished"}
        return True
    except Exception as e:
        print(f"Failed to download model {repo_id}: {e}")
        DOWNLOAD_PROGRESS[repo_id] = {"status": "error"}
        return False
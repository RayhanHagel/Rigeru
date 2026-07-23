import os
import json
from typing import Optional
from utilities.util_json import load_json

CACHE_DIR = os.path.join(".", "cache")
CREDS_FILE = os.path.join(CACHE_DIR, "hf_creds.json")


def load_hf_token() -> str:
    """Read the cached Hugging Face token, or return empty string."""
    return load_json(CREDS_FILE, lambda: {}).get("hf_token", "")


def save_hf_token(token: str) -> None:
    """Persist a Hugging Face token to the local cache directory."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(CREDS_FILE, "w", encoding="utf-8") as f:
        json.dump({"hf_token": token.strip()}, f, indent=4)


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
    # Huggingface hub caches models in directories starting with "models--"
    # Insightface models are direct directories like "buffalo_l"
    for entry in os.listdir(models_dir):
        full_path = os.path.join(models_dir, entry)
        if os.path.isdir(full_path):
            if entry.startswith("models--"):
                repo_id = entry.replace("models--", "").replace("--", "/")
                if repo_id.startswith("Systran/faster-whisper-"):
                    repo_id = repo_id.replace("Systran/faster-whisper-", "")
            elif entry not in ["temp", ".cache"]:
                repo_id = entry
            else:
                continue
                
            size_bytes = get_directory_size(full_path)
            
            models.append({
                "id": entry,
                "repo_id": repo_id,
                "size_bytes": size_bytes,
                "path": full_path
            })
        elif os.path.isfile(full_path) and entry.endswith(".pt"):
            models.append({
                "id": entry,
                "repo_id": entry,
                "size_bytes": os.path.getsize(full_path),
                "path": full_path
            })
            
    return sorted(models, key=lambda x: x["size_bytes"], reverse=True)

def delete_cached_model(folder_id: str) -> bool:
    """Deletes a specific model cache folder."""
    import shutil
    
    # Security check to prevent path traversal
    if ".." in folder_id or "/" in folder_id or "\\" in folder_id:
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

def download_model(repo_id: str) -> bool:
    """Downloads a full model repository to the cache directory."""
    from huggingface_hub import snapshot_download
    models_dir = os.path.join(CACHE_DIR, "models")
    os.makedirs(models_dir, exist_ok=True)
    
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
                os.remove(zip_target)
            except:
                pass
        return success

    # Handle YOLO models (.pt files)
    if repo_id.endswith(".pt") and ("yolo" in repo_id.lower() or "sam" in repo_id.lower()):
        try:
            from ultralytics import YOLO
            # This triggers ultralytics to download it to that exact path
            YOLO(os.path.join(models_dir, repo_id))
            return True
        except Exception as e:
            print(f"Failed to download YOLO model {repo_id}: {e}")
            return False

    # Handle Whisper models
    whisper_models = {"tiny", "base", "small", "medium", "large-v1", "large-v2", "large-v3"}
    if repo_id in whisper_models:
        try:
            import whisperx
            whisperx.load_model(repo_id, "cpu", download_root=models_dir)
            return True
        except Exception as e:
            print(f"Failed to download Whisper model {repo_id}: {e}")
            return False
            
    try:
        snapshot_download(
            repo_id=repo_id,
            cache_dir=models_dir,
            token=load_hf_token() or None
        )
        return True
    except Exception as e:
        print(f"Failed to download model {repo_id}: {e}")
        return False
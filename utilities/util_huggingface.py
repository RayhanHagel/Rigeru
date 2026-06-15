from typing import Optional


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
import os
from utilities.util_network import better_get
import zipfile
import io
import platform
import subprocess

CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache", "everything")
ES_EXE_PATH = os.path.join(CACHE_DIR, "es.exe")

def check_and_download_es():
    if os.path.exists(ES_EXE_PATH):
        return {"status": "ready"}
        
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    # Determine architecture
    arch = platform.architecture()[0]
    is_x64 = "64" in arch
    
    # Fetch latest release
    api_url = "https://api.github.com/repos/voidtools/ES/releases/latest"
    try:
        response = better_get(api_url)
        if response is None:
            return {"status": "error", "message": "Failed to fetch releases."}
        response.raise_for_status()
        data = response.json()
        
        download_url = None
        for asset in data.get("assets", []):
            name = asset.get("name", "").lower()
            if "x64" in name and is_x64:
                download_url = asset.get("browser_download_url")
                break
            elif "x86" in name and not is_x64:
                download_url = asset.get("browser_download_url")
                break
                
        if not download_url:
            for asset in data.get("assets", []):
                if asset.get("name", "").endswith(".zip"):
                    download_url = asset.get("browser_download_url")
                    break
                    
        if not download_url:
            return {"status": "error", "message": "Could not find a suitable download link."}
            
        # Download and extract
        zip_response = better_get(download_url)
        if zip_response is None:
            return {"status": "error", "message": "Failed to download zip."}
        zip_response.raise_for_status()
        
        with zipfile.ZipFile(io.BytesIO(zip_response.content)) as z:
            z.extractall(CACHE_DIR)
            
        if os.path.exists(ES_EXE_PATH):
            return {"status": "downloaded"}
        else:
            return {"status": "error", "message": "es.exe not found after extraction."}
            
    except Exception as e:
        return {"status": "error", "message": str(e)}

def start_everything_service():
    paths_to_try = [
        r"C:\Program Files\Everything\Everything.exe",
        r"C:\Program Files (x86)\Everything\Everything.exe"
    ]
    
    for p in paths_to_try:
        if os.path.exists(p):
            try:
                subprocess.Popen([p, "-startup"], creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP)
                return {"status": "started"}
            except Exception as e:
                return {"error": f"Found Everything.exe but failed to start it: {str(e)}"}
                
    return {"error": "Everything.exe not found in default installation paths. Please install the Everything desktop application from voidtools.com."}

def search_es(query: str, extension: str = None, search_path: str = None, max_results: int = 100):
    if not os.path.exists(ES_EXE_PATH):
        return {"error": "es.exe is not downloaded. Please wait for download."}
        
    try:
        args = [ES_EXE_PATH]
        
        if search_path:
            args.append(search_path)
            
        if query:
            args.append(query)
            
        if extension:
            ext_str = extension.strip().strip('.')
            if ext_str:
                args.append(f"ext:{ext_str}")
                
        args.extend(["-n", str(max_results)])
        
        creationflags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        
        result = subprocess.run(args, capture_output=True, text=True, creationflags=creationflags)
        
        if result.returncode != 0 and result.returncode != 2:
            error_msg = result.stderr.strip() or result.stdout.strip() or f"es.exe exited with code {result.returncode}"
            return {"error": error_msg}
            
        lines = result.stdout.splitlines()
        results = [line.strip() for line in lines if line.strip()]
        
        return {"results": results}
    except Exception as e:
        return {"error": str(e)}

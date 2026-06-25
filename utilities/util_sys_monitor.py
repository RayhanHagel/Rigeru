import json
from pathlib import Path

CACHE_FILE = Path("./cache/system_monitor/settings.json")

def load_settings():
    if CACHE_FILE.exists():
        with open(CACHE_FILE, "r") as f:
            return json.load(f)
    return {"history_len": 40, "proc_limit": 15}

def save_settings(settings):
    CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(settings, f)

def get_system_stats() -> dict:
    import psutil
    try:
        import GPUtil
    except ImportError:
        GPUtil = None

    cpu_percent = psutil.cpu_percent(interval=None)
    
    mem = psutil.virtual_memory()
    mem_percent = mem.percent
    mem_used_gb = mem.used / (1024 ** 3)
    mem_total_gb = mem.total / (1024 ** 3)
    
    disk = psutil.disk_usage('/')
    disk_percent = disk.percent
    disk_free_gb = disk.free / (1024 ** 3)
    disk_total_gb = disk.total / (1024 ** 3)

    gpu_percent = 0.0
    gpu_text = "No GPU / GPUtil not installed"
    
    if GPUtil:
        gpus = GPUtil.getGPUs()
        if gpus:
            gpu = gpus[0] 
            gpu_percent = round(gpu.load * 100, 1)
            gpu_text = f"{gpu.memoryUsed} MB / {gpu.memoryTotal} MB | Temp: {gpu.temperature}°C"
    
    return {
        "cpu_percent": cpu_percent,
        "mem_percent": mem_percent,
        "mem_text": f"{mem_used_gb:.1f} GB / {mem_total_gb:.1f} GB",
        "disk_percent": disk_percent,
        "disk_text": f"{disk_free_gb:.1f} GB free of {disk_total_gb:.1f} GB",
        "gpu_percent": gpu_percent,
        "gpu_text": gpu_text
    }

def get_top_processes(limit: int = 20):
    import psutil
    import pandas as pd
    
    processes = []
    
    for proc in psutil.process_iter(['pid', 'name', 'memory_percent', 'cpu_percent']):
        try:
            info = proc.info
            processes.append({
                "PID": info['pid'],
                "Name": info['name'],
                "CPU (%)": round(info['cpu_percent'] or 0.0, 2),
                "Memory (%)": round(info['memory_percent'] or 0.0, 2)
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
            
    df = pd.DataFrame(processes)
    if not df.empty:
        df = df.sort_values(by="Memory (%)", ascending=False).head(limit)
        df = df.reset_index(drop=True)
        
    return df
import os
import json
import threading

CACHE_DIR = "./cache/env"
CACHE_FILE = os.path.join(CACHE_DIR, "cache.json")

def get_registry_value(key: int, subkey: str, value_name: str) -> str:
    import winreg
    try:
        registry_key = winreg.OpenKey(key, subkey, 0, winreg.KEY_READ)
        value, _ = winreg.QueryValueEx(registry_key, value_name)
        winreg.CloseKey(registry_key)
        return str(value)
    except OSError:
        return ""
    except Exception:
        return ""

def guess_application_from_path(folder_path: str) -> str:
    if not os.path.exists(folder_path):
        return ":material/warning: Path Does Not Exist (Dead Link)"

    folder_name = os.path.basename(os.path.normpath(folder_path)).lower()

    if "scoop" in folder_path.lower():
        return f":material/inventory_2: Scoop App ({folder_name})"
    if "windowsapps" in folder_path.lower():
        return ":material/window: Windows Store App"
    if "python" in folder_name:
        return ":material/terminal: Python Environment"
    if "node" in folder_name or "npm" in folder_name:
        return ":material/code: Node.js / NPM"
    if "git" in folder_name:
        return ":material/fork_right: Git Version Control"

    try:
        exes = [f for f in os.listdir(folder_path) if f.endswith('.exe')]
        if exes:
            return f":material/settings: {exes[0][:-4].capitalize()}"
    except Exception:
        pass

    return ":material/folder: System / Unknown Utility"

def get_all_paths_sync() -> tuple[list[dict], str, str]:
    import winreg
    sys_path_raw = get_registry_value(
        winreg.HKEY_LOCAL_MACHINE, r"System\CurrentControlSet\Control\Session Manager\Environment", "Path")
    user_path_raw = get_registry_value(
        winreg.HKEY_CURRENT_USER, r"Environment", "Path")

    paths = []

    for p in sys_path_raw.split(";"):
        if p.strip():
            paths.append({"type": "System", "path": p.strip(), "app": guess_application_from_path(p.strip())})

    for p in user_path_raw.split(";"):
        if p.strip():
            paths.append({"type": "User", "path": p.strip(), "app": guess_application_from_path(p.strip())})

    return paths, sys_path_raw, user_path_raw

def fetch_and_cache():
    os.makedirs(CACHE_DIR, exist_ok=True)
    paths, sys_raw, user_raw = get_all_paths_sync()
    data = {"paths": paths, "sys_raw": sys_raw, "user_raw": user_raw}
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f)

def load_env_data() -> tuple[list[dict], str, str]:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            try:
                data = json.load(f)
                threading.Thread(target=fetch_and_cache, daemon=True).start()
                return data.get("paths", []), data.get("sys_raw", ""), data.get("user_raw", "")
            except json.JSONDecodeError:
                pass
    
    fetch_and_cache()
    with open(CACHE_FILE, "r") as f:
        data = json.load(f)
    return data.get("paths", []), data.get("sys_raw", ""), data.get("user_raw", "")

def force_refresh():
    fetch_and_cache()

def export_env_backup() -> str:
    _, sys_raw, user_raw = load_env_data()
    return f"=== WINDOWS ENVIRONMENT BACKUP ===\n\n[SYSTEM PATH]\n{sys_raw}\n\n[USER PATH]\n{user_raw}\n"
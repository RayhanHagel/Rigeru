import os
import threading
from typing import Any, Dict, List, Tuple
from utilities.core.util_store import get_data, set_data

def get_registry_value(key: int, subkey: str, value_name: str) -> str:
    """
    Read a string property value from the Windows Registry.

    Args:
        key (int): Windows HKEY root hive handle (e.g. HKEY_LOCAL_MACHINE).
        subkey (str): Subkey registry path string.
        value_name (str): Named value to read.

    Returns:
        str: Value string contents or empty string on failure.
    """
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
    """
    Heuristically categorize the application or tool associated with a PATH directory.

    Args:
        folder_path (str): Filesystem folder path from PATH.

    Returns:
        str: Human-readable application label.
    """
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

def get_all_paths_sync() -> tuple[list[dict[str, str]], str, str]:
    """
    Synchronously read and parse system and user PATH variables from the registry.

    Returns:
        tuple[list[dict[str, str]], str, str]: Structured list of path records, raw system path, and raw user path.
    """
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

def fetch_and_cache() -> None:
    """
    Fetch environment paths and persist snapshot to the SQLite store.

    Returns:
        None
    """
    paths, sys_raw, user_raw = get_all_paths_sync()
    data = {"paths": paths, "sys_raw": sys_raw, "user_raw": user_raw}
    set_data("env_paths", data)

def load_env_data() -> tuple[list[dict[str, str]], str, str]:
    """
    Load environment paths from store with asynchronous background revalidation.

    Returns:
        tuple[list[dict[str, str]], str, str]: Parsed path records, raw system path string, and raw user path string.
    """
    data = get_data("env_paths")
    if data:
        threading.Thread(target=fetch_and_cache, daemon=True).start()
        return data.get("paths", []), data.get("sys_raw", ""), data.get("user_raw", "")
    
    fetch_and_cache()
    data = get_data("env_paths") or {}
    return data.get("paths", []), data.get("sys_raw", ""), data.get("user_raw", "")

def force_refresh() -> None:
    """
    Force an immediate synchronous refresh of the cached environment paths.

    Returns:
        None
    """
    fetch_and_cache()

def export_env_backup() -> str:
    """
    Format system and user PATH variables into an exportable plain text backup string.

    Returns:
        str: Formatted plain text environment backup.
    """
    _, sys_raw, user_raw = load_env_data()
    return f"=== WINDOWS ENVIRONMENT BACKUP ===\n\n[SYSTEM PATH]\n{sys_raw}\n\n[USER PATH]\n{user_raw}\n"
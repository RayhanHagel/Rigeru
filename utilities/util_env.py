import os
import winreg
import streamlit as st


def get_registry_value(key: int, subkey: str, value_name: str) -> str:
    """Reads a value from the Windows Registry safely."""
    try:
        registry_key = winreg.OpenKey(key, subkey, 0, winreg.KEY_READ)
        value, _ = winreg.QueryValueEx(registry_key, value_name)
        winreg.CloseKey(registry_key)
        return str(value)
    except WindowsError:
        return ""
    except Exception:
        return ""


def guess_application_from_path(folder_path: str) -> str:
    """Scans a directory to figure out which application uses it."""
    if not os.path.exists(folder_path):
        return ":material/warning: Path Does Not Exist (Dead Link)"

    folder_name = os.path.basename(os.path.normpath(folder_path)).lower()

    # Common recognizable keywords in folder names
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

    # Scan for dominant executables if folder name is generic
    try:
        exes = [f for f in os.listdir(folder_path) if f.endswith('.exe')]
        if exes:
            # Return the first recognizable exe without the extension
            return f":material/settings: {exes[0][:-4].capitalize()}"
    except Exception:
        pass

    return ":material/folder: System / Unknown Utility"


@st.cache_data(ttl=60)
def get_all_paths() -> tuple[list[dict], str, str]:
    """Fetches and parses both System and User PATH variables."""
    # System PATH
    sys_path_raw = get_registry_value(
        winreg.HKEY_LOCAL_MACHINE, r"System\CurrentControlSet\Control\Session Manager\Environment", "Path")
    # User PATH
    user_path_raw = get_registry_value(
        winreg.HKEY_CURRENT_USER, r"Environment", "Path")

    paths = []

    for p in sys_path_raw.split(";"):
        if p.strip():
            paths.append({"type": "System", "path": p.strip(),
                         "app": guess_application_from_path(p.strip())})

    for p in user_path_raw.split(";"):
        if p.strip():
            paths.append({"type": "User", "path": p.strip(),
                         "app": guess_application_from_path(p.strip())})

    return paths, sys_path_raw, user_path_raw


def export_env_backup() -> str:
    """Generates a text backup of all current variables."""
    _, sys_raw, user_raw = get_all_paths()
    backup = f"=== WINDOWS ENVIRONMENT BACKUP ===\n\n[SYSTEM PATH]\n{sys_raw}\n\n[USER PATH]\n{user_raw}\n"
    return backup

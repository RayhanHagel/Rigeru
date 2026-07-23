import os
import sys
import subprocess

def open_file_in_os(file_path: str) -> tuple[bool, str]:
    """Opens the downloaded file or folder in the OS file manager."""
    if not file_path or not os.path.exists(file_path):
        return False, ":material/error: File no longer exists."
    try:
        if sys.platform == "win32":
            os.startfile(file_path)
        elif sys.platform == "darwin":
            subprocess.call(["open", file_path])
        else:
            subprocess.call(["xdg-open", file_path])
        return True, f":material/menu_book: Opened: {os.path.basename(file_path)}"
    except Exception as e:
        return False, f":material/error: Failed to open file: {e}"

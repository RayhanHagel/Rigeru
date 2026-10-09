import os
import sys
import subprocess

def open_file_in_os(file_path: str) -> tuple[bool, str]:
    """
    Launch a file or directory using the native host operating system file manager or default handler.

    Args:
        file_path (str): Absolute or relative filesystem path.

    Returns:
        tuple[bool, str]: Success boolean flag and user-facing status message.
    """
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

import os
import ctypes

def get_directory_contents(path: str = "", include_files: bool = False) -> dict:
    """Returns directory contents for the given path, or drives if empty."""
    if not path:
        # Root level - list drives on Windows
        drives = []
        try:
            bitmask = ctypes.windll.kernel32.GetLogicalDrives()
            for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
                if bitmask & 1:
                    drives.append({"name": f"{letter}:\\", "path": f"{letter}:\\"})
                bitmask >>= 1
            return {"current_path": "", "parent_path": "", "folders": drives, "files": []}
        except Exception:
            return {"current_path": "", "parent_path": "", "folders": [], "files": []}
        
    if not os.path.exists(path) or not os.path.isdir(path):
        raise ValueError("Directory not found")
        
    folders = []
    files = []
    try:
        for item in os.listdir(path):
            full_path = os.path.join(path, item)
            if os.path.isdir(full_path):
                folders.append({"name": item, "path": full_path})
            elif include_files and os.path.isfile(full_path):
                files.append({"name": item, "path": full_path})
    except PermissionError:
        pass # Skip folders we can't access
        
    # Sort alphabetically
    folders.sort(key=lambda x: x["name"].lower())
    files.sort(key=lambda x: x["name"].lower())
    
    # Determine parent path
    parent_path = os.path.dirname(path)
    if parent_path == path: # e.g., C:\ is its own parent
        parent_path = "" # Go back to drive list
        
    return {
        "current_path": path,
        "parent_path": parent_path,
        "folders": folders,
        "files": files
    }

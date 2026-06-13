import os
import json
import hashlib
import tkinter as tk
from tkinter import filedialog
from datetime import datetime

def _init_tkinter():
    """Helper to initialize a hidden, top-most tkinter root window."""
    root = tk.Tk()
    root.withdraw()
    root.attributes('-topmost', True)
    return root

def open_folder_dialog(current_path: str = "") -> str:
    """Opens a native OS folder selection dialog."""
    root = _init_tkinter()
    selected = filedialog.askdirectory(
        initialdir=current_path if os.path.exists(current_path) else os.path.expanduser('~'),
        title="Select Folder"
    )
    root.destroy()
    return selected if selected else current_path

def open_json_dialog() -> str:
    """Opens a native OS file dialog strictly for JSON snapshot files."""
    root = _init_tkinter()
    selected = filedialog.askopenfilename(
        title="Select Hash Snapshot File",
        filetypes=[("JSON files", "*.json")]
    )
    root.destroy()
    return selected

def calculate_hash(file_path: str, chunk_size: int = 8192) -> str:
    """Calculates the SHA-256 hash of a file efficiently by reading in chunks."""
    sha256 = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            while chunk := f.read(chunk_size):
                sha256.update(chunk)
        return sha256.hexdigest()
    except Exception as e:
        return f"ERROR: {str(e)}"

def create_snapshot(target_dir: str, save_path: str) -> tuple[bool, str]:
    """Generates a JSON snapshot of all file hashes in the target directory."""
    if not os.path.isdir(target_dir):
        return False, "Target directory does not exist."
        
    snapshot = {}
    file_count = 0
    
    for root, _, files in os.walk(target_dir):
        for file in files:
            file_path = os.path.join(root, file)
            # Store relative path so the directory can be moved
            rel_path = os.path.relpath(file_path, target_dir)
            file_hash = calculate_hash(file_path)
            
            snapshot[rel_path] = file_hash
            file_count += 1
            
    snapshot_data = {
        "timestamp": datetime.now().isoformat(),
        "root_dir": target_dir,
        "files": snapshot
    }
    
    try:
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(snapshot_data, f, indent=4)
        return True, f"✅ Created snapshot of {file_count} files at {save_path}"
    except Exception as e:
        return False, f"❌ Failed to save snapshot: {e}"

def verify_integrity(target_dir: str, snapshot_path: str) -> tuple[bool, dict | None, str]:
    """Compares the current directory against a saved JSON hash snapshot."""
    if not os.path.isdir(target_dir):
        return False, None, "Target directory does not exist."
    if not os.path.isfile(snapshot_path):
        return False, None, "Snapshot file does not exist."
        
    try:
        with open(snapshot_path, 'r', encoding='utf-8') as f:
            snapshot_data = json.load(f)
            baseline = snapshot_data.get("files", {})
    except Exception as e:
        return False, None, f"Failed to read snapshot: {e}"

    current_files = {}
    for root, _, files in os.walk(target_dir):
        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, target_dir)
            current_files[rel_path] = calculate_hash(file_path)

    results = {
        "ok": [],
        "modified": [],
        "missing": [],
        "new": []
    }

    # Check baseline files
    for rel_path, original_hash in baseline.items():
        if rel_path not in current_files:
            results["missing"].append(rel_path)
        elif current_files[rel_path] != original_hash:
            results["modified"].append(rel_path)
        else:
            results["ok"].append(rel_path)

    # Check for new files not in baseline
    for rel_path in current_files.keys():
        if rel_path not in baseline:
            results["new"].append(rel_path)

    return True, results, "Scan complete."
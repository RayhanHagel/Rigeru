import os
import json
import hashlib
from datetime import datetime
import concurrent.futures
from utilities.util_json import load_json

# OPTIMIZED: Helper to recursively scan directories natively via scandir
def _scan_files_fast(path: str):
    try:
        with os.scandir(path) as it:
            for entry in it:
                if entry.is_dir(follow_symlinks=False):
                    yield from _scan_files_fast(entry.path)
                else:
                    yield entry.path
    except PermissionError:
        pass

def calculate_hash(file_path: str) -> str:
    """Calculates the SHA-256 hash natively via C engine bypassing python loop overhead."""
    try:
        with open(file_path, "rb") as f:
            return hashlib.file_digest(f, "sha256").hexdigest()
    except Exception as e:
        return f"ERROR: {str(e)}"

def create_snapshot(target_dir: str, save_path: str) -> tuple[bool, str]:
    """Generates a JSON snapshot of all file hashes leveraging a ProcessPoolExecutor."""
    if not os.path.isdir(target_dir):
        return False, "Target directory does not exist."
        
    # OPTIMIZED: Replaced os.walk with os.scandir generator
    paths_to_hash = list(_scan_files_fast(target_dir))
            
    # Utilize O(N/Cores) multi-processing
    with concurrent.futures.ProcessPoolExecutor() as executor:
        hashes = list(executor.map(calculate_hash, paths_to_hash))
        
    snapshot = {
        os.path.relpath(path, target_dir): h
        for path, h in zip(paths_to_hash, hashes)
    }
            
    snapshot_data = {
        "timestamp": datetime.now().isoformat(),
        "root_dir": target_dir,
        "files": snapshot
    }
    
    try:
        with open(save_path, 'w', encoding='utf-8') as f:
            json.dump(snapshot_data, f, indent=4)
        return True, f"✅ Created snapshot of {len(snapshot)} files at {save_path}"
    except Exception as e:
        return False, f"❌ Failed to save snapshot: {e}"

def verify_integrity(target_dir: str, snapshot_path: str) -> tuple[bool, dict | None, str]:
    """Compares the current directory against a saved JSON hash using native Set Math."""
    if not os.path.isdir(target_dir):
        return False, None, "Target directory does not exist."
    if not os.path.isfile(snapshot_path):
        return False, None, "Snapshot file does not exist."
        
    try:
        snapshot_data = load_json(snapshot_path, lambda: {})
        baseline = snapshot_data.get("files", {})
    except Exception as e:
        return False, None, f"Failed to read snapshot: {e}"

    current_files = {}
    
    # OPTIMIZED: Replaced os.walk with os.scandir generator
    for path in _scan_files_fast(target_dir):
        rel_path = os.path.relpath(path, target_dir)
        current_files[rel_path] = calculate_hash(path)

    baseline_keys = set(baseline.keys())
    current_keys = set(current_files.keys())
    
    # O(N) optimized native Set logic operations
    results = {
        "ok": [],
        "modified": [],
        "missing": list(baseline_keys - current_keys),
        "new": list(current_keys - baseline_keys)
    }

    # Evaluate overlap
    for key in (baseline_keys & current_keys):
        if current_files[key] != baseline[key]:
            results["modified"].append(key)
        else:
            results["ok"].append(key)

    return True, results, "Scan complete."
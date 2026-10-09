import os
import json
import hashlib
from datetime import datetime
import concurrent.futures
from typing import Generator

def _scan_files_fast(path: str) -> Generator[str, None, None]:
    """Helper to recursively scan directories natively via scandir.

    Args:
        path (str): Target directory path.

    Returns:
        Generator[str, None, None]: Generator yielding absolute file paths.
    """
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
    """Calculates the SHA-256 hash natively via C engine bypassing python loop overhead.

    Args:
        file_path (str): Path to the target file.

    Returns:
        str: SHA-256 hexadecimal hash string or error string.
    """
    try:
        with open(file_path, "rb") as f:
            return hashlib.file_digest(f, "sha256").hexdigest()
    except Exception as e:
        return f"ERROR: {str(e)}"

def create_snapshot(target_dir: str, save_path: str) -> tuple[bool, str]:
    """Generates a JSON snapshot of all file hashes leveraging a ProcessPoolExecutor.

    Args:
        target_dir (str): Target directory to scan and hash.
        save_path (str): Path to write the JSON snapshot file.

    Returns:
        tuple[bool, str]: (success flag, result message or error description).
    """
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
    """Compares the current directory against a saved JSON hash using native Set Math.

    Args:
        target_dir (str): Directory path to verify.
        snapshot_path (str): Path to the baseline JSON snapshot file.

    Returns:
        tuple[bool, dict | None, str]: (success flag, comparison diff dictionary or None, status message).
    """
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
import os
import shutil
import tempfile
import sys
import subprocess
import zipfile
import xml.etree.ElementTree as ET
import itertools
import hashlib
from send2trash import send2trash




def get_target_files(source_path: str) -> list:
    """
    Retrieves a list of non-ignored files from the given source directory.
    Ignores common system files like desktop.ini, .ds_store, and thumbs.db.
    """
    if not os.path.isdir(source_path):
        return []
    ignored_files = {'desktop.ini', '.ds_store', 'thumbs.db'}
    return sorted([e.name for e in os.scandir(source_path) if e.name.lower() not in ignored_files])





def perform_move(src_file_path: str, dest_dir: str, current_file: str, rename_value: str) -> tuple[bool, str, str, str]:
    """
    Moves (and optionally renames) a file to a destination directory.
    Handles filename conflicts by appending a counter suffix if needed.
    """
    ext = os.path.splitext(current_file)[1]
    new_name = rename_value.strip() if rename_value and rename_value.strip() else ""
    if new_name and new_name != os.path.splitext(current_file)[0]:
        if not os.path.splitext(new_name)[1]:
            new_name += ext
        dest_filename = new_name
        record_action = "rename"
    else:
        dest_filename = current_file
        record_action = "move"

    dest_file = os.path.join(dest_dir, dest_filename)
    if os.path.exists(dest_file):
        base, e = os.path.splitext(dest_filename)
        dest_filename = f"{base}_1{e}"
        dest_file = os.path.join(dest_dir, dest_filename)

    try:
        os.makedirs(dest_dir, exist_ok=True)
        shutil.move(src_file_path, dest_file)
        return True, dest_filename, record_action, ""
    except Exception as e:
        return False, "", "", str(e)


def perform_delete(src_file_path: str) -> tuple[bool, str]:
    """
    Safely deletes a file by moving it to the OS trash instead of permanent deletion.
    """
    try:
        clean_path = src_file_path.replace('\\\\?\\', '').replace('//?/', '')
        send2trash(clean_path)
        return True, ""
    except Exception as e:
        return False, str(e)


def perform_undo(last_action: dict, source_path: str, dest_base_path: str) -> tuple[bool, str]:
    """
    Undoes a previous file operation (move, rename, or skip).
    For moves/renames, it restores the file to its original location.
    """
    if last_action["action"] in ("move", "rename"):
        src_restore = os.path.join(
            dest_base_path, last_action["target"] or "", last_action["dest_file"])
        dst_restore = os.path.join(source_path, last_action["orig_file"])
        try:
            shutil.move(src_restore, dst_restore)
            return True, f":material/undo: Undid: {last_action['dest_file']} ← {last_action['target']}"
        except Exception as e:
            return False, f":material/error: Undo failed: {e}"
    elif last_action["action"] == "delete":
        return True, f":material/warning: Stepped back. Note: '{last_action['orig_file']}' is in your OS Trash."
    else:
        return True, f":material/undo: Undid skip: {last_action['orig_file']}"

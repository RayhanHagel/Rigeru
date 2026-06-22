import os
import streamlit as st
from collections import deque
from utilities.util_file_mover import (
    get_target_files, perform_move,
    perform_delete, perform_undo, open_file_in_os, open_folder_dialog
)

MAX_DEPTH = 5

if "fm_state" not in st.session_state:
    st.session_state.fm_state = {
        "files_list": [],
        "current_idx": 0,
        "history": deque(maxlen=50),
        "sels_list": [None] * MAX_DEPTH,
        "status": "Ready to scan.",
        "source_path": os.path.join(os.path.expanduser('~'), 'Downloads'),
        "dest_path": ""
    }

st.header("🗂️ Rapid File Organizer")
st.markdown("Browse your folders, scan, then **Open**, **Move**, **Rename**, **Skip**, **Delete**, or **Undo**.")

def update_status(msg):
    st.session_state.fm_state["status"] = msg

def next_file(msg, record_history=None):
    if record_history:
        st.session_state.fm_state["history"].append(record_history)
            
    st.session_state.fm_state["current_idx"] += 1
    update_status(msg)

# Isolated Callbacks
def do_skip(current_file):
    next_file(f":material/skip_next: Skipped: {current_file}", {"action": "skip", "orig_file": current_file, "dest_file": current_file, "target": None})

def do_delete(src_file_path, current_file):
    success, err = perform_delete(src_file_path)
    if success:
        next_file(f":material/delete: Trashed: {current_file}", {"action": "delete", "orig_file": current_file, "dest_file": None, "target": None})
    else:
        update_status(f":material/error: Delete Error: {err}")


# --- 1. Configuration & Scanning ---
with st.container(border=True):
    col_src, col_src_btn = st.columns([4, 1], vertical_alignment="bottom")
    col_src.text_input("Source Directory (To Scan)", value=st.session_state.fm_state["source_path"], disabled=True)
    if col_src_btn.button("Browse Source", width="stretch", icon=":material/folder_open:"):
        st.session_state.fm_state["source_path"] = open_folder_dialog(st.session_state.fm_state["source_path"])
        st.rerun()

    col_dst, col_dst_btn = st.columns([4, 1], vertical_alignment="bottom")
    col_dst.text_input("Destination Root Directory", value=st.session_state.fm_state["dest_path"], disabled=True)
    if col_dst_btn.button("Browse Destination", width="stretch", icon=":material/folder_open:"):
        st.session_state.fm_state["dest_path"] = open_folder_dialog(st.session_state.fm_state["dest_path"])
        st.rerun()

    if st.button("🔍 Scan Folder", type="primary", width="stretch"):
        if not os.path.isdir(st.session_state.fm_state["source_path"]):
            update_status(":material/error: Invalid source path.")
        else:
            with st.spinner("Scanning directory..."):
                files = get_target_files(st.session_state.fm_state["source_path"])
                st.session_state.fm_state["files_list"] = files
                st.session_state.fm_state["current_idx"] = 0
                st.session_state.fm_state["history"] = []
                update_status(f":material/check: Found {len(files)} files ready to organize.")
        st.rerun()

# Status Banner
if st.session_state.fm_state["status"].startswith(":material/error:"):
    st.error(st.session_state.fm_state["status"])
else:
    st.info(st.session_state.fm_state["status"])

st.divider()

# --- 2. Interactive Sorting Area ---
files_list = st.session_state.fm_state["files_list"]
current_idx = st.session_state.fm_state["current_idx"]

if not files_list:
    st.write("No files scanned yet. Select a source folder and click **Scan Folder**.")
elif current_idx >= len(files_list):
    st.success("🎉 All files have been processed!")
    if st.button("🔄 Start Over", width="stretch"):
        st.session_state.fm_state["files_list"] = []
        st.session_state.fm_state["current_idx"] = 0
        st.rerun()
else:
    current_file = files_list[current_idx]
    src_file_path = os.path.join(st.session_state.fm_state["source_path"], current_file)

    st.markdown(f"### File {current_idx + 1} of {len(files_list)}")
    st.markdown(f"**`{current_file}`**")

    st.markdown("#### Quick Actions")
    col_open, col_skip, col_del = st.columns(3)

    if col_open.button("Open File", width="stretch", icon=":material/file_open:"):
        open_file_in_os(src_file_path)

    # Replaced procedural st.rerun checks with direct Callback Hooks
    col_skip.button("Skip", width="stretch", icon=":material/skip_next:", on_click=do_skip, args=(current_file,))
    col_del.button("Send to Trash", type="primary", width="stretch", icon=":material/delete:", on_click=do_delete, args=(src_file_path, current_file))

    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("#### Move & Rename")

    dest_dir = st.session_state.fm_state["dest_path"]

    col_rename, col_move = st.columns([3, 1], vertical_alignment="bottom")
    rename_val = col_rename.text_input("Rename file to (leave blank to keep original name):", key=f"rn_{current_idx}")

    if col_move.button("Move File", type="primary", width="stretch", icon=":material/drive_file_move:"):
        if not dest_dir or not os.path.isdir(dest_dir):
            update_status(":material/error: Please select a valid Destination Directory above.")
        else:
            target_rel_path = ""
            success, final_name, action_type, err = perform_move(src_file_path, dest_dir, current_file, rename_val)

            if success:
                msg = f":material/check: Renamed & moved: {current_file} → {final_name}" if action_type == "rename" else f":material/check: Moved: {current_file}"
                next_file(msg, {"action": action_type, "orig_file": current_file, "dest_file": final_name, "target": target_rel_path})
            else:
                update_status(f":material/error: Move Error: {err}")
        st.rerun()

# --- 3. Undo History ---
if st.session_state.fm_state["history"]:
    st.divider()
    if st.button("↩️ Undo Last Action", width="stretch"):
        last_action = st.session_state.fm_state["history"].pop()
        success, err = perform_undo(last_action, st.session_state.fm_state["source_path"], st.session_state.fm_state["dest_path"])

        if success:
            st.session_state.fm_state["current_idx"] -= 1
            update_status(f":material/undo: Undid action for: {last_action['orig_file']}")
        else:
            update_status(f":material/error: Undo failed: {err}")
            st.session_state.fm_state["history"].append(last_action)
        st.rerun()



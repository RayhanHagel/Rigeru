import os
import streamlit as st
from utilities.util_hash import create_snapshot, verify_integrity
from utilities.util_persistent import apply_footer

# --- State Initialization ---
if "hash_target_dir" not in st.session_state:
    st.session_state.hash_target_dir = os.path.join(os.path.expanduser('~'), 'Documents')
if "hash_results" not in st.session_state:
    st.session_state.hash_results = None

st.header("🛡️ File Integrity Checker")
st.markdown("Take a digital fingerprint of your folders and verify them later to detect corruption or tampering.")

tab1, tab2 = st.tabs(["📸 1. Create Baseline Snapshot", "🔍 2. Verify Integrity"])

# --- TAB 1: CREATE SNAPSHOT ---
with tab1:
    with st.container(border=True):
        target_dir_snap = st.text_input(
            "Folder to Fingerprint",
            value=st.session_state.hash_target_dir,
            key="snap_dir_input",
            help="Enter the full path to the folder you want to fingerprint."
        )
        st.info("This will scan every file in the selected directory and generate a JSON file of SHA-256 hashes.")

        if st.button("🚀 Generate Fingerprint", type="primary", width="stretch", key="btn_generate_snap"):
            if not os.path.isdir(target_dir_snap):
                st.error("Directory not found. Please enter a valid path.")
            else:
                st.session_state.hash_target_dir = target_dir_snap
                with st.spinner("Calculating hashes... This might take a while for large folders."):
                    os.makedirs("./cache", exist_ok=True)
                    safe_name = "".join(
                        c for c in os.path.basename(target_dir_snap) if c.isalpha() or c.isdigit() or c == ' '
                    ).rstrip()
                    output_file = os.path.join("./cache", f"hash_snapshot_{safe_name}.json")

                    success, msg = create_snapshot(target_dir_snap, output_file)
                    if success:
                        st.success(f"Snapshot saved to: `{output_file}`")
                        # Offer the snapshot for download
                        with open(output_file, "rb") as f:
                            st.download_button(
                                "💾 Download Snapshot JSON",
                                data=f.read(),
                                file_name=os.path.basename(output_file),
                                mime="application/json",
                                width="stretch"
                            )
                    else:
                        st.error(msg)

# --- TAB 2: VERIFY INTEGRITY ---
with tab2:
    with st.container(border=True):
        target_dir_verify = st.text_input(
            "Target Folder (To Verify)",
            value=st.session_state.hash_target_dir,
            key="verify_dir_input",
            help="Enter the full path to the folder you want to verify."
        )

        # FIX: st.file_uploader replaces tkinter JSON dialog
        st.markdown("**Upload Snapshot JSON**")
        uploaded_snapshot = st.file_uploader(
            "Upload your previously generated snapshot .json file",
            type=["json"],
            key="snapshot_uploader",
            label_visibility="collapsed"
        )
        if uploaded_snapshot:
            st.caption(f"📎 `{uploaded_snapshot.name}`")

        if st.button("🔍 Run Integrity Scan", type="primary", width="stretch", key="btn_run_scan"):
            if not os.path.isdir(target_dir_verify):
                st.error("Please enter a valid target folder path.")
            elif not uploaded_snapshot:
                st.error("Please upload a snapshot JSON file.")
            else:
                # Write snapshot to temp file
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False, suffix=".json") as tmp:
                    tmp.write(uploaded_snapshot.read())
                    tmp_snap_path = tmp.name

                with st.spinner("Verifying hashes..."):
                    success, results, msg = verify_integrity(target_dir_verify, tmp_snap_path)
                    os.unlink(tmp_snap_path)

                    if success:
                        st.session_state.hash_results = results
                        st.toast("Scan complete!", icon="✅")
                    else:
                        st.error(msg)

    # --- Results Rendering ---
    if st.session_state.hash_results:
        res = st.session_state.hash_results
        st.markdown("### Scan Results Breakdown")

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("✅ Unchanged", len(res.get('ok', [])))
        m2.metric("⚠️ Modified", len(res.get('modified', [])))
        m3.metric("❌ Missing", len(res.get('missing', [])))
        m4.metric("➕ New/Untracked", len(res.get('new', [])))

        if res.get('modified') or res.get('missing'):
            st.error("🚨 Warning: Changes detected in baseline files!")

            if res.get('modified'):
                with st.expander("Show Modified / Corrupted Files", expanded=True):
                    st.write("These files exist but their contents have changed:")
                    st.code("\n".join(res['modified']), language="text")

            if res.get('missing'):
                with st.expander("Show Missing Files", expanded=True):
                    st.write("These files were in the snapshot but are no longer present:")
                    st.code("\n".join(res['missing']), language="text")
        else:
            st.success("🎉 All baseline files passed the integrity check perfectly!")

        if res.get('new'):
            with st.expander("Show New / Untracked Files", expanded=False):
                st.write("These files were added after the snapshot was taken:")
                st.code("\n".join(res['new']), language="text")

apply_footer()

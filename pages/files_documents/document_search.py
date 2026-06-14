import os
import sys
import subprocess
import streamlit as st
from utilities.util_doc_search import build_index, search_documents
from utilities.util_persistent import apply_footer
from streamlit.runtime.scriptrunner import add_script_run_ctx
import threading

# --- State Initialization ---
if "ds_status" not in st.session_state:
    st.session_state.ds_status = "Ready."

st.header("🔎 Personal Document Search")
st.markdown("Instantly search inside your PDFs, Word documents, and text files offline.")

# --- 1. Indexing Configuration ---
with st.expander("⚙️ Indexing Settings", expanded=False):
    st.info("You must build the index at least once before searching. Rebuild it when you add new files.")
    
    col_path, col_btn = st.columns([3, 1], vertical_alignment="bottom")
    
    default_dir = os.path.join(os.path.expanduser('~'), 'Documents')
    target_dir = col_path.text_input("Folder to Index", value=default_dir)
    
    if col_btn.button("🏗️ Build / Update Index", width="stretch"):
        if not os.path.isdir(target_dir):
            st.session_state.ds_status = "❌ Error: Directory not found."
        else:
            st.session_state.ds_status = "🔄 Building index in background..."
            
            def _build_index_bg():
                indexed, skipped = build_index(target_dir)
                st.session_state.ds_status = f"✅ Indexed {indexed} new/modified files. Skipped {skipped} unchanged files."
            
            index_thread = threading.Thread(target=_build_index_bg)
            add_script_run_ctx(index_thread)
            index_thread.start()
            st.rerun()
        
    st.caption(st.session_state.ds_status)

st.divider()

# --- 2. Search Interface ---
col_search, col_exec = st.columns([4, 1], vertical_alignment="bottom")
search_query = col_search.text_input("Search Documents", placeholder="Type a keyword, phrase, or name...", key="ds_query")

# We use a button to trigger search to prevent spamming the index engine on every keystroke
if col_exec.button("🔍 Search", type="primary", width="stretch") or search_query:
    if search_query:
        with st.spinner("Searching index..."):
            success, msg, results = search_documents(search_query)
        
        if not success:
            st.warning(msg)
        elif len(results) == 0:
            st.info("No matching documents found.")
        else:
            st.success(msg)
            
            # Render Results
            for idx, res in enumerate(results):
                with st.container(border=True):
                    r_col_title, r_col_btn = st.columns([4, 1], vertical_alignment="center")
                    r_col_title.markdown(f"#### 📄 {res['title']}")
                    r_col_title.markdown(f"**Path:** `{res['path']}`")
                    
                    # File Opener Logic
                    if r_col_btn.button("📂 Open File", key=f"open_{idx}", width="stretch"):
                        try:
                            if sys.platform == "win32": 
                                os.startfile(res['path'])
                            elif sys.platform == "darwin": 
                                subprocess.call(["open", res['path']])
                            else: 
                                subprocess.call(["xdg-open", res['path']])
                        except Exception as e:
                            st.toast(f"Failed to open file: {e}", icon=":material/error:")
                    
                    # Display the text snippet if available (from whoosh highlights)
                    if res.get('snippet'):
                        st.markdown("> " + res['snippet'], unsafe_allow_html=True)
    else:
        st.warning("Please enter a search term.")

apply_footer()
import os
import tempfile
import datetime
import streamlit as st
from utilities.util_metadata import get_file_timestamps, set_file_timestamps
from utilities.util_persistent import apply_footer

st.header("🕒 Timestamp Modifier")
st.markdown("Forcefully rewrite OS-level file creation, modification, and access timestamps for any file.")

# --- File Upload (replaces tkinter) ---
with st.container(border=True):
    uploaded_file = st.file_uploader(
        "Select any file to modify its timestamps",
        key="timestamp_uploader"
    )
    if uploaded_file:
        st.caption(f"📎 `{uploaded_file.name}`")

st.divider()

# --- Timestamp Editor ---
if uploaded_file:
    suffix = os.path.splitext(uploaded_file.name)[1] or ".tmp"

    # Write to a temp file so we can read/write OS timestamps
    if "loaded_ts_name" not in st.session_state or st.session_state.loaded_ts_name != uploaded_file.name:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(uploaded_file.read())
            st.session_state.ts_tmp_path = tmp.name
        st.session_state.file_ts = get_file_timestamps(st.session_state.ts_tmp_path)
        st.session_state.loaded_ts_name = uploaded_file.name

    ts = st.session_state.file_ts
    tmp_path = st.session_state.ts_tmp_path

    st.markdown("### Edit File Timestamps")

    st.markdown("**Date Created**")
    c_date_col, c_time_col = st.columns(2)
    new_c_date = c_date_col.date_input("Created (Date)", value=ts["created"].date(), label_visibility="collapsed", key="ts_c_date")
    new_c_time = c_time_col.time_input("Created (Time)", value=ts["created"].time(), label_visibility="collapsed", key="ts_c_time")

    st.markdown("**Date Modified**")
    m_date_col, m_time_col = st.columns(2)
    new_m_date = m_date_col.date_input("Modified (Date)", value=ts["modified"].date(), label_visibility="collapsed", key="ts_m_date")
    new_m_time = m_time_col.time_input("Modified (Time)", value=ts["modified"].time(), label_visibility="collapsed", key="ts_m_time")

    st.markdown("**Date Accessed**")
    a_date_col, a_time_col = st.columns(2)
    new_a_date = a_date_col.date_input("Accessed (Date)", value=ts["accessed"].date(), label_visibility="collapsed", key="ts_a_date")
    new_a_time = a_time_col.time_input("Accessed (Time)", value=ts["accessed"].time(), label_visibility="collapsed", key="ts_a_time")

    st.write("")

    if st.button("⏱️ Override OS Timestamps", type="primary", width="stretch"):
        with st.spinner("Injecting timestamps via Win32 API..."):
            final_c = datetime.datetime.combine(new_c_date, new_c_time)
            final_m = datetime.datetime.combine(new_m_date, new_m_time)
            final_a = datetime.datetime.combine(new_a_date, new_a_time)

            success, msg = set_file_timestamps(tmp_path, final_c, final_m, final_a)
            if success:
                st.success(msg)
                st.session_state.file_ts = {"created": final_c, "modified": final_m, "accessed": final_a}
            else:
                st.error(msg)
else:
    st.info("Upload any file to view and modify its timestamps.")

apply_footer()

import streamlit as st
from utilities.util_mega import process_mega_link


# --- State Initialization ---
if "mega_raw" not in st.session_state:
    st.session_state.mega_raw = ""
    st.session_state.mega_named = ""
    st.session_state.mega_size = "0.00 GB (0 MB)"
    st.session_state.mega_logs = ""

st.header("📁 Anonymous MEGA Link Filter & De-duplicator")
st.markdown("Extract individual file links from a master MEGA folder, filter by size, and remove duplicates automatically.")

# --- Configuration & Input ---
with st.container(border=True):
    link_input = st.text_input(
        label="Public MEGA Folder Link", 
        placeholder="https://mega.nz/folder/ID#KEY"
    )
    
    st.markdown("### Filter Settings")
    col_min, col_max = st.columns(2)
    min_limit = col_min.number_input(label="Min Size (MB)", value=200, min_value=0, step=50, help="Ignore files smaller than this.")
    max_limit = col_max.number_input(label="Max Size (MB)", value=100000, min_value=0, step=1000, help="Ignore files larger than this.")

# --- Action & Metrics ---
st.write("") # Spacer
col_act, col_met = st.columns([2, 1], vertical_alignment="center")

if col_act.button(label="🔍 Analyze & Clean Folder", type="primary", width="stretch"):
    if not link_input.startswith("https://mega.nz/"):
        st.error("Please enter a valid MEGA.nz folder link.")
    else:
        with st.spinner("Decrypting folder tree and analyzing files..."):
            raw, named, size, logs = process_mega_link(link_input, min_limit, max_limit)
            st.session_state.mega_raw = raw
            st.session_state.mega_named = named
            st.session_state.mega_size = size
            st.session_state.mega_logs = logs
            st.rerun() 

col_met.metric("Total Cleaned Size", st.session_state.mega_size)

st.divider()

# --- Results Output ---
if st.session_state.mega_raw:
    tab1, tab2, tab3 = st.tabs([
        "🔗 Raw Links (JDownloader Ready)", 
        "📋 Identified Links (With Names)", 
        "📝 Processing Logs"
    ])

    with tab1:
        st.info("Copy this block directly into a download manager like JDownloader or MegaBasterd.")
        st.code(st.session_state.mega_raw, language="text", height=400)

    with tab2:
        st.info("Human-readable list of what was extracted.")
        st.code(st.session_state.mega_named, language="text", height=400)

    with tab3:
        st.info("Audit log showing which files were kept, skipped due to size limits, or deleted as duplicates.")
        st.code(st.session_state.mega_logs, language="text", height=400)
else:
    st.info("Enter a MEGA folder link above and click Analyze to generate links.")


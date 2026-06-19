import streamlit as st
from utilities.util_env import get_all_paths, export_env_backup


# --- Data Fetching ---
with st.spinner("Scanning Registry and matching applications..."):
    paths_data, sys_raw, user_raw = get_all_paths()

# --- Page Header ---
st.header(":material/public: Environment Variables Manager", divider="blue")
st.markdown("Analyze, audit, and backup your Windows `PATH` variables and discover which applications are using them.")

# --- High-Level Metrics Dashboard ---
sys_count = sum(1 for p in paths_data if p['type'] == 'System')
user_count = sum(1 for p in paths_data if p['type'] == 'User')
dead_count = sum(1 for p in paths_data if "Dead Link" in p['app'])

m1, m2, m3 = st.columns(3)

with m1.container(border=True):
    st.metric("System Paths", sys_count)
    
with m2.container(border=True):
    st.metric("User Paths", user_count)
    
with m3.container(border=True):
    st.metric("Dead Links (Safe to Clean)", dead_count, delta_color="inverse")

st.write("")

# --- Top Action Bar ---
col1, col2, col3 = st.columns(3)

if col1.button(":material/refresh: Refresh Data", width="stretch", type="primary"):
    get_all_paths.clear()
    st.rerun()

# Note: Editing SYSTEM variables requires Admin privileges in Python. 
if col2.button(":material/edit: Native Windows Editor", help="Opens the safe Windows System Properties dialog.", width="stretch"):
    import os
    os.system("rundll32 sysdm.cpl,EditEnvironmentVariables")

with col3:
    if "env_backup" not in st.session_state:
        st.session_state.env_backup = export_env_backup()
    st.download_button(":material/save: Backup Current Variables (.txt)", data=st.session_state.env_backup, file_name="env_variables_backup.txt", width="stretch")
st.divider()

st.subheader(":material/route: PATH Routing Table")

# --- Interactive Card Layout ---
if paths_data:
    for path_item in paths_data:
        with st.container(border=True):
            col_app, col_scope = st.columns([4, 1], vertical_alignment="center")
            
            # Application name or Dead Link warning
            if "Dead Link" in path_item['app']:
                col_app.markdown(f"**:red[{path_item['app']}]**")
            else:
                col_app.markdown(f"**{path_item['app']}**")
            
            # Color-code the Scope
            if path_item['type'].lower() == 'system':
                col_scope.markdown("**:blue[System Variable]**")
            else:
                col_scope.markdown("**:green[User Variable]**")
                
            # Place the path in a code block for easy copying
            st.code(path_item['path'], language="plaintext")
else:
    st.info("No PATH variables found.", icon=":material/info:")


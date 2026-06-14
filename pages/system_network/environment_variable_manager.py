import streamlit as st
import pandas as pd
from utilities.util_env import get_all_paths, export_env_backup
from utilities.util_persistent import apply_footer

st.header("🌐 Environment Variables Manager")
st.markdown("Analyze, audit, and backup your Windows `PATH` variables and discover which applications are using them.")

# --- Data Fetching ---
with st.spinner("Scanning Registry and matching applications..."):
    paths_data, sys_raw, user_raw = get_all_paths()

# --- Top Action Bar ---
col1, col2, col3 = st.columns([2, 2, 3])

if col1.button("🔄 Refresh Data", width="stretch"):
    get_all_paths.clear()
    st.rerun()

# Note: Editing SYSTEM variables requires Admin privileges in Python. 
# For safety in this tool, we will link to the native Windows editor for modifications.
if col2.button("✏️ Native Windows Editor", help="Opens the safe Windows System Properties dialog.", width="stretch"):
    import os
    os.system("rundll32 sysdm.cpl,EditEnvironmentVariables")

with col3:
    if "env_backup" not in st.session_state:
        st.session_state.env_backup = export_env_backup()
    st.download_button("💾 Backup Current Variables (.txt)", data=st.session_state.env_backup, file_name="env_variables_backup.txt", width="stretch")

st.divider()

# --- Metrics ---
sys_count = sum(1 for p in paths_data if p['type'] == 'System')
user_count = sum(1 for p in paths_data if p['type'] == 'User')
dead_count = sum(1 for p in paths_data if "Dead Link" in p['app'])

m1, m2, m3 = st.columns(3)
m1.metric("System Paths", sys_count)
m2.metric("User Paths", user_count)
m3.metric("Dead Links (Safe to Clean)", dead_count, delta_color="inverse")

st.markdown("### 🗺️ PATH Routing Table")

# --- Interactive DataFrame ---
if paths_data:
    df = pd.DataFrame(paths_data)
    
    # Configure the dataframe to look beautiful in Streamlit
    st.dataframe(
        df,
        column_config={
            "type": st.column_config.TextColumn("Scope", width="small"),
            "app": st.column_config.TextColumn("Identified Application", width="medium"),
            "path": st.column_config.TextColumn("Directory Path", width="large")
        },
        width="stretch",
        hide_index=True
    )
else:
    st.info("No PATH variables found.")

apply_footer()
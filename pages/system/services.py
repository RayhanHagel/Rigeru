import streamlit as st
import pandas as pd
from utilities.util_services import get_registry_startup, get_all_services
from utilities.util_persistent import apply_footer
import os

st.header("🚦 Startup & Services Manager")
st.markdown("Audit your boot process, discover background resource hogs, and map out safe service dependencies.")

# --- OS Shortcuts ---
btn1, btn2, btn3 = st.columns(3)
if btn1.button("🖥️ Open Task Manager (Startup)", width="stretch"):
    os.system("start taskmgr")
if btn2.button("⚙️ Open Windows Services", width="stretch"):
    os.system("start services.msc")
if btn3.button("🔄 Refresh System Data", key="refresh_top", width="stretch"):
    get_all_services.clear()
    st.rerun()

st.divider()

# --- Data Fetching ---
with st.spinner("Querying Windows Kernel for Service Trees..."):
    startup_apps = get_registry_startup()
    ms_services, non_ms_services = get_all_services()

# --- Tab Layout ---
tab1, tab2, tab3 = st.tabs([
    f"🚀 Startup Apps ({len(startup_apps)})",
    f"🛑 Third-Party Services ({len(non_ms_services)})",
    f"🪟 Microsoft Services ({len(ms_services)})"
])

with tab1:
    st.markdown("### Applications Launching on Boot")
    if startup_apps:
        st.dataframe(
            pd.DataFrame(startup_apps),
            column_config={
                "Name": st.column_config.TextColumn("Registry Key Name", width="medium"),
                "Scope": st.column_config.TextColumn("User/System", width="small"),
                "Path": st.column_config.TextColumn("Executable Path", width="large")
            },
            width="stretch", hide_index=True
        )
    else:
        st.info("No startup applications found in standard registry keys.")

with tab2:
    st.markdown("### Non-Microsoft Background Services")
    st.caption("These are installed by your software. Review them to see if you actually need them running constantly.")
    if non_ms_services:
        st.dataframe(
            pd.DataFrame(non_ms_services),
            column_config={
                "Display Name": st.column_config.TextColumn("App Name", width="medium"),
                "Status": st.column_config.TextColumn("State", width="small"),
                "Dependencies": st.column_config.TextColumn("Required Services", width="medium"),
                "Purpose (Description)": st.column_config.TextColumn("Purpose", width="large")
            },
            width="stretch", hide_index=True
        )

with tab3:
    st.markdown("### Core Windows Services")
    st.caption("Proceed with caution: Disabling core services can break OS functionality. Check dependencies first!")
    if ms_services:
        st.dataframe(
            pd.DataFrame(ms_services),
            column_config={
                "Display Name": st.column_config.TextColumn("Windows Feature", width="medium"),
                "Status": st.column_config.TextColumn("State", width="small"),
                "Start Type": st.column_config.TextColumn("Trigger", width="small"),
                "Dependencies": st.column_config.TextColumn("Relies On", width="medium")
            },
            width="stretch", hide_index=True
        )

# --- Action Helper ---
st.info("💡 **Tip:** To disable an annoying service, press `Win + R`, type `services.msc`, locate the 'App Name', right-click it, and set Startup Type to 'Disabled'.")

apply_footer()

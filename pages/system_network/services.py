import streamlit as st
from utilities.util_services import get_registry_startup, get_all_services
from utilities.util_persistent import apply_footer
import os

# --- Data Fetching ---
with st.spinner("Querying Windows Kernel for Service Trees..."):
    startup_apps = get_registry_startup()
    ms_services, non_ms_services = get_all_services()

# --- Page Header ---
# Removed the icon="" kwarg and embedded it directly into the string
st.header(":material/speed: Startup & Services Manager", divider="blue")
st.markdown("Audit your boot process, discover background resource hogs, and map out safe service dependencies.")

# --- High-Level Metrics Dashboard ---
m1, m2, m3 = st.columns(3)
with m1.container(border=True):
    st.metric("Startup Apps", len(startup_apps))
with m2.container(border=True):
    st.metric("Third-Party Services", len(non_ms_services))
with m3.container(border=True):
    st.metric("Microsoft Services", len(ms_services))
st.write("") # Spacer

# --- OS Shortcuts ---
btn1, btn2, btn3 = st.columns(3)
# Embedded material icons in the button text to avoid 'icon=' kwarg version errors
if btn1.button(":material/monitor: Task Manager", width="stretch", help="Manage startup apps"):
    os.system("start taskmgr")
if btn2.button(":material/settings: Windows Services", width="stretch", help="Manage background services"):
    os.system("start services.msc")
if btn3.button(":material/refresh: Refresh Data", key="refresh_top", width="stretch", type="primary"):
    get_all_services.clear()
    st.rerun()

st.divider()

# --- Tab Layout ---
tab1, tab2, tab3 = st.tabs([
    "Startup Apps",
    "Third-Party Services",
    "Microsoft Services"
])

with tab1:
    st.subheader(":material/rocket_launch: Applications Launching on Boot")
    if startup_apps:
        for app in startup_apps:
            with st.container(border=True):
                c_name, c_scope = st.columns([4, 1])
                c_name.markdown(f"**{app.get('Name', 'Unknown')}**")
                c_scope.caption(f"Scope: `{app.get('Scope', 'N/A')}`")
                
                # Show the path below the title
                st.code(app.get('Path', 'No path provided'), language="powershell")
    else:
        st.info("No startup applications found in standard registry keys.", icon=":material/info:")

with tab2:
    st.subheader(":material/extension: Non-Microsoft Background Services")
    st.caption("These are installed by your software. Review them to see if you actually need them running constantly.")
    if non_ms_services:
        for svc in non_ms_services:
            with st.container(border=True):
                c_title, c_status = st.columns([5, 1], vertical_alignment="center")
                
                c_title.markdown(f"**{svc.get('Display Name', 'Unknown Service')}**")
                
                # Color code the status
                status = svc.get('Status', '')
                if status.lower() == 'running':
                    c_status.markdown("**:green[Running]**")
                else:
                    c_status.markdown(f"**:orange[{status}]**")
                
                st.caption(f"**Description:** {svc.get('Purpose (Description)', 'No description available.')}")
                
                if svc.get('Dependencies'):
                    st.caption(f"**Dependencies:** `{svc.get('Dependencies')}`")

with tab3:
    st.subheader(":material/window: Core Windows Services")
    st.caption("Proceed with caution: Disabling core services can break OS functionality. Check dependencies first!")
    if ms_services:
        for svc in ms_services:
            with st.container(border=True):
                c_title, c_status, c_trigger = st.columns([3, 1, 1], vertical_alignment="center")
                
                c_title.markdown(f"**{svc.get('Display Name', 'Unknown')}**")
                
                status = svc.get('Status', '')
                if status.lower() == 'running':
                    c_status.markdown("**:green[Running]**")
                else:
                    c_status.markdown(f"**:orange[{status}]**")
                    
                c_trigger.caption(f"Trigger: `{svc.get('Start Type', 'N/A')}`")
                
                if svc.get('Dependencies'):
                    st.caption(f"**Relies On:** {svc.get('Dependencies')}")

apply_footer()
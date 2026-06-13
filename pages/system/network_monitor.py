import streamlit as st
import pandas as pd
import streamlit.components.v1 as components
from streamlit_autorefresh import st_autorefresh
from utilities.util_network_monitor import get_active_connections, generate_cyberpunk_graph_html
from utilities.util_persistent import apply_footer

# --- State Initialization ---
if "network_data" not in st.session_state:
    st.session_state.network_data = get_active_connections()
if "net_auto_refresh" not in st.session_state:
    st.session_state.net_auto_refresh = False

st.header("🛰️ Cyber-Network Monitor")
st.markdown("Live-mapping of outbound data packets, local applications, and external ports.")

# --- Control Panel ---
with st.container(border=True):
    col_btn, col_tog, col_stat = st.columns([2, 2, 4], vertical_alignment="center")
    
    # Manual Ping
    if col_btn.button("📡 Ping Sockets", type="primary", width="stretch"):
        with st.spinner("Scanning active ports..."):
            st.session_state.network_data = get_active_connections()
            st.rerun()
            
    # Auto-Refresh Toggle
    st.session_state.net_auto_refresh = col_tog.toggle("🔄 Live Auto-Update (5s)", value=st.session_state.net_auto_refresh)
    
    # Status
    col_stat.caption(f"Tracking **{len(st.session_state.network_data)}** active external connections.")

# Trigger Auto-Refresh if enabled (runs every 5000 milliseconds)
if st.session_state.net_auto_refresh:
    st_autorefresh(interval=5000, key="net_refresher")
    st.session_state.network_data = get_active_connections()

# --- The Sci-Fi Visualizer ---
if st.session_state.network_data:
    st.markdown("### 🕸️ Live Topology Graph")
    st.info("💡 **Interactive:** You can drag nodes around, scroll to zoom, and watch the data flow from your PC to the applications.")
    
    # Inject our custom HTML/JS physics engine directly into the Streamlit UI
    html_graph = generate_cyberpunk_graph_html(st.session_state.network_data)
    components.html(html_graph, height=570)
else:
    st.warning("No external connections detected. You are completely offline!")

st.divider()

# --- The Raw Diagnostic Table ---
st.markdown("### 📊 Raw Socket Telemetry")
if st.session_state.network_data:
    df = pd.DataFrame(st.session_state.network_data)
    
    # Format the data for readability
    df.rename(columns={
        "app": "Application (.exe)",
        "pid": "Process ID",
        "local_port": "Local Port",
        "remote_ip": "Remote IP",
        "remote_port": "Remote Port"
    }, inplace=True)
    
    # Render with Streamlit's native dataframe config for better UI
    st.dataframe(
        df, 
        width="stretch", 
        hide_index=True,
        column_config={
            "Process ID": st.column_config.NumberColumn(format="%d"),
            "Local Port": st.column_config.NumberColumn(format="%d"),
            "Remote Port": st.column_config.NumberColumn(format="%d")
        }
    )

apply_footer()
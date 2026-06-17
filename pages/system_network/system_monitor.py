import streamlit as st
import time
import pandas as pd
from utilities.util_sys_monitor import get_system_stats, get_top_processes
from utilities.util_persistent import apply_footer

st.header(":material/monitor: System Monitor")
st.markdown("View real-time CPU, Memory, GPU, Disk usage, and running processes.")

col1, col2 = st.columns([4, 1], vertical_alignment="center")
with col1:
    live_monitor = st.toggle(":material/sensors: Enable Live Real-Time Monitoring", help="Constantly refreshes the dashboard data.")
with col2:
    if st.button(":material/refresh: Refresh Data", type="primary", width="stretch"):
        st.rerun()

# Placeholders for the real-time loop updates
metrics_container = st.empty()
st.divider()
charts_container = st.empty()
st.divider()
procs_container = st.empty()

# Initialize session state for the graphing data (Rolling Window)
if "sys_history" not in st.session_state:
    st.session_state.sys_history = pd.DataFrame(columns=["CPU", "RAM", "GPU"])

def render_dashboard():
    """Fetches and renders the dashboard UI elements."""
    stats = get_system_stats()
    
    # Update charting history
    new_row = {"CPU": stats['cpu_percent'], "RAM": stats['mem_percent'], "GPU": stats['gpu_percent']}
    st.session_state.sys_history = pd.concat([st.session_state.sys_history, pd.DataFrame([new_row])], ignore_index=True)
    
    # Keep only the last 40 data points in memory
    if len(st.session_state.sys_history) > 40:
        st.session_state.sys_history = st.session_state.sys_history.iloc[-40:]

    # --- 1. Top Metrics View ---
    with metrics_container.container():
        st.subheader("Hardware Usage")
        col_cpu, col_mem, col_gpu, col_disk = st.columns(4)
        
        with col_cpu:
            with st.container(border=True):
                st.metric(label="CPU Usage", value=f"{stats['cpu_percent']}%")
                st.progress(stats['cpu_percent'] / 100.0)

        with col_mem:
            with st.container(border=True):
                st.metric(label="RAM Usage", value=f"{stats['mem_percent']}%", help=stats['mem_text'])
                st.progress(stats['mem_percent'] / 100.0)
                
        with col_gpu:
            with st.container(border=True):
                st.metric(label="GPU Usage", value=f"{stats['gpu_percent']}%", help=stats['gpu_text'])
                st.progress(stats['gpu_percent'] / 100.0)

        with col_disk:
            with st.container(border=True):
                st.metric(label="Disk Space (Root)", value=f"{stats['disk_percent']}%", help=stats['disk_text'])
                st.progress(stats['disk_percent'] / 100.0)
                
    # --- 2. Chart Grid View ---
    with charts_container.container():
        st.subheader("Performance History")
        col_chart1, col_chart2, col_chart3 = st.columns(3)
        
        with col_chart1:
            st.write("**CPU**")
            st.line_chart(st.session_state.sys_history["CPU"], height=180, color="#ff4b4b")
            
        with col_chart2:
            st.write("**RAM**")
            st.line_chart(st.session_state.sys_history["RAM"], height=180, color="#0068c9")
            
        with col_chart3:
            st.write("**GPU**")
            st.line_chart(st.session_state.sys_history["GPU"], height=180, color="#29b09d")
        
    # --- 3. Process Table View ---
    with procs_container.container():
        st.subheader("Top Processes (by Memory)")
        df_procs = get_top_processes(limit=15)
        
        if not df_procs.empty:
            for index, proc in df_procs.iterrows():
                with st.container(border=True):
                    col_name, col_pid, col_cpu, col_mem = st.columns([3, 1, 2, 2], vertical_alignment="center")
                    
                    col_name.markdown(f"**{proc['Name']}**")
                    col_pid.caption(f"PID: `{proc['PID']}`")
                    
                    # Add visual progress bars for the hardware usage
                    with col_cpu:
                        st.caption(f"CPU: {proc['CPU (%)']:.2f}%")
                        # Cap progress at 1.0 to prevent Streamlit errors if CPU spikes over 100%
                        st.progress(min(proc['CPU (%)'] / 100.0, 1.0))
                        
                    with col_mem:
                        st.caption(f"RAM: {proc['Memory (%)']:.2f}%")
                        st.progress(min(proc['Memory (%)'] / 100.0, 1.0))

# Execute Render Logic
if live_monitor:
    while live_monitor:
        render_dashboard()
        time.sleep(1.5) 
else:
    render_dashboard()

apply_footer()
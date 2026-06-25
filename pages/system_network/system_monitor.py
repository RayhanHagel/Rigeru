import streamlit as st
from collections import deque
from utilities.util_sys_monitor import get_system_stats, get_top_processes, load_settings, save_settings

# Only load settings from disk if they aren't already in the session state
if "settings" not in st.session_state:
    st.session_state.settings = load_settings()

st.header(":material/monitor: System Monitor")
st.markdown("View real-time CPU, Memory, GPU, Disk usage, and running processes.")

col1, col2 = st.columns([4, 1], vertical_alignment="center")
with col1:
    live_monitor = st.toggle(":material/sensors: Enable Live Real-Time Monitoring", help="Constantly refreshes the dashboard data.")
with col2:
    if st.button(":material/refresh: Refresh Data", type="primary", width="stretch"):
        st.rerun()

with st.expander(":material/settings: Dashboard Settings"):
    with st.form("settings_form"):
        col_s1, col_s2 = st.columns(2)
        
        with col_s1:
            new_history = st.number_input(
                "Chart History Length", 
                min_value=10, 
                max_value=200, 
                value=st.session_state.settings.get("history_len", 40)
            )
            
        with col_s2:
            new_limit = st.number_input(
                "Process Table Limit", 
                min_value=5, 
                max_value=50, 
                value=st.session_state.settings.get("proc_limit", 15)
            )
            
        if st.form_submit_button(":material/save: Save Preferences", type="primary"):
            st.session_state.settings = {"history_len": new_history, "proc_limit": new_limit}
            save_settings(st.session_state.settings)
            st.session_state.sys_history = deque(st.session_state.sys_history, maxlen=new_history)
            st.rerun()


metrics_container = st.empty()
st.divider()
charts_container = st.empty()
st.divider()
procs_container = st.empty()

if "sys_history" not in st.session_state:
    st.session_state.sys_history = deque(maxlen=st.session_state.settings.get("history_len", 40))

@st.fragment 
def render_dashboard():
    stats = get_system_stats()
    
    new_row = {"CPU": stats['cpu_percent'], "RAM": stats['mem_percent'], "GPU": stats['gpu_percent']}
    st.session_state.sys_history.append(new_row)

    with metrics_container.container():
        st.subheader(":material/memory: Hardware Usage")
        col_cpu, col_mem, col_gpu, col_disk = st.columns(4)
        
        with col_cpu:
            with st.container(border=True):
                st.metric(label=":material/developer_board: CPU Usage", value=f"{stats['cpu_percent']}%")
                st.progress(stats['cpu_percent'] / 100.0)

        with col_mem:
            with st.container(border=True):
                st.metric(label=":material/memory_alt: RAM Usage", value=f"{stats['mem_percent']}%", help=stats['mem_text'])
                st.progress(stats['mem_percent'] / 100.0)
                
        with col_gpu:
            with st.container(border=True):
                st.metric(label=":material/dns: GPU Usage", value=f"{stats['gpu_percent']}%", help=stats['gpu_text'])
                st.progress(stats['gpu_percent'] / 100.0)

        with col_disk:
            with st.container(border=True):
                st.metric(label=":material/hard_drive: Disk Space (Root)", value=f"{stats['disk_percent']}%", help=stats['disk_text'])
                st.progress(stats['disk_percent'] / 100.0)
                
    with charts_container.container():
        st.subheader(":material/show_chart: Performance History")
        col_chart1, col_chart2, col_chart3 = st.columns(3)
        
        import pandas as pd 
        df_history = pd.DataFrame(st.session_state.sys_history)
        
        with col_chart1:
            st.write("**CPU**")
            st.line_chart(df_history["CPU"], height=180, color="#ff4b4b")
            
        with col_chart2:
            st.write("**RAM**")
            st.line_chart(df_history["RAM"], height=180, color="#0068c9")
            
        with col_chart3:
            st.write("**GPU**")
            st.line_chart(df_history["GPU"], height=180, color="#29b09d")
        
    with procs_container.container():
        st.subheader(":material/list: Top Processes (by Memory)")
        # Grabbing proc_limit from the session state
        df_procs = get_top_processes(limit=st.session_state.settings.get("proc_limit", 15))
        
        if not df_procs.empty:
            for index, proc in df_procs.iterrows():
                with st.container(border=True):
                    col_name, col_pid, col_cpu, col_mem = st.columns([3, 1, 2, 2], vertical_alignment="center")
                    col_name.markdown(f"**{proc['Name']}**")
                    col_pid.caption(f"PID: `{proc['PID']}`")
                    with col_cpu:
                        st.caption(f"CPU: {proc['CPU (%)']:.2f}%")
                        st.progress(min(proc['CPU (%)'] / 100.0, 1.0))
                    with col_mem:
                        st.caption(f"RAM: {proc['Memory (%)']:.2f}%")
                        st.progress(min(proc['Memory (%)'] / 100.0, 1.0))

if live_monitor:
    import time
    while live_monitor:
        render_dashboard()
        time.sleep(1.5) 
else:
    render_dashboard()
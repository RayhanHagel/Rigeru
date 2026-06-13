import streamlit as st
from utilities.util_docker import list_containers, container_action, start_docker_daemon
from utilities.util_persistent import apply_footer

st.header("🐳 Local Docker Manager")
st.markdown("View and control your local Docker containers directly from the dashboard.")

# Refresh button
col_title, col_btn = st.columns([4, 1])
if col_btn.button("🔄 Refresh List", type="secondary", width="stretch"):
    st.rerun()

st.divider()

with st.spinner("Connecting to Docker daemon..."):
    success, containers = list_containers()
    
    if not success:
        st.error(containers)
        st.info("Make sure Docker Desktop (or the Docker daemon) is actively running on your machine.")
        
        # New Fallback Button to Launch Docker
        if st.button("🚀 Start Docker Service", type="primary"):
            s_success, s_msg = start_docker_daemon()
            if s_success:
                st.toast(s_msg)
            else:
                st.error(s_msg)
                
    else:
        if not containers:
            st.info("No Docker containers found on this machine.")
        else:
            # Display containers as a neat list of cards
            for c in containers:
                with st.container(border=True):
                    col_info, col_status, col_actions = st.columns([3, 1, 2], vertical_alignment="center")
                    
                    with col_info:
                        st.markdown(f"**{c['name']}**")
                        st.caption(f"Image: `{c['image']}` | ID: `{c['id']}`")
                        
                    with col_status:
                        if c['status'] == 'running':
                            st.success("🟢 Running", icon=None)
                        elif c['status'] == 'exited':
                            st.error("🔴 Exited", icon=None)
                        else:
                            st.warning(f"🟡 {c['status'].capitalize()}", icon=None)
                            
                    with col_actions:
                        # Control buttons side-by-side using spelled out text
                        act1, act2, act3 = st.columns(3)
                        
                        # Disable start button if already running, disable stop if already exited
                        is_running = c['status'] == 'running'
                        
                        if act1.button("Start", key=f"start_{c['id']}", type="primary", disabled=is_running, width="stretch"):
                            act_succ, act_msg = container_action(c['id'], "start")
                            if act_succ: st.toast(act_msg)
                            else: st.error(act_msg)
                            st.rerun()
                            
                        if act2.button("Stop", key=f"stop_{c['id']}", type="secondary", disabled=not is_running, width="stretch"):
                            act_succ, act_msg = container_action(c['id'], "stop")
                            if act_succ: st.toast(act_msg)
                            else: st.error(act_msg)
                            st.rerun()
                            
                        if act3.button("Restart", key=f"rest_{c['id']}", type="secondary", width="stretch"):
                            act_succ, act_msg = container_action(c['id'], "restart")
                            if act_succ: st.toast(act_msg)
                            else: st.error(act_msg)
                            st.rerun()

apply_footer()
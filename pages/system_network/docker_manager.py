import streamlit as st
from utilities.util_docker import list_containers, container_action, start_docker_daemon, get_docker_client
import time


st.header(":material/deployed_code: Local Docker Manager", divider="gray")
st.markdown(
    "View and control your local Docker containers directly from the dashboard."
)

col_empty, col_btn = st.columns([4, 1])
with col_btn:
    if st.button("Refresh List", type="secondary", width="stretch", icon=":material/refresh:"):
        st.rerun()

# OPTIMIZED: Wrap the blocking container list in a st.fragment
@st.fragment
def render_docker_list():
    with st.spinner("Connecting to Docker daemon..."):
        success, containers = list_containers()

        if not success:
            st.info(
                "Make sure Docker Desktop (or the Docker daemon) is actively running on your machine.", 
                icon=":material/info:"
            )

            if st.button("Start Docker Service", type="primary", icon=":material/rocket_launch:"):
                s_success, s_msg = start_docker_daemon()
                if s_success:
                    st.toast(s_msg, icon=":material/check_circle:")
                    with st.spinner("Waiting for Docker engine to start... (This usually takes 15-30 seconds)"):
                        max_retries = 30
                        sleep_time = 2
                        docker_ready = False
                        
                        for _ in range(max_retries):
                            time.sleep(sleep_time)
                            client_success, _ = get_docker_client()
                            if client_success:
                                docker_ready = True
                                break
                        
                        if docker_ready:
                            st.toast("Docker is ready!", icon=":material/check_circle:")
                            time.sleep(0.5)
                            st.rerun()
                        else:
                            st.error("Timed out waiting for Docker to start. Check if Docker Desktop requires an update or manual login.", icon=":material/error:")
                    # -----------------------------
                else:
                    st.error(s_msg, icon=":material/error:")

        else:
            if not containers:
                st.info("No Docker containers found on this machine.", icon=":material/inbox:")
            else:
                for c in containers:
                    with st.container(border=True):
                        col_info, col_status, col_actions = st.columns(
                            [6, 1.5, 3.5], vertical_alignment="center"
                        )

                        with col_info:
                            st.markdown(f"**{c['name']}**")
                            st.caption(f":material/layers: Image: `{c['image']}`")
                            st.caption(f":material/tag: ID: `{c['id']}`")

                        with col_status:
                            if c['status'] == 'running':
                                st.markdown("**:green[:material/play_circle: Running]**")
                            elif c['status'] == 'exited':
                                st.markdown("**:red[:material/stop_circle: Exited]**")
                            else:
                                st.markdown(f"**:orange[:material/pending: {c['status'].capitalize()}]**")

                        with col_actions:
                            act1, act2, act3 = st.columns(3)
                            is_running = c['status'] == 'running'

                            if act1.button("Start", key=f"start_{c['id']}", type="primary", disabled=is_running, width="stretch", icon=":material/play_arrow:"):
                                act_succ, act_msg = container_action(c['id'], "start")
                                if act_succ:
                                    st.toast(act_msg, icon=":material/check_circle:")
                                else:
                                    st.error(act_msg, icon=":material/error:")
                                st.rerun()

                            if act2.button("Stop", key=f"stop_{c['id']}", type="secondary", disabled=not is_running, width="stretch", icon=":material/stop:"):
                                act_succ, act_msg = container_action(c['id'], "stop")
                                if act_succ:
                                    st.toast(act_msg, icon=":material/check_circle:")
                                else:
                                    st.error(act_msg, icon=":material/error:")
                                st.rerun()

                            if act3.button("Restart", key=f"rest_{c['id']}", type="secondary", width="stretch", icon=":material/restart_alt:"):
                                act_succ, act_msg = container_action(c['id'], "restart")
                                if act_succ:
                                    st.toast(act_msg, icon=":material/check_circle:")
                                else:
                                    st.error(act_msg, icon=":material/error:")
                                st.rerun()

# Execute fragment rendering
render_docker_list()
import streamlit as st
from utilities.util_docker import list_containers, container_action, start_docker_daemon


# Modern Header with Material Icon
st.header(":material/deployed_code: Local Docker Manager", divider="gray")
st.markdown(
    "View and control your local Docker containers directly from the dashboard."
)

# Refresh button - Modernized alignment
col_empty, col_btn = st.columns([4, 1])
with col_btn:
    if st.button("Refresh List", type="secondary", width="stretch", icon=":material/refresh:"):
        st.rerun()

with st.spinner("Connecting to Docker daemon..."):
    success, containers = list_containers()

    if not success:
        st.error(containers, icon=":material/error:")
        st.info(
            "Make sure Docker Desktop (or the Docker daemon) is actively running on your machine.", 
            icon=":material/info:"
        )

        # Modern Fallback Button
        if st.button("Start Docker Service", type="primary", icon=":material/rocket_launch:"):
            s_success, s_msg = start_docker_daemon()
            if s_success:
                st.toast(s_msg, icon=":material/check_circle:")
            else:
                st.error(s_msg, icon=":material/error:")

    else:
        if not containers:
            st.info("No Docker containers found on this machine.", icon=":material/inbox:")
        else:
            # Display containers as a neat list of cards
            for c in containers:
                with st.container(border=True):
                    # Adjusted column ratios to close the gap
                    col_info, col_status, col_actions = st.columns(
                        [6, 1.5, 3.5], vertical_alignment="center"
                    )

                    with col_info:
                        st.markdown(f"**{c['name']}**")
                        # Split image and ID into separate lines
                        st.caption(f":material/layers: Image: `{c['image']}`")
                        st.caption(f":material/tag: ID: `{c['id']}`")

                    with col_status:
                        # Using colored markdown instead of alert boxes to perfectly match button heights
                        if c['status'] == 'running':
                            st.markdown("**:green[:material/play_circle: Running]**")
                        elif c['status'] == 'exited':
                            st.markdown("**:red[:material/stop_circle: Exited]**")
                        else:
                            st.markdown(f"**:orange[:material/pending: {c['status'].capitalize()}]**")

                    with col_actions:
                        # Control buttons side-by-side with icons
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


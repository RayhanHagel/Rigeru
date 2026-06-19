import streamlit as st
import re
from streamlit_agraph import agraph, Node, Edge, Config

from utilities.util_network_monitor import get_active_connections
from utilities.util_persistent import THEMES

# --- Theme & Color Integration ---
current_theme_name = st.session_state.get("selected_theme", "Nebula (Default)")
theme = THEMES.get(current_theme_name, THEMES["Nebula (Default)"])

def get_solid_color(rgba_str: str, fallback: str) -> str:
    if "rgba" in rgba_str:
        return re.sub(r',[\s\d.]+\)$', ', 1.0)', rgba_str)
    return fallback

COLOR_PC = theme["HEADING"]
COLOR_APP = get_solid_color(theme["GLOW_1"], "#00FFCC")
COLOR_TGT = get_solid_color(theme["GLOW_2"], "#B829FF")
COLOR_TEXT = theme["TEXT"]
COLOR_BG = theme["BG"]

# --- Page Configuration ---
st.set_page_config(page_title="Network Monitor", page_icon=":material/satellite_alt:", layout="wide")

# --- Global State Initialization ---
if "net_auto_refresh" not in st.session_state:
    st.session_state.net_auto_refresh = False

# --- Header ---
st.title(":material/satellite_alt: Cyber-Network Monitor")
st.markdown("Live-mapping of outbound data packets, local applications, and external ports.")
st.divider()

# --- Global Control Panel ---
# These sit outside the fragment so they don't jump around
col_btn, col_tog = st.columns([1, 1])

if col_btn.button("Ping Sockets", icon=":material/sensors:", type="primary", width="stretch"):
    # Reruns the whole app manually
    st.rerun()
        
st.session_state.net_auto_refresh = col_tog.toggle(
    ":material/sync: Auto-Update (5s)", 
    value=st.session_state.net_auto_refresh
)

st.write("")

# --- Define the Live Fragment ---
# The fragment decorator natively handles background refreshing
refresh_interval = "5s" if st.session_state.net_auto_refresh else None

@st.fragment(run_every=refresh_interval)
def live_dashboard_fragment():
    """This entire function executes independently from the rest of the page."""
    
    # Fetch live data
    current_data = get_active_connections()
    
    # We moved the metric inside the fragment so it live-updates without a full page reload!
    st.metric("Active External Connections", len(current_data))
    
    # Tabbed Interface
    tab_visual, tab_data = st.tabs([":material/hub: Live Topology Graph", ":material/bar_chart: Raw Socket Telemetry"])

    with tab_visual:
        if current_data:
            st.info(":material/lightbulb: **Interactive:** Drag nodes around, scroll to zoom, and watch the data flow.")
            
            nodes = []
            edges = []
            apps_added = set()
            targets_added = set()
            
            font_style = {
                "color": COLOR_TEXT, 
                "size": 14, 
                "strokeWidth": 4, 
                "strokeColor": COLOR_BG
            }
            
            nodes.append(Node(id="PC", label="My Local PC", size=30, shape="hexagon", color=COLOR_PC, font=font_style))
            
            for conn in current_data[:25]:
                app_id = f"APP_{conn['app']}"
                target_id = f"TGT_{conn['remote_ip']}:{conn['remote_port']}"
                
                if app_id not in apps_added:
                    nodes.append(Node(id=app_id, label=conn['app'], size=20, shape="dot", color=COLOR_APP, font=font_style))
                    edges.append(Edge(source="PC", target=app_id, color=COLOR_APP, dashes=True))
                    apps_added.add(app_id)
                    
                if target_id not in targets_added:
                    nodes.append(Node(id=target_id, label=f"{conn['remote_ip']}:{conn['remote_port']}", size=15, shape="square", color=COLOR_TGT, font=font_style))
                    edges.append(Edge(source=app_id, target=target_id, color=COLOR_TGT, dashes=True))
                    targets_added.add(target_id)
                    
            config = Config(
                width="100%",
                height=600,
                directed=True, 
                hierarchical=False,
                interaction={"hover": True, "zoomView": True},
                layout={"randomSeed": 42}, 
                physics={
                    "barnesHut": {
                        "gravitationalConstant": -6000,
                        "springLength": 250,
                        "centralGravity": 0.3
                    }
                }
            )
            
            agraph(nodes=nodes, edges=edges, config=config)
            
        else:
            st.warning(":material/warning: No external connections detected. You are completely offline!")

    with tab_data:
        if current_data:
            st.write("### Active Socket Connections")
            
            # Create a card for each connection
            for conn in current_data:
                with st.container(border=True):
                    # Use columns to align the data neatly inside the card
                    col_app, col_local, col_remote = st.columns([2, 1, 2], vertical_alignment="center")
                    
                    with col_app:
                        st.markdown(f"**{conn['app']}**")
                        st.caption(f"PID: `{conn['pid']}`")
                        
                    with col_local:
                        st.markdown(":material/dns: **Local**")
                        st.code(conn['local_port'])
                        
                    with col_remote:
                        st.markdown(":material/public: **Remote Target**")
                        st.code(f"{conn['remote_ip']}:{conn['remote_port']}")
        else:
            st.warning(":material/warning: No tabular data to display.")

# --- Execute the Fragment ---
# Calling the function renders the dashboard and starts the background loop (if toggled on)
live_dashboard_fragment()


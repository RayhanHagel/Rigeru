import streamlit as st
import os
from utilities.util_services import load_services_data, force_refresh
from utilities.util_persistent import THEMES, FONTS


# --- Dynamic CSS Injection ---
def get_card_style(theme_name: str, font_name: str) -> str:
    """Generates CSS for the instant-loading service cards using passed theme parameters."""
    
    # Fallbacks in case the session state keys are modified or missing
    theme = THEMES.get(theme_name, THEMES["Nebula (Default)"])
    font_serif = FONTS.get(font_name, FONTS["Serif Mono (Default)"])["SERIF"]
    font_mono = FONTS.get(font_name, FONTS["Serif Mono (Default)"])["MONO"]
    
    return f"""
    <style>
    .st-card {{
        border: 1px solid {theme['UI_BORDER']};
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        background-color: {theme['UI_BG']};
        transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    }}
    .st-card:hover {{
        border-color: {theme['HEADING']};
        box-shadow: 0 4px 15px {theme['GLOW_1']};
        transform: translateY(-2px);
    }}
    .st-card-header {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }}
    .st-card-title {{
        font-family: {font_serif};
        font-weight: 600;
        font-size: 1.05rem;
        color: {theme['HEADING']};
    }}
    .status-running {{ 
        color: #10b981; 
        font-family: {font_mono}; 
        font-weight: bold; 
    }}
    .status-other {{ 
        color: #f59e0b; 
        font-family: {font_mono}; 
        font-weight: bold; 
    }}
    .st-card-text {{
        font-family: {font_mono};
        font-size: 0.85rem;
        color: {theme['TEXT']};
        margin-bottom: 4px;
    }}
    .st-code {{
        background-color: {theme['BG']};
        border: 1px solid {theme['UI_BORDER']};
        color: {theme['TEXT']};
        padding: 6px;
        border-radius: 4px;
        font-family: {font_mono};
        font-size: 0.8rem;
        word-break: break-all;
        margin-top: 8px;
    }}
    </style>
    """

# Fetch the active states and apply the CSS
current_theme = st.session_state.get("selected_theme", "Nebula (Default)")
current_font = st.session_state.get("selected_font", "Serif Mono (Default)")
st.markdown(get_card_style(current_theme, current_font), unsafe_allow_html=True)

# --- Data Loading ---
startup_apps, ms_services, non_ms_services = load_services_data()

st.header(":material/speed: Startup & Services Manager", divider="blue")
st.markdown("Audit your boot process, discover background resource hogs, and map out safe service dependencies.")

@st.fragment
def render_metrics_and_controls():
    m1, m2, m3, m4 = st.columns([1, 1, 1, 2])
    
    m1.metric("Startup Apps", len(startup_apps))
    m2.metric("Third-Party Services", len(non_ms_services))
    m3.metric("Microsoft Services", len(ms_services))
    
    with m4:
        st.write("") 
        btn_col1, btn_col2, btn_col3 = st.columns(3)
        if btn_col1.button(":material/monitor: Taskmgr", use_container_width=True):
            os.system("start taskmgr")
        if btn_col2.button(":material/settings: Services", use_container_width=True):
            os.system("start services.msc")
        if btn_col3.button(":material/refresh: Refresh", type="primary", use_container_width=True):
            force_refresh()
            st.rerun()

@st.fragment
def render_data_tabs():
    tab1, tab2, tab3 = st.tabs(["Startup Apps", "Third-Party Services", "Microsoft Services"])

    with tab1:
        st.subheader(":material/rocket_launch: Applications Launching on Boot")
        if startup_apps:
            html_str = ""
            for app in startup_apps:
                html_str += f"""
                <div class="st-card">
                    <div class="st-card-header">
                        <span class="st-card-title">{app.get('Name', 'Unknown')}</span>
                        <span class="st-card-text">Scope: <code>{app.get('Scope', 'N/A')}</code></span>
                    </div>
                    <div class="st-code">{app.get('Path', 'No path provided')}</div>
                </div>
                """
            st.markdown(html_str, unsafe_allow_html=True)
        else:
            st.info("No startup applications found.", icon=":material/info:")

    with tab2:
        st.subheader(":material/extension: Non-Microsoft Background Services")
        if non_ms_services:
            html_str = ""
            for svc in non_ms_services:
                status = svc.get('Status', '')
                status_class = "status-running" if status.lower() == 'running' else "status-other"
                deps = svc.get('Dependencies')
                deps_html = f'<div class="st-card-text"><strong>Dependencies:</strong> <code>{deps}</code></div>' if deps and deps != "None" else ""
                
                html_str += f"""
                <div class="st-card">
                    <div class="st-card-header">
                        <span class="st-card-title">{svc.get('Display Name', 'Unknown Service')}</span>
                        <span class="{status_class}">{status}</span>
                    </div>
                    <div class="st-card-text"><strong>Description:</strong> {svc.get('Purpose (Description)', 'No description.')}</div>
                    {deps_html}
                </div>
                """
            st.markdown(html_str, unsafe_allow_html=True)

    with tab3:
        st.subheader(":material/window: Core Windows Services")
        if ms_services:
            html_str = ""
            for svc in ms_services:
                status = svc.get('Status', '')
                status_class = "status-running" if status.lower() == 'running' else "status-other"
                deps = svc.get('Dependencies')
                deps_html = f'<div class="st-card-text"><strong>Relies On:</strong> {deps}</div>' if deps and deps != "None" else ""
                
                html_str += f"""
                <div class="st-card">
                    <div class="st-card-header">
                        <span class="st-card-title">{svc.get('Display Name', 'Unknown')}</span>
                        <span class="{status_class}">{status}</span>
                    </div>
                    <div class="st-card-text">Trigger: <code>{svc.get('Start Type', 'N/A')}</code></div>
                    {deps_html}
                </div>
                """
            st.markdown(html_str, unsafe_allow_html=True)

# --- Render UI ---
render_metrics_and_controls()
st.divider()
render_data_tabs()
import streamlit as st
import os
import re
from utilities.util_env import load_env_data, force_refresh, export_env_backup
from utilities.util_persistent import THEMES, FONTS

st.set_page_config(page_title="Environment Variables Manager", layout="wide")

def get_card_style(theme_name: str, font_name: str) -> str:
    theme = THEMES.get(theme_name, THEMES["Nebula (Default)"])
    font_serif = FONTS.get(font_name, FONTS["Serif Mono (Default)"])["SERIF"]
    font_mono = FONTS.get(font_name, FONTS["Serif Mono (Default)"])["MONO"]
    
    return f"""
    <style>
    /* Import Google Material Symbols */
    @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0,0');

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
        display: flex;
        align-items: center;
    }}
    
    /* Native HTML Icon styling */
    .md-icon {{
        font-family: 'Material Symbols Rounded';
        font-size: 22px;
        margin-right: 8px;
        vertical-align: middle;
    }}
    
    .scope-system {{ 
        color: #3b82f6; 
        font-family: {font_mono}; 
        font-weight: bold; 
    }}
    .scope-user {{ 
        color: #10b981; 
        font-family: {font_mono}; 
        font-weight: bold; 
    }}
    .title-dead {{ color: #ef4444; }}
    .title-dead .md-icon {{ color: #ef4444; }} /* Make the dead link icon red too */
    
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

current_theme = st.session_state.get("selected_theme", "Nebula (Default)")
current_font = st.session_state.get("selected_font", "Serif Mono (Default)")
st.markdown(get_card_style(current_theme, current_font), unsafe_allow_html=True)

paths_data, sys_raw, user_raw = load_env_data()

st.header(":material/public: Environment Variables Manager", divider="blue")
st.markdown("Analyze, audit, and backup your Windows `PATH` variables and discover which applications are using them.")

@st.fragment
def render_metrics_and_controls():
    sys_count = sum(1 for p in paths_data if p['type'] == 'System')
    user_count = sum(1 for p in paths_data if p['type'] == 'User')
    dead_count = sum(1 for p in paths_data if "Dead Link" in p['app'])

    m1, m2, m3, m4 = st.columns([1, 1, 1, 2])
    
    m1.metric("System Paths", sys_count)
    m2.metric("User Paths", user_count)
    m3.metric("Dead Links (Safe to Clean)", dead_count, delta_color="inverse")
    
    with m4:
        st.write("") 
        col1, col2, col3 = st.columns(3)
        if col1.button(":material/refresh: Refresh", use_container_width=True, type="primary"):
            force_refresh()
            st.rerun()
        if col2.button(":material/edit: Native Editor", help="Opens Windows System Properties", use_container_width=True):
            os.system("rundll32 sysdm.cpl,EditEnvironmentVariables")
        
        if "env_backup" not in st.session_state:
            st.session_state.env_backup = export_env_backup()
        col3.download_button(":material/save: Backup", data=st.session_state.env_backup, file_name="env_backup.txt", use_container_width=True)

@st.fragment
def render_path_list():
    st.subheader(":material/route: PATH Routing Table")
    if paths_data:
        html_str = ""
        for path_item in paths_data:
            app_name = path_item['app']
            is_dead = "Dead Link" in app_name
            title_class = "st-card-title title-dead" if is_dead else "st-card-title"
            scope_class = "scope-system" if path_item['type'].lower() == 'system' else "scope-user"
            
            # This regex finds Streamlit tags like :material/settings: or :material_settings: 
            # and transforms them into native HTML span tags so they render inside the card
            parsed_app_name = re.sub(
                r":material[/_]([a-zA-Z0-9_]+):", 
                r'<span class="md-icon">\1</span>', 
                app_name
            )
            
            html_str += f"""
            <div class="st-card">
                <div class="st-card-header">
                    <span class="{title_class}">{parsed_app_name}</span>
                    <span class="{scope_class}">{path_item['type']} Variable</span>
                </div>
                <div class="st-code">{path_item['path']}</div>
            </div>
            """
        st.markdown(html_str, unsafe_allow_html=True)
    else:
        st.info("No PATH variables found.", icon=":material/info:")

render_metrics_and_controls()
st.divider()
render_path_list()
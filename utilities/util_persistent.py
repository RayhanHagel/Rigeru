import streamlit as st
from streamlit_extras.avatar import *
from utilities.util_manga import get_cached_image




def apply_logo():
    st.set_page_config(
        page_title="Rigeru",
        page_icon=":material/gamepad_circle_left:",
        layout="wide",
    )
    
    image_logo = get_cached_image("https://img.itch.zone/aW1hZ2UvMjQ5MzUzMi8xNDgxMjQ1OC5wbmc=/347x500/N%2BG9dy.png")
    image_container = get_cached_image("https://avatars.githubusercontent.com/u/43041149?v=4&size=2048")
    
    st.logo(
        image=image_logo,
        icon_image=image_logo,
        size="large"
    )
    
    with st.sidebar.container(key="bottom_container"):
        avatar(
            image=image_container,
            label="Rigeru 2026",
            caption="Personal Project",
            height=30
        )
        
    st.html("""
    <style>
        .st-key-bottom_container {
            position: absolute;
            bottom: 10px;
        }
        .stAppDeployButton {
            display: none;
        }
        header {
            background-color: transparent !important;
        }
        #MainMenu {visibility: hidden;}
    </style>
    """)
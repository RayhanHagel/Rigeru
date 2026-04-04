import streamlit as st
from streamlit_extras.avatar import *
from utilities.util_network import get_image_cache




def apply_logo():
    st.set_page_config(
        page_title="Rigeru",
        page_icon=":material/gamepad_circle_left:",
        layout="wide",
    )
    
    image_logo = get_image_cache(url="https://img.itch.zone/aW1hZ2UvMjQ5MzUzMi8xNDgxMjQ1OC5wbmc=/347x500/N%2BG9dy.png")
    st.logo(
        image=image_logo,
        icon_image=image_logo,
        size="large"
    )
    
    st.html("""
    <style>
        .stAppDeployButton {
            display: none;
        }
        header {
            background-color: rgba(30, 32, 38, 0.95) !important;
        }
        #MainMenu {visibility: hidden;}
    </style>
    """)
    



def apply_footer():
    image_container = get_image_cache(url="https://avatars.githubusercontent.com/u/43041149?v=4&size=2048")
    with st.sidebar.container(key="sticky_footer"):
        avatar(
            image=image_container,
            label="Rigeru 2026",
            caption="Personal Project",
            height=30
        )
    st.html("""
        <style>
            .st-key-sticky_footer {
                position: absolute;
                bottom: 10px;
            }
        </style>
        """)
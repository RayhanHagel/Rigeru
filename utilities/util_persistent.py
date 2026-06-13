import streamlit as st
from streamlit_extras.avatar import avatar
from utilities.util_network import get_image_cache


def apply_logo():
    st.set_page_config(
        page_title="Rigeru",
        page_icon=":material/gamepad_circle_left:",
        layout="wide",
    )

    image_logo = get_image_cache(url="https://img.itch.zone/aW1hZ2UvMjQ5MzUzMi8xNDgxMjQ1OC5wbmc=/347x500/N%2BG9dy.png")
    if image_logo:
        st.logo(
            image=image_logo,
            icon_image=image_logo,
            size="large"
        )


def apply_footer():
    """Applies the custom avatar footer to the sidebar with safe CSS positioning."""
    st.markdown(
        """
        <style>
            [data-testid="stSidebarContent"] {
                padding-bottom: 6rem !important;
            }
            div[data-testid="stSidebar"] div:has(> div[key="sticky_footer"]),
            div[key="sticky_footer"] {
                position: relative !important;
                bottom: auto !important;
                top: auto !important;
                transform: none !important;
                margin-top: 2rem !important;
                z-index: 10 !important;
            }
        </style>
        """,
        unsafe_allow_html=True
    )

    image_container = get_image_cache(url="https://avatars.githubusercontent.com/u/43041149?v=4&size=2048")

    with st.sidebar.container(key="sticky_footer"):
        st.divider()
        avatar(
            image=image_container if image_container else "https://avatars.githubusercontent.com/u/43041149",
            label="Rigeru 2026",
            caption="Personal Project",
            height=30
        )


def apply_theme() -> None:
    BG         = "#131620"
    FONT_SERIF = "'Libre Baskerville', Georgia, serif"
    FONT_MONO  = "'DM Mono', monospace"

    st.markdown(
        f"""
            <style>
            @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital@0;1&family=DM+Mono:wght@300;400&display=swap');

            /* Float-in animation */
            @keyframes floatIn {{
                from {{
                    opacity:   0;
                    transform: translateY(14px);
                }}
                to {{
                    opacity:   1;
                    transform: translateY(0);
                }}
            }}

            /* Apply to every major Streamlit element wrapper */
            [data-testid="stMarkdownContainer"],
            [data-testid="stText"],
            [data-testid="stImage"],
            [data-testid="stButton"],
            [data-testid="stSelectbox"],
            [data-testid="stMultiSelect"],
            [data-testid="stTextInput"],
            [data-testid="stTextArea"],
            [data-testid="stNumberInput"],
            [data-testid="stSlider"],
            [data-testid="stCheckbox"],
            [data-testid="stRadio"],
            [data-testid="stMetric"],
            [data-testid="stDataFrame"],
            [data-testid="stTable"],
            [data-testid="stExpander"],
            [data-testid="stTabs"],
            [data-testid="stAlert"],
            [data-testid="stCaptionContainer"],
            [data-testid="stFileUploader"],
            [data-testid="stPlotlyChart"],
            [data-testid="element-container"] {{
                animation: floatIn 0.45s ease both;
            }}

            /* Stagger children inside columns so they cascade */
            [data-testid="column"] [data-testid="element-container"]:nth-child(1)  {{ animation-delay: 0.00s; }}
            [data-testid="column"] [data-testid="element-container"]:nth-child(2)  {{ animation-delay: 0.05s; }}
            [data-testid="column"] [data-testid="element-container"]:nth-child(3)  {{ animation-delay: 0.10s; }}
            [data-testid="column"] [data-testid="element-container"]:nth-child(4)  {{ animation-delay: 0.15s; }}
            [data-testid="column"] [data-testid="element-container"]:nth-child(5)  {{ animation-delay: 0.20s; }}
            [data-testid="column"] [data-testid="element-container"]:nth-child(6)  {{ animation-delay: 0.25s; }}

            /* Background */
            html, body,
            [data-testid="stAppViewContainer"],
            [data-testid="stApp"] {{
                background-color: {BG} !important;
            }}

            /* Ambient glow */
            [data-testid="stAppViewContainer"]::before {{
                content: '';
                position: fixed;
                inset: 0;
                background:
                    radial-gradient(ellipse 80% 60% at 20% 10%, rgba(120,80,255,0.18) 0%, transparent 60%),
                    radial-gradient(ellipse 60% 50% at 80% 80%, rgba(255,60,120,0.12) 0%, transparent 60%);
                pointer-events: none;
                z-index: 0;
            }}

            /* Typography */
            body, p, li,
            .stMarkdown, .stText,
            [data-testid="stMarkdownContainer"] {{
                font-family: {FONT_MONO} !important;
                color: rgba(255,255,255,0.78);
            }}

            h1, h2, h3, h4, h5, h6 {{
                font-family: {FONT_SERIF} !important;
                color: rgba(255,255,255,0.92) !important;
            }}

            /* Restore Material Icons */
            .material-icons,
            .material-icons-outlined,
            .material-icons-round,
            .material-icons-sharp,
            .material-symbols-outlined,
            .material-symbols-rounded,
            .material-symbols-sharp {{
                font-family: 'Material Icons', 'Material Icons Outlined',
                            'Material Icons Round', 'Material Icons Sharp',
                            'Material Symbols Outlined', 'Material Symbols Rounded',
                            'Material Symbols Sharp' !important;
                font-size: inherit;
                line-height: 1;
                letter-spacing: normal;
                text-transform: none;
                display: inline-block;
                word-wrap: normal;
                -webkit-font-feature-settings: 'liga';
                font-feature-settings: 'liga';
                -webkit-font-smoothing: antialiased;
            }}

            /* Sidebar */
            [data-testid="stSidebar"] {{
                background: rgba(255,255,255,0.03) !important;
                border-right: 1px solid rgba(255,255,255,0.07) !important;
            }}

            /* Buttons */
            .stButton > button {{
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.12);
                color: rgba(255,255,255,0.80);
                font-family: {FONT_MONO};
                font-size: 13px;
                border-radius: 6px;
                transition: background 0.2s, border-color 0.2s;
            }}
            .stButton > button:hover {{
                background: rgba(255,255,255,0.10);
                border-color: rgba(255,255,255,0.22);
            }}

            /* Inputs */
            .stTextInput > div > div > input,
            .stSelectbox > div > div,
            .stMultiSelect > div > div {{
                background: rgba(255,255,255,0.05) !important;
                border: 1px solid rgba(255,255,255,0.10) !important;
                color: rgba(255,255,255,0.82) !important;
                font-family: {FONT_MONO} !important;
            }}

            /* Dividers */
            hr {{
                border: none;
                height: 1px;
                background: linear-gradient(90deg,
                    transparent 0%,
                    rgba(255,255,255,0.08) 30%,
                    rgba(255,255,255,0.08) 70%,
                    transparent 100%);
            }}

            /* Sticky footer */
            .st-key-sticky_footer {{
                position: absolute;
                bottom: 10px;
            }}

            /* Header & deploy button */
            .stAppDeployButton {{
                display: none;
            }}
            header {{
                background-color: rgba(30, 32, 38, 0.95) !important;
            }}
            #MainMenu {{
                visibility: hidden;
            }}
            </style>
        """,
        unsafe_allow_html=True,
    )

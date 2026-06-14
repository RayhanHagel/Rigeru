import streamlit as st
from streamlit_extras.avatar import avatar
from utilities.util_network import get_image_cache

# --- Theme Configurations ---
THEMES = {
    "Nebula (Default)": {
        "BG": "#131620",
        "TEXT": "rgba(255,255,255,0.78)",
        "HEADING": "rgba(255,255,255,0.92)",
        "GLOW_1": "rgba(120,80,255,0.18)",
        "GLOW_2": "rgba(255,60,120,0.12)",
        "UI_BG": "rgba(255,255,255,0.05)",
        "UI_BORDER": "rgba(255,255,255,0.10)",
        "HEADER_BG": "rgba(30, 32, 38, 0.95)"
    },
    "Cyberpunk": {
        "BG": "#090a0f",
        "TEXT": "rgba(220,240,255,0.85)",
        "HEADING": "#00FFCC",
        "GLOW_1": "rgba(0,255,204,0.15)",
        "GLOW_2": "rgba(255,0,128,0.15)",
        "UI_BG": "rgba(0,255,204,0.05)",
        "UI_BORDER": "rgba(0,255,204,0.25)",
        "HEADER_BG": "rgba(9, 10, 15, 0.95)"
    },
    "Light Minimal": {
        "BG": "#F9FAFB",
        "TEXT": "#1f2937",
        "HEADING": "#111827",
        "GLOW_1": "rgba(59,130,246,0.12)",
        "GLOW_2": "rgba(147,51,234,0.08)",
        "UI_BG": "#ffffff",
        "UI_BORDER": "rgba(0,0,0,0.25)",
        "HEADER_BG": "rgba(249, 250, 251, 0.95)"
    },
    "Deep Forest": {
        "BG": "#0a120d",
        "TEXT": "rgba(230,245,235,0.80)",
        "HEADING": "#86efac",
        "GLOW_1": "rgba(34,197,94,0.15)",
        "GLOW_2": "rgba(234,179,8,0.10)",
        "UI_BG": "rgba(255,255,255,0.04)",
        "UI_BORDER": "rgba(34,197,94,0.20)",
        "HEADER_BG": "rgba(10, 18, 13, 0.95)"
    },
    "Midnight Blue": {
        "BG": "#080c17",
        "TEXT": "rgba(200,220,255,0.80)",
        "HEADING": "#93c5fd",
        "GLOW_1": "rgba(59,130,246,0.18)",
        "GLOW_2": "rgba(14,165,233,0.12)",
        "UI_BG": "rgba(255,255,255,0.05)",
        "UI_BORDER": "rgba(59,130,246,0.20)",
        "HEADER_BG": "rgba(8, 12, 23, 0.95)"
    },
    "Sunset Glow": {
        "BG": "#1a0f14",
        "TEXT": "rgba(255,230,220,0.85)",
        "HEADING": "#ff8c42",
        "GLOW_1": "rgba(255,94,77,0.15)",
        "GLOW_2": "rgba(255,140,66,0.12)",
        "UI_BG": "rgba(255,255,255,0.04)",
        "UI_BORDER": "rgba(255,140,66,0.25)",
        "HEADER_BG": "rgba(26,15,20,0.95)"
    },
    "Retro Wave": {
        "BG": "#0d0221",
        "TEXT": "rgba(220,210,255,0.85)",
        "HEADING": "#ff00ff",
        "GLOW_1": "rgba(255,0,255,0.15)",
        "GLOW_2": "rgba(0,255,255,0.15)",
        "UI_BG": "rgba(255,0,255,0.04)",
        "UI_BORDER": "rgba(0,255,255,0.30)",
        "HEADER_BG": "rgba(13,2,33,0.95)"
    },
    "Solarized Light": {
        "BG": "#fdf6e3",
        "TEXT": "#657b83",
        "HEADING": "#268bd2",
        "GLOW_1": "rgba(38,139,210,0.10)",
        "GLOW_2": "rgba(211,54,130,0.08)",
        "UI_BG": "#eee8d5",
        "UI_BORDER": "rgba(101,123,131,0.25)",
        "HEADER_BG": "rgba(253,246,227,0.95)"
    },
    "Hacker Terminal": {
        "BG": "#000000",
        "TEXT": "#00ff00",
        "HEADING": "#00ff00",
        "GLOW_1": "rgba(0,255,0,0.10)",
        "GLOW_2": "rgba(0,150,0,0.10)",
        "UI_BG": "rgba(0,255,0,0.05)",
        "UI_BORDER": "rgba(0,255,0,0.40)",
        "HEADER_BG": "rgba(0,0,0,0.95)"
    }
}

def render_theme_selector():
    """Renders a theme selector dropdown in the sidebar."""
    if "selected_theme" not in st.session_state:
        st.session_state.selected_theme = "Nebula (Default)"

    with st.sidebar:
        st.selectbox(
            "🎨 App Theme",
            options=list(THEMES.keys()),
            key="selected_theme",
            help="Select the visual theme for the application."
        )


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
    current_theme_name = st.session_state.get("selected_theme", "Nebula (Default)")
    theme = THEMES[current_theme_name]

    FONT_SERIF = "'Libre Baskerville', Georgia, serif"
    FONT_MONO  = "'DM Mono', monospace"

    st.markdown(
        f"""
            <style>
            @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital@0;1&family=DM+Mono:wght@300;400&display=swap');

            /* Float-in animation */
            @keyframes floatIn {{
                from {{ opacity: 0; transform: translateY(14px); }}
                to {{ opacity: 1; transform: translateY(0); }}
            }}

            /* --- BASE APP STYLING --- */
            html, body, [data-testid="stAppViewContainer"], [data-testid="stApp"], [data-testid="stHeader"] {{
                background-color: {theme['BG']} !important;
            }}

            [data-testid="stAppViewContainer"]::before {{
                content: '';
                position: fixed;
                inset: 0;
                background:
                    radial-gradient(ellipse 80% 60% at 20% 10%, {theme['GLOW_1']} 0%, transparent 60%),
                    radial-gradient(ellipse 60% 50% at 80% 80%, {theme['GLOW_2']} 0%, transparent 60%);
                pointer-events: none;
                z-index: 0;
            }}

            /* Typography Basics */
            body, p, li, label, .stMarkdown, .stText, [data-testid="stMarkdownContainer"] {{
                font-family: {FONT_MONO} !important;
                color: {theme['TEXT']} !important;
            }}

            h1, h2, h3, h4, h5, h6 {{
                font-family: {FONT_SERIF} !important;
                color: {theme['HEADING']} !important;
            }}

            /* --- SIDEBAR & FOOTER --- */
            [data-testid="stSidebar"] {{
                background: {theme['UI_BG']} !important;
                border-right: 1px solid {theme['UI_BORDER']} !important;
            }}
            div.st-key-sticky_footer *, div[data-testid="stSidebar"] p, div[data-testid="stSidebar"] span {{
                color: {theme['TEXT']} !important;
            }}
            [data-testid="stSidebarNav"], [data-testid="stSidebarNav"] details, [data-testid="stSidebarNav"] summary, 
            [data-testid="stSidebarNav"] ul, [data-testid="stSidebarNav"] li, [data-testid="stSidebarNav"] a {{
                background-color: transparent !important;
            }}
            [data-testid="stSidebarNav"] summary, [data-testid="stSidebarNav"] a {{
                color: {theme['TEXT']} !important;
                border-radius: 6px;
                font-family: {FONT_MONO} !important;
                transition: background-color 0.2s, color 0.2s;
            }}
            [data-testid="stSidebarNav"] summary:hover, [data-testid="stSidebarNav"] a:hover, [data-testid="stSidebarNav"] a[aria-current="page"] {{
                background-color: {theme['UI_BG']} !important;
                color: {theme['HEADING']} !important;
            }}
            [data-testid="stSidebarNav"] span, [data-testid="stSidebarNav"] svg {{
                color: inherit !important;
                fill: currentColor !important;
            }}

            /* --- CONTAINERS, FORMS & DIVIDERS --- */
            [data-testid="stVerticalBlockBorderWrapper"], [data-testid="stForm"] {{
                border-color: {theme['UI_BORDER']} !important;
                border-style: solid !important;
                border-width: 1px !important;
                border-radius: 8px !important;
            }}
            hr, [data-testid="stDivider"] hr {{
                border: none !important;
                height: 1.5px !important;
                background: linear-gradient(90deg, transparent 0%, {theme['UI_BORDER']} 20%, {theme['UI_BORDER']} 80%, transparent 100%) !important;
            }}

            /* --- BUTTONS & PILLS --- */
            .stButton > button, [data-testid="baseButton-secondary"], [data-testid="baseButton-primary"], 
            button[kind="secondary"], button[kind="primary"], [data-testid="stBaseButton-secondary"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                color: {theme['TEXT']} !important;
                transition: border-color 0.2s, background-color 0.2s;
            }}
            .stButton > button p, [data-testid="baseButton-secondary"] div, [data-testid="baseButton-primary"] div, button[kind="secondary"] div {{
                color: {theme['TEXT']} !important;
            }}
            .stButton > button:hover, [data-testid="baseButton-secondary"]:hover, button[kind="secondary"]:hover, [data-testid="stBaseButton-secondary"]:hover {{
                border-color: {theme['HEADING']} !important;
                background-color: {theme['BG']} !important;
            }}
            [data-testid="stPills"] button, [data-testid="stSegmentedControl"] button {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                color: {theme['TEXT']} !important;
            }}
            [data-testid="stPills"] button[data-selected="true"], [data-testid="stSegmentedControl"] button[data-selected="true"] {{
                background-color: {theme['UI_BORDER']} !important;
                color: {theme['HEADING']} !important;
                border-color: {theme['HEADING']} !important;
            }}

            /* --- INPUTS: TEXT, NUMBER, DATE, TIME, SELECT --- */
            .stTextInput > div > div > input, .stNumberInput > div > div > input, .stTextArea > div > div > textarea, 
            .stSelectbox > div > div, .stMultiSelect > div > div {{
                background: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                color: {theme['TEXT']} !important;
            }}
            input::placeholder, textarea::placeholder {{
                color: {theme['TEXT']} !important;
                opacity: 0.55 !important;
            }}
            /* Popover Menus (Selectbox, Date/Time Calendars) */
            [data-baseweb="popover"], [data-baseweb="popover"] > div, [data-baseweb="menu"], ul[role="listbox"], [data-baseweb="calendar"] {{
                background-color: {theme['BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
            }}
            li[role="option"], [data-baseweb="calendar"] * {{
                background-color: transparent !important;
                color: {theme['TEXT']} !important;
            }}
            li[role="option"]:hover, li[role="option"][aria-selected="true"], [data-baseweb="calendar"] [aria-selected="true"] {{
                background-color: {theme['UI_BG']} !important;
                color: {theme['HEADING']} !important;
            }}
            /* Number Input Steppers & Password Eyes */
            .stNumberInput [data-baseweb="button"], [data-baseweb="input"] button {{
                background-color: transparent !important;
                border: none !important;
            }}
            .stNumberInput [data-baseweb="button"] svg, [data-baseweb="input"] button svg {{
                fill: {theme['TEXT']} !important;
                color: {theme['TEXT']} !important;
            }}
            .stNumberInput [data-baseweb="button"]:hover svg, [data-baseweb="input"] button:hover svg {{
                fill: {theme['HEADING']} !important;
            }}

            /* --- MULTISELECT TAGS --- */
            span[data-baseweb="tag"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                color: {theme['TEXT']} !important;
            }}
            span[data-baseweb="tag"] span[role="presentation"]:hover {{
                background-color: {theme['UI_BORDER']} !important;
            }}
            span[data-baseweb="tag"] svg {{
                fill: {theme['TEXT']} !important;
            }}
            span[data-baseweb="tag"] span[role="presentation"]:hover svg {{
                fill: {theme['HEADING']} !important;
            }}

            /* --- CHECKBOX, RADIO & TOGGLE --- */
            [data-baseweb="radio"] > div:first-child, [data-baseweb="checkbox"] > div:first-child {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
            }}
            [data-baseweb="checkbox"] > div:first-child svg {{
                fill: {theme['HEADING']} !important;
            }}
            [data-baseweb="radio"] > div:first-child > div {{
                background-color: {theme['HEADING']} !important;
            }}

            /* --- SLIDERS --- */
            [data-testid="stSlider"] [role="slider"] {{
                background-color: {theme['HEADING']} !important;
                box-shadow: 0 0 0 2px {theme['BG']} !important;
            }}
            [data-baseweb="slider"] > div > div {{
                background-color: {theme['HEADING']} !important;
            }}
            [data-testid="stSliderTickBarMin"], [data-testid="stSliderTickBarMax"] {{
                color: {theme['TEXT']} !important;
            }}

            /* --- TOOLTIPS & HELP ICONS --- */
            [data-testid="stTooltipHoverTarget"] svg {{
                fill: {theme['TEXT']} !important;
                color: {theme['TEXT']} !important;
            }}
            [data-testid="stTooltipHoverTarget"]:hover svg {{
                fill: {theme['HEADING']} !important;
            }}
            [data-baseweb="tooltip"] > div, [data-testid="stTooltipContent"], div[role="tooltip"] {{
                background-color: {theme['HEADER_BG']} !important;
                color: {theme['TEXT']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 4px;
            }}

            /* --- ALERTS & TOASTS --- */
            [data-testid="stAlert"], [data-testid="stToast"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                color: {theme['TEXT']} !important;
                border-radius: 8px;
            }}
            [data-testid="stAlert"] [data-testid="stMarkdownContainer"], [data-testid="stToast"] div {{
                color: {theme['TEXT']} !important;
            }}

            /* --- FILE UPLOADER --- */
            [data-testid="stFileUploaderDropzone"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px dashed {theme['UI_BORDER']} !important;
                border-radius: 8px;
            }}
            [data-testid="stFileUploaderDropzone"] *, [data-testid="stFileUploaderDropzone"] div, [data-testid="stFileUploaderDropzone"] span {{
                color: {theme['TEXT']} !important;
                background-color: transparent !important;
            }}

            /* --- EXPANDERS & TABS --- */
            [data-testid="stExpander"] details {{
                border: 1px solid {theme['UI_BORDER']} !important;
                background-color: transparent !important;
            }}
            [data-testid="stExpander"] summary {{
                background-color: {theme['UI_BG']} !important;
                color: {theme['HEADING']} !important;
            }}
            [data-testid="stExpander"] summary p {{
                color: {theme['HEADING']} !important;
                font-family: {FONT_SERIF} !important;
            }}
            [data-testid="stExpander"] summary svg {{
                color: {theme['TEXT']} !important;
                fill: {theme['TEXT']} !important;
            }}
            /* Tabs */
            [data-testid="stTabs"] button[role="tab"] {{
                background-color: transparent !important;
                color: {theme['TEXT']} !important;
            }}
            [data-testid="stTabs"] button[role="tab"][aria-selected="true"] {{
                color: {theme['HEADING']} !important;
                border-bottom-color: {theme['HEADING']} !important;
            }}

            /* --- DATA DISPLAY: METRICS, TABLES, CHAT --- */
            /* Metrics */
            [data-testid="stMetricValue"] {{ color: {theme['HEADING']} !important; }}
            [data-testid="stMetricLabel"] {{ color: {theme['TEXT']} !important; }}
            /* Progress & Spinner */
            [data-testid="stProgress"] > div > div {{ background-color: {theme['HEADING']} !important; }}
            .stSpinner > div > div {{ border-top-color: {theme['HEADING']} !important; }}
            /* Chat */
            [data-testid="stChatMessage"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 8px;
            }}
            [data-testid="stChatInput"] {{
                background-color: {theme['BG']} !important;
                border-color: {theme['UI_BORDER']} !important;
            }}
            [data-testid="stChatInput"] textarea {{ color: {theme['TEXT']} !important; }}
            /* Static Tables */
            [data-testid="stTable"] table, [data-testid="stTable"] th, [data-testid="stTable"] td {{
                border-color: {theme['UI_BORDER']} !important;
                color: {theme['TEXT']} !important;
                background-color: {theme['BG']} !important;
            }}
            [data-testid="stTable"] th {{
                background-color: {theme['UI_BG']} !important;
                color: {theme['HEADING']} !important;
            }}

            /* --- HIDE DEFAULT STREAMLIT ARTIFACTS --- */
            [data-testid="stCustomComponentV1"] iframe {{
                background-color: transparent !important;
                color-scheme: transparent !important;
            }}
            .stAppDeployButton {{ display: none; }}
            header {{ background-color: {theme['HEADER_BG']} !important; }}
            #MainMenu {{ visibility: hidden; }}
            </style>
        """,
        unsafe_allow_html=True,
    )
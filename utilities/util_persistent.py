import streamlit as st
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
    },
    "Volcanic": {
        "BG": "#1a0a0a",
        "TEXT": "rgba(255,235,225,0.80)",
        "HEADING": "#ef4444",
        "GLOW_1": "rgba(239,68,68,0.15)",
        "GLOW_2": "rgba(245,158,11,0.10)",
        "UI_BG": "rgba(255,255,255,0.03)",
        "UI_BORDER": "rgba(239,68,68,0.20)",
        "HEADER_BG": "rgba(26, 10, 10, 0.95)"
    },
    "Ocean Depth": {
        "BG": "#051622",
        "TEXT": "rgba(200,230,240,0.80)",
        "HEADING": "#22d3ee",
        "GLOW_1": "rgba(34,211,238,0.15)",
        "GLOW_2": "rgba(30,58,138,0.15)",
        "UI_BG": "rgba(34,211,238,0.05)",
        "UI_BORDER": "rgba(34,211,238,0.25)",
        "HEADER_BG": "rgba(5, 22, 34, 0.95)"
    },
    "Amethyst": {
        "BG": "#160f1e",
        "TEXT": "rgba(230,220,250,0.85)",
        "HEADING": "#a78bfa",
        "GLOW_1": "rgba(167,139,250,0.15)",
        "GLOW_2": "rgba(236,72,153,0.10)",
        "UI_BG": "rgba(255,255,255,0.03)",
        "UI_BORDER": "rgba(167,139,250,0.20)",
        "HEADER_BG": "rgba(22, 15, 30, 0.95)"
    },
    "Sepia Tone": {
        "BG": "#f4ecd8",
        "TEXT": "#5b4636",
        "HEADING": "#785940",
        "GLOW_1": "rgba(120,89,64,0.08)",
        "GLOW_2": "rgba(200,180,150,0.10)",
        "UI_BG": "#ece3ce",
        "UI_BORDER": "rgba(120,89,64,0.20)",
        "HEADER_BG": "rgba(244, 236, 216, 0.95)"
    },
    "Monochrome Slate": {
        "BG": "#1f2937",
        "TEXT": "rgba(209,213,219,0.90)",
        "HEADING": "#f9fafb",
        "GLOW_1": "rgba(255,255,255,0.05)",
        "GLOW_2": "rgba(156,163,175,0.05)",
        "UI_BG": "rgba(255,255,255,0.05)",
        "UI_BORDER": "rgba(209,213,219,0.15)",
        "HEADER_BG": "rgba(31, 41, 55, 0.95)"
    },
    "Catppuccin Mocha": {
        "BG": "#1e1e2e",
        "TEXT": "#cdd6f4",
        "HEADING": "#89b4fa",
        "GLOW_1": "rgba(137, 180, 250, 0.15)",
        "GLOW_2": "rgba(245, 194, 231, 0.10)",
        "UI_BG": "#313244",
        "UI_BORDER": "#45475a",
        "HEADER_BG": "rgba(30, 30, 46, 0.95)"
    }
}

FONTS = {
    "Serif Mono (Default)": {
        "SERIF": "'Libre Baskerville', Georgia, serif",
        "MONO": "'DM Mono', monospace"
    },
    "Academic Classic": {
        "SERIF": "'Merriweather', serif",
        "MONO": "'IBM Plex Mono', monospace"
    },
    "Clean Minimalist": {
        "SERIF": "'Inter', sans-serif",
        "MONO": "'JetBrains Mono', monospace"
    },
    "Vintage Editorial": {
        "SERIF": "'Playfair Display', serif",
        "MONO": "'DM Mono', monospace"
    }
}


def render_theme_selector():
    """Renders a theme and font selector dropdown in the sidebar."""
    if "selected_theme" not in st.session_state:
        st.session_state.selected_theme = "Nebula (Default)"
    with st.sidebar:
        st.divider()
        st.selectbox(
            ":material/palette: App Theme",
            options=list(THEMES.keys()),
            key="selected_theme",
            help="Select the visual theme for the application."
        )

    if "selected_font" not in st.session_state:
        st.session_state.selected_font = "Default (Serif/Mono)"
    with st.sidebar:
        st.selectbox(
            ":material/text_fields: App Font",
            options=list(FONTS.keys()),
            key="selected_font",
            help="Choose the typeface for the application."
        )


def apply_logo():
    st.set_page_config(
        page_title="Rigeru",
        page_icon=":material/gamepad_circle_left:",
        layout="wide",
    )

    image_logo = get_image_cache(
        url="https://img.itch.zone/aW1hZ2UvMjQ5MzUzMi8xNDgxMjQ1OC5wbmc=/347x500/N%2BG9dy.png")
    if image_logo:
        st.logo(
            image=image_logo,
            icon_image=image_logo,
            size="large"
        )


def apply_footer():
    """Applies a custom, dependency-free footer with tighter spacing."""
    current_theme_name = st.session_state.get(
        "selected_theme", "Nebula (Default)")
    theme = THEMES[current_theme_name]
    image_container = get_image_cache(
        url="https://avatars.githubusercontent.com/u/43041149?v=4&size=2048")
    img_src = image_container if image_container else "https://avatars.githubusercontent.com/u/43041149"

    with st.sidebar:
        st.divider()
        st.markdown("""
            <style>
            [data-testid="column"] { gap: 0px !important; }
            </style>
        """, unsafe_allow_html=True)
        col1, col2 = st.columns([0.2, 0.80])
        with col1:
            st.image(img_src, width=30)
        with col2:
            st.markdown(f"""
                <div style="line-height: 1.2; margin-top: -2px; margin-left: -15px;">
                    <strong style="color: {theme['HEADING']}; font-size: 14px;">Rigeru 2026</strong><br>
                    <small style="color: {theme['TEXT']}; opacity: 0.8;">Personal Project</small>
                </div>
            """, unsafe_allow_html=True)


def apply_theme() -> None:
    current_theme_name = st.session_state.get(
        "selected_theme", "Nebula (Default)")
    theme = THEMES[current_theme_name]

    font_choice = st.session_state.get("selected_font", "Serif Mono (Default)")
    font_serif = FONTS[font_choice]["SERIF"]
    font_mono = FONTS[font_choice]["MONO"]

    st.markdown(
        f"""
            <style>
            @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital@0;1&family=DM+Mono:wght@300;400&display=swap');

            /* Float-in animation */
            @keyframes floatIn {{
                from {{ opacity: 0; transform: translateY(14px); }}
                to {{ opacity: 1; transform: translateY(0); }}
            }}

            /* ============================================================
               ROOT CSS VARIABLES
               Overrides Streamlit's internal theming variables so that
               built-in widgets (sliders, toggles, focus rings, etc.)
               automatically inherit the selected theme colors.
            ============================================================ */
            :root {{
                --primary-color: {theme['HEADING']} !important;
                --background-color: {theme['BG']} !important;
                --secondary-background-color: {theme['UI_BG']} !important;
                --text-color: {theme['TEXT']} !important;
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
                font-family: {font_mono} !important;
                color: {theme['TEXT']} !important;
            }}

            h1, h2, h3, h4, h5, h6 {{
                font-family: {font_serif} !important;
                color: {theme['HEADING']} !important;
            }}
            
            /* --- LINKS --- */
            a, [data-testid="stMarkdownContainer"] a {{
                color: {theme['HEADING']} !important;
                text-decoration: none !important;
                transition: color 0.2s ease, opacity 0.2s ease;
            }}
            
            a:hover, [data-testid="stMarkdownContainer"] a:hover {{
                text-decoration: underline !important;
                opacity: 0.8 !important;
            }}

            /* --- INLINE CODE --- */
            code, [data-testid="stMarkdownContainer"] code {{
                color: {theme['HEADING']} !important;
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 4px !important;
                padding: 0.15em 0.4em !important;
                font-family: {font_mono} !important;
                font-size: 0.9em !important;
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
                font-family: {font_mono} !important;
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
            [data-testid="stVerticalBlock"] {{
                border-color: {theme['UI_BORDER']} !important;
            }}
            hr, [data-testid="stDivider"] hr {{
                border: none !important;
                height: 1.5px !important;
                background: linear-gradient(90deg, transparent 0%, {theme['UI_BORDER']} 20%, {theme['UI_BORDER']} 80%, transparent 100%) !important;
            }}

            /* --- BUTTONS & PILLS --- */
            .stButton > button, [data-testid="baseButton-secondary"], [data-testid="baseButton-primary"],
            button[kind="secondary"], button[kind="primary"], [data-testid="stBaseButton-secondary"],
            [data-testid="stFormSubmitButton"] > button, 
            [data-testid="stBaseButton-primaryFormSubmit"], 
            button[kind="primaryFormSubmit"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                color: {theme['TEXT']} !important;
                transition: border-color 0.2s, background-color 0.2s;
            }}
            
            .stButton > button p, [data-testid="baseButton-secondary"] div, [data-testid="baseButton-primary"] div, button[kind="secondary"] div,
            [data-testid="stFormSubmitButton"] > button p,
            [data-testid="stBaseButton-primaryFormSubmit"] div,
            button[kind="primaryFormSubmit"] p {{
                color: {theme['TEXT']} !important;
            }}
            
            .stButton > button:hover, [data-testid="baseButton-secondary"]:hover, button[kind="secondary"]:hover, [data-testid="stBaseButton-secondary"]:hover,
            [data-testid="stFormSubmitButton"] > button:hover,
            [data-testid="stBaseButton-primaryFormSubmit"]:hover,
            button[kind="primaryFormSubmit"]:hover {{
                border-color: {theme['HEADING']} !important;
                background-color: {theme['UI_BG']} !important;
                color: {theme['HEADING']} !important;
            }}
            
            .stButton > button:hover p, [data-testid="baseButton-secondary"]:hover div,
            [data-testid="stFormSubmitButton"] > button:hover p,
            [data-testid="stBaseButton-primaryFormSubmit"]:hover div,
            button[kind="primaryFormSubmit"]:hover p {{
                color: {theme['HEADING']} !important;
            }}
            
            /* --- PILLS & SEGMENTED CONTROLS --- */
            
            /* 1. Default unselected state (Inactive Pills) */
            button[data-testid="stBaseButton-pills"], 
            [data-testid="stSegmentedControl"] button {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                color: {theme['TEXT']} !important;
                transition: all 0.2s ease-in-out;
            }}

            /* Ensure any text or icons inside the inactive pill inherit the color */
            button[data-testid="stBaseButton-pills"] *, 
            [data-testid="stSegmentedControl"] button * {{
                color: inherit !important;
            }}

            /* 2. Hover state for inactive pills */
            button[data-testid="stBaseButton-pills"]:hover, 
            [data-testid="stSegmentedControl"] button:hover {{
                border-color: {theme['HEADING']} !important;
                color: {theme['HEADING']} !important;
            }}

            /* 3. Selected/Active state (Streamlit's dedicated Active Pill component) */
            button[data-testid="stBaseButton-pillsActive"],
            [data-testid="stSegmentedControl"] button[aria-pressed="true"],
            [data-testid="stSegmentedControl"] button[data-selected="true"] {{
                background-color: {theme['UI_BG']} !important;
                border-color: {theme['HEADING']} !important;
                color: {theme['HEADING']} !important;
            }}
            
            /* Ensure text inside the active pill lights up too */
            button[data-testid="stBaseButton-pillsActive"] * {{
                color: inherit !important;
            }}

            /* --- INPUTS: TEXT, NUMBER, DATE, TIME, SELECTBOX & MULTISELECT --- */
            
            /* --- INPUTS: TEXT & TEXTAREA --- */
            
            /* 1. The Main Wrapper (The visual box) */
            [data-testid="stTextInputRootElement"],
            [data-testid="stTextAreaRootElement"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 6px !important;
                transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
            }}

            /* 2. Erase the hardcoded BaseWeb backgrounds inside the wrapper */
            [data-testid="stTextInputRootElement"] > div,
            [data-testid="stTextAreaRootElement"] > div,
            [data-testid="stTextInputRootElement"] [data-baseweb="base-input"],
            [data-testid="stTextAreaRootElement"] [data-baseweb="base-input"] {{
                background-color: transparent !important;
                border: none !important;
            }}

            /* 3. The actual typed text */
            input[data-testid="stTextInputField"],
            textarea[data-testid="stTextAreaField"],
            .stTextInput input,
            .stTextArea textarea {{
                background-color: transparent !important;
                border: none !important;
                color: {theme['TEXT']} !important;
            }}

            /* 4. Focus states for Text & Textarea */
            [data-testid="stTextInputRootElement"]:focus-within,
            [data-testid="stTextAreaRootElement"]:focus-within {{
                border-color: {theme['HEADING']} !important;
                box-shadow: 0 0 0 1px {theme['HEADING']} !important;
                background-color: {theme['BG']} !important;
            }}
            
            /* --- PLACEHOLDERS --- */
            [data-baseweb="input"] input::placeholder,
            [data-baseweb="textarea"] textarea::placeholder,
            [data-baseweb="base-input"] input::placeholder,
            input::placeholder, 
            textarea::placeholder {{
                color: {theme['TEXT']} !important;
                opacity: 0.45 !important;
            }}
            
            /* Webkit/Mozilla Specifics to force compliance */
            [data-baseweb="input"] input::-webkit-input-placeholder {{ color: {theme['TEXT']} !important; opacity: 0.45 !important; }}
            [data-baseweb="input"] input::-moz-placeholder {{ color: {theme['TEXT']} !important; opacity: 0.45 !important; }}
            
            /* --- PASSWORD INPUT EYE ICON --- */
            
            /* Target the eye icon specifically */
            [data-testid="stTextInputRootElement"] svg[data-baseweb="icon"] {{
                fill: {theme['TEXT']} !important;
                color: {theme['TEXT']} !important;
                transition: fill 0.2s ease-in-out;
                cursor: pointer !important;
            }}

            /* Add a nice hover effect using your primary heading color */
            [data-testid="stTextInputRootElement"] svg[data-baseweb="icon"]:hover {{
                fill: {theme['HEADING']} !important;
                color: {theme['HEADING']} !important;
            }}

            /* --- INPUTS: SELECTBOX & MULTISELECT --- */
            
            /* 1. The Main Wrapper (The visual box) */
            [data-baseweb="select"] > div {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 6px !important;
                transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
            }}
            
            /* 2. Nuke ALL nested hardcoded backgrounds (Forces inner text/divs to be transparent) */
            [data-baseweb="select"] > div *, 
            [data-baseweb="select"] > div div, 
            [data-baseweb="select"] > div input, 
            [data-baseweb="select"] > div span {{
                background-color: transparent !important;
                color: {theme['TEXT']} !important;
            }}
            
            /* 3. Dropdown Arrow Icon */
            [data-baseweb="select"] svg,
            [data-baseweb="select"] [data-baseweb="icon"] {{
                fill: {theme['TEXT']} !important;
                color: {theme['TEXT']} !important;
            }}
            
            /* 4. Hover state for dropdown arrow */
            [data-baseweb="select"] svg:hover {{
                fill: {theme['HEADING']} !important;
            }}
            
            /* 5. Focus ring */
            [data-baseweb="select"] > div:focus-within {{
                border-color: {theme['HEADING']} !important;
                box-shadow: 0 0 0 1px {theme['HEADING']} !important;
                background-color: {theme['BG']} !important;
                outline: none !important;
            }}

            /* --- POPOVER MENUS (The Dropdown Options List) --- */
            
            /* 1. Main popover container */
            [data-baseweb="popover"], 
            [data-baseweb="popover"] > div,
            [data-testid="stSelectboxVirtualDropdown"],
            [data-testid="stMultiSelectVirtualDropdown"],
            ul[role="listbox"] {{
                background-color: {theme['BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 6px !important;
            }}
            
            /* 2. Strip Streamlit's inner Styletron borders */
            [data-baseweb="popover"] ul {{
                border-color: transparent !important;
                background-color: {theme['BG']} !important;
            }}

            /* 3. The individual option row */
            li[role="option"] {{
                background-color: {theme['BG']} !important;
                color: {theme['TEXT']} !important;
                border: none !important;
                transition: background-color 0.1s, color 0.1s;
            }}
            
            /* 4. Force ALL nested elements inside the dropdown rows to be transparent */
            li[role="option"] *,
            li[role="option"] div,
            li[role="option"] span {{
                background-color: transparent !important;
                color: inherit !important;
                border: none !important; 
            }}

            /* 5. Hover and Selected states */
            li[role="option"]:hover, 
            li[role="option"][aria-selected="true"],
            li[role="option"][aria-highlighted="true"] {{
                background-color: {theme['GLOW_1']} !important;
                color: {theme['HEADING']} !important;
            }}
            
            /* Keep all nested children transparent on hover, but light up the text */
            li[role="option"]:hover *,
            li[role="option"][aria-selected="true"] *,
            li[role="option"][aria-highlighted="true"] * {{
                background-color: transparent !important;
                color: {theme['HEADING']} !important;
            }}
            
            /* --- POPOVERS (st.popover) --- */
            /* 1. The Popover Button (ensures it matches your standard buttons) */
            [data-testid="stPopover"] button {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                color: {theme['TEXT']} !important;
                transition: border-color 0.2s, background-color 0.2s;
            }}
            
            /* 2. The Popover Content Body */
            [data-testid="stPopoverBody"] {{
                background-color: {theme['BG']} !important;
                color: {theme['TEXT']} !important;
                box-shadow: 0 4px 15px {theme['GLOW_1']} !important;
                border-radius: 8px !important;
            }}
            
            /* 3. Ensure standard text elements inside the popover inherit the theme color */
            [data-testid="stPopoverBody"] p, 
            [data-testid="stPopoverBody"] span,
            [data-testid="stPopoverBody"] label {{
                color: {theme['TEXT']} !important;
                background-color: transparent !important;
            }}
            
            /* --- NUMBER INPUT FIX --- */
            
            /* 1. The Main Wrapper */
            [data-testid="stNumberInputContainer"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 6px !important;
                overflow: hidden !important; /* Keeps the internal buttons neat */
                transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
            }}
            
            /* 2. Focus state for the wrapper */
            [data-testid="stNumberInputContainer"]:focus-within {{
                border-color: {theme['HEADING']} !important;
                box-shadow: 0 0 0 1px {theme['HEADING']} !important;
                background-color: {theme['BG']} !important;
            }}

            /* 3. Erase the hardcoded BaseWeb gray backgrounds inside the wrapper */
            [data-testid="stNumberInputContainer"] [data-baseweb="input"],
            [data-testid="stNumberInputContainer"] [data-baseweb="base-input"] {{
                background-color: transparent !important;
                border: none !important;
            }}

            /* 4. The actual typed numbers */
            input[data-testid="stNumberInputField"] {{
                background-color: transparent !important;
                color: {theme['TEXT']} !important;
            }}

            /* 5. The Plus and Minus Stepper Buttons */
            button[data-testid="stNumberInputStepDown"],
            button[data-testid="stNumberInputStepUp"] {{
                background-color: transparent !important;
                color: {theme['TEXT']} !important;
                border: none !important;
                transition: color 0.2s, background-color 0.2s;
            }}

            /* Button Hover States */
            button[data-testid="stNumberInputStepDown"]:hover,
            button[data-testid="stNumberInputStepUp"]:hover {{
                color: {theme['HEADING']} !important;
                background-color: {theme['UI_BORDER']} !important;
            }}
            
            /* Ensure the SVG icons inherit the text/heading color */
            button[data-testid="stNumberInputStepDown"] svg,
            button[data-testid="stNumberInputStepUp"] svg {{
                fill: currentColor !important;
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
            
            /* 1. Unchecked State (Targets both span and div for backwards compatibility) */
            [data-baseweb="radio"] > div:first-child, 
            [data-baseweb="checkbox"] > div:first-child,
            [data-baseweb="checkbox"] > span:first-child {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                transition: background-color 0.2s, border-color 0.2s;
            }}

            /* 2. Checked State (Uses :has to see if the adjacent input is checked) */
            [data-baseweb="checkbox"]:has(input[aria-checked="true"]) > div:first-child,
            [data-baseweb="checkbox"]:has(input[aria-checked="true"]) > span:first-child,
            [data-baseweb="radio"]:has(input[aria-checked="true"]) > div:first-child {{
                background-color: {theme['HEADING']} !important;
                border-color: {theme['HEADING']} !important;
            }}

            /* 3. The SVG Checkmark inside the box */
            [data-baseweb="checkbox"] > div:first-child svg,
            [data-baseweb="checkbox"] > span:first-child svg {{
                fill: {theme['BG']} !important; /* Makes the checkmark stand out against the HEADING background */
            }}
            
            /* 4. Radio button inner dot */
            [data-baseweb="radio"] > div:first-child > div {{
                background-color: {theme['BG']} !important;
            }}

            /* 5. Ensure the Label Text follows the theme */
            [data-testid="stCheckbox"] p,
            [data-baseweb="radio"] p {{
                color: {theme['TEXT']} !important;
            }}

            /* Toggle (st.toggle) */
            [data-testid="stToggle"] label [data-checked="true"] {{
                background-color: {theme['HEADING']} !important;
            }}
            [data-testid="stToggle"] label [data-checked="false"] {{
                background-color: {theme['UI_BORDER']} !important;
            }}

            /* --- SLIDERS --- */
            /* The thumb (the circle you drag) */
            [data-baseweb="slider"] [role="slider"] {{
                background-color: {theme['HEADING']} !important;
                box-shadow: 0 0 0 2px {theme['BG']} !important;
                outline: none !important;
            }}
            
            /* The floating value label right above the thumb */
            [data-testid="stSliderThumbValue"] p {{
                color: {theme['HEADING']} !important;
                background-color: transparent !important;
            }}

            /* THE TRACK: Overriding the hardcoded red Streamlit linear-gradient */
            [data-baseweb="slider"] div[style*="height: 0.25rem;"] {{
                background: {theme['UI_BORDER']} !important; 
                border-radius: 4px !important;
            }}

            /* The Min/Max values on the bottom tick bar */
            [data-testid="stSliderTickBar"] div,
            [data-testid="stSliderTickBar"] p {{
                color: {theme['TEXT']} !important;
                background-color: transparent !important;
            }}

            /* --- TOOLTIPS --- */
            
            /* 1. Strip default outlines and shadows from the button and ALL wrapper spans */
            [data-testid="stTooltipIcon"],
            [data-testid="stTooltipIcon"] *,
            [data-testid="stTooltipHoverTarget"],
            [data-testid="stTooltipHoverTarget"] * {{
                outline: none !important;
                box-shadow: none !important;
                background-color: transparent !important;
            }}
            
            /* 2. Kill the focus, active, and focus-within states that trigger on click */
            [data-testid="stTooltipIcon"]:focus-within,
            [data-testid="stTooltipHoverTarget"]:focus-within,
            [data-testid="stTooltipIcon"] button:focus,
            [data-testid="stTooltipHoverTarget"] button:focus,
            [data-testid="stTooltipIcon"] button:active,
            [data-testid="stTooltipHoverTarget"] button:active {{
                outline: none !important;
                box-shadow: none !important;
                border: none !important;
                background-color: transparent !important;
            }}

            /* 3. Style the SVG Icon to match the theme's default text color */
            [data-testid="stTooltipIcon"] svg,
            [data-testid="stTooltipHoverTarget"] svg,
            [data-testid="stTooltipIcon"] button {{
                stroke: {theme['TEXT']} !important;
                color: {theme['TEXT']} !important;
                fill: none !important; /* Ensures the inside of the circle stays transparent */
                transition: stroke 0.2s ease, color 0.2s ease;
            }}

            /* 4. Hover state: Light up the icon using the HEADING color */
            [data-testid="stTooltipIcon"]:hover svg,
            [data-testid="stTooltipHoverTarget"]:hover svg,
            [data-testid="stTooltipIcon"] button:hover svg {{
                stroke: {theme['HEADING']} !important;
                color: {theme['HEADING']} !important;
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

            /* --- EXPANDERS --- */
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
                font-family: {font_serif} !important;
            }}
            [data-testid="stExpander"] summary svg {{
                color: {theme['TEXT']} !important;
                fill: {theme['TEXT']} !important;
            }}
            
            /* --- TABS --- */
            /* Default unselected tab */
            button[data-testid="stTab"] {{
                background-color: transparent !important;
                color: {theme['TEXT']} !important;
                border-bottom-color: transparent !important;
                transition: color 0.2s, border-bottom-color 0.2s;
            }}
            
            /* Ensure text inside the tab inherits the color */
            button[data-testid="stTab"] * {{
                color: inherit !important;
            }}

            /* Hover state for unselected tabs */
            button[data-testid="stTab"]:hover {{
                color: {theme['HEADING']} !important;
            }}

            /* Selected / Active tab text */
            button[data-testid="stTab"][aria-selected="true"] {{
                color: {theme['HEADING']} !important;
                /* We ensure this is transparent so it doesn't clash with the highlight bar below */
                border-bottom-color: transparent !important; 
            }}
            
            /* THE FIX: The animated sliding highlight bar */
            [data-baseweb="tab-highlight"] {{
                background-color: {theme['HEADING']} !important;
            }}

            /* --- DATA DISPLAY: METRICS, TABLES, CHAT --- */
            /* Metrics */
            [data-testid="stMetricValue"] {{ color: {theme['HEADING']} !important; }}
            [data-testid="stMetricLabel"] {{ color: {theme['TEXT']} !important; }}
            
            /* --- PROGRESS BARS & SPINNERS --- */
            /* Progress Bar Track (Background) */
            [data-testid="stProgressBarTrack"] {{
                background-color: {theme['UI_BORDER']} !important;
            }}
            /* Progress Bar Fill */
            [data-testid="stProgressBarTrack"] > div {{
                background-color: {theme['HEADING']} !important;
            }}
            /* Spinner Element */
            .stSpinner > div > div {{
                border-top-color: {theme['HEADING']} !important; 
            }}
            
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
            
            /* --- DATAFRAMES (st.dataframe) --- */
            
            /* 1. Main DataFrame Container & Empty Space */
            [data-testid="stDataFrameResizable"] {{
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 0.5rem !important;
                background-color: {theme['BG']} !important;
            }}
            
            /* 2. Override Glide Data Grid Inline CSS Variables */
            /* Using a high-specificity selector to overpower the inline style="..." attributes */
            [data-testid="stDataFrame"] [class*="stDataFrameGlideDataEditor"] {{
                --gdg-bg-cell: {theme['BG']} !important;
                --gdg-bg-cell-medium: {theme['BG']} !important;
                --gdg-bg-header: {theme['UI_BG']} !important;
                --gdg-bg-header-has-focus: {theme['UI_BG']} !important;
                --gdg-bg-header-hovered: {theme['UI_BG']} !important;
                --gdg-bg-group-header: {theme['UI_BG']} !important;
                
                --gdg-text-dark: {theme['TEXT']} !important;
                --gdg-text-medium: {theme['TEXT']} !important;
                --gdg-text-light: {theme['TEXT']} !important;
                --gdg-text-header: {theme['HEADING']} !important;
                --gdg-text-group-header: {theme['HEADING']} !important;
                
                --gdg-border-color: {theme['UI_BORDER']} !important;
                --gdg-horizontal-border-color: {theme['UI_BORDER']} !important;
                --gdg-accent-color: {theme['HEADING']} !important;
            }}

            /* 3. Ensure the canvas fallback matches */
            [data-testid="data-grid-canvas"] {{
                background-color: {theme['BG']} !important;
            }}

            /* --- CHARTS (st.bar_chart / VegaLite) --- */
            /* Strip hardcoded background */
            [data-testid="stVegaLiteChart"] svg {{
                background-color: transparent !important;
            }}
            
            /* Recolor axis text and titles */
            [data-testid="stVegaLiteChart"] svg .role-axis-label text,
            [data-testid="stVegaLiteChart"] svg .role-axis-title text {{
                fill: {theme['TEXT']} !important;
            }}
            
            /* Recolor background grid lines */
            [data-testid="stVegaLiteChart"] svg .role-axis-grid line {{
                stroke: {theme['UI_BORDER']} !important;
            }}
            
            /* Attempt to recolor the main chart elements (Bars) */
            [data-testid="stVegaLiteChart"] svg .mark-rect path {{
                fill: {theme['HEADING']} !important;
            }}
            
            /* Chart Action Menu (Three dots) */
            [data-testid="stVegaLiteChart"] details summary {{
                color: {theme['TEXT']} !important;
            }}
            [data-testid="stVegaLiteChart"] details summary:hover {{
                color: {theme['HEADING']} !important;
            }}
            
            /* --- SIDEBAR COLLAPSE BUTTON ICON --- */
            [data-testid="stSidebarCollapseButton"] [data-testid="stIconMaterial"],
            [data-testid="stBaseButton-headerNoPadding"] [data-testid="stIconMaterial"] {{
                color: {theme['TEXT']} !important;
            }}

            /* --- ACTIVE NAV LINK ICON & TEXT --- */
            [data-testid="stSidebarNav"] a[aria-current="page"] [data-testid="stIconMaterial"] {{
                color: {theme['HEADING']} !important;
            }}
            [data-testid="stSidebarNav"] a[aria-current="page"] [data-testid="stMarkdownContainer"] p {{
                color: {theme['HEADING']} !important;
            }}
            
            /* --- IMAGE CARDS (Scrollable Vertical Blocks) --- */
            /* Targets specific containers without relying on brittle emotion-cache hashes */
            div[data-testid="stVerticalBlock"][height="250px"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important; /* Matches your st.divider color */
                border-radius: 8px !important;
                padding: 1rem !important;
                transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
                
                /* Keep the scrollbar inside the border */
                overflow: auto !important; 
            }}

            /* The Hover Effect */
            div[data-testid="stVerticalBlock"][height="250px"]:hover {{
                border-color: {theme['HEADING']} !important;
                box-shadow: 0 4px 15px {theme['GLOW_1']} !important;
                transform: translateY(-2px) !important; /* Slight lift effect */
            }}
            
            /* 5. The actual Tooltip Popover Box (the floating text) */
            [data-baseweb="tooltip"],
            [data-baseweb="tooltip"] > div,
            [data-testid="stTooltipContent"] {{
                background-color: {theme['BG']} !important;
                color: {theme['TEXT']} !important;
                border-radius: 6px !important;
                border: 1px solid {theme['UI_BORDER']} !important;
            }}

            /* 6. Force all text inside the tooltip box to be readable */
            [data-baseweb="tooltip"] *,
            [data-testid="stTooltipContent"] * {{
                color: {theme['TEXT']} !important;
                background-color: transparent !important;
            }}
            
            /* --- CODE BLOCKS (st.code) --- */
            /* Main code container */
            [data-testid="stCode"] pre {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 6px !important;
            }}
            
            /* Code syntax text */
            [data-testid="stCode"] code, 
            [data-testid="stCode"] span {{
                color: {theme['TEXT']} !important;
                font-family: {font_mono} !important;
            }}
            
            /* Copy button hover */
            [data-testid="stCode"] [data-testid="stElementToolbarButton"] button:hover {{
                background-color: {theme['UI_BG']} !important;
                border-color: {theme['HEADING']} !important;
                color: {theme['HEADING']} !important;
            }}
            
            /* --- GLOBAL ELEMENT TOOLBARS (DataFrames, Charts, Code Blocks) --- */
            
            /* 1. Strip rogue backgrounds from the container and tooltip wrappers */
            [data-testid="stElementToolbar"],
            [data-testid="stElementToolbarButtonContainer"],
            [data-testid="stElementToolbarButton"] > span,
            [data-testid="stElementToolbarButton"] [data-testid="stTooltipHoverTarget"] {{
                background-color: transparent !important;
                box-shadow: none !important;
            }}

            /* 2. Style the actual buttons to be highly visible */
            [data-testid="stElementToolbarButton"] button,
            button[kind="elementToolbar"] {{
                background-color: {theme['UI_BG']} !important;
                border: 1px solid {theme['UI_BORDER']} !important;
                border-radius: 4px !important;
                transition: all 0.2s ease !important;
                backdrop-filter: blur(4px) !important; /* Helps if it overlays an image/chart */
            }}

            /* 3. Force the SVG icons inside the buttons to use the HEADING color so they pop */
            [data-testid="stElementToolbarButton"] button svg,
            button[kind="elementToolbar"] svg {{
                fill: {theme['HEADING']} !important;
                color: {theme['HEADING']} !important;
                opacity: 0.9 !important;
            }}

            /* 4. Hover and Focus states for the buttons */
            [data-testid="stElementToolbarButton"] button:hover,
            button[kind="elementToolbar"]:hover,
            [data-testid="stElementToolbarButton"] button:focus-visible,
            button[kind="elementToolbar"]:focus-visible {{
                background-color: {theme['BG']} !important;
                border-color: {theme['HEADING']} !important;
                box-shadow: 0 0 0 1px {theme['HEADING']} !important;
            }}
            
            /* Light up the icon to 100% opacity on hover */
            [data-testid="stElementToolbarButton"] button:hover svg,
            button[kind="elementToolbar"]:hover svg {{
                opacity: 1 !important;
            }}
            </style>
        """,
        unsafe_allow_html=True,
    )

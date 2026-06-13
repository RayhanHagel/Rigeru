import json
import os
import streamlit as st

def read_cache() -> list:
    path = "./cache/quick_navigation.json"
    if os.path.exists(path):    
        try:
            with open(path, "r") as file:
                return json.load(file)
        except Exception:
            pass
            
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump([], f, indent=4) 
    return []

def write_cache(replace_data: list = None):
    config_path = './cache/quick_navigation.json'
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    
    if replace_data is not None:
        with open(config_path, "w") as f:
            json.dump(replace_data, f, indent=4)
        st.session_state.quick_cache = replace_data
        return
    
    cache = st.session_state.get('quick_cache', [])
    if 'temp_data' in st.session_state and st.session_state.temp_data:
        cache.append(st.session_state.temp_data)
        
    with open(config_path, "w") as f:
        json.dump(cache, f, indent=4)

def render_control_bar(is_disabled: bool):
    buttons = [
        (":material/delete_forever:", "Cancel adding the widget!", None, cancel_button, False),
        (":material/dashboard_2_edit:", "Add the widget!", "Pick a widget and enter details!", add_button, True if is_disabled else (False if st.session_state.get('temp_data_widget') is not None and st.session_state.get('temp_data_input') is not None else True)),
        (":material/dashboard_customize:", "Save the card widgets!", "Add a widget with details first!", save_button, False if st.session_state.get('temp_data', []) != [] else True)
    ]
    
    widget_cols = st.columns(spec=len(buttons), gap="small", vertical_alignment="bottom")
    for index, (icon, help_text, help_text_disabled, click, actually_disabled) in enumerate(buttons):
        widget_cols[index].button(
            label="", 
            icon=icon, 
            help=help_text_disabled if actually_disabled else help_text,
            disabled=actually_disabled,
            key=f"button_{index}",
            on_click=click,
            width="stretch"
        )

def cancel_button():
    if not st.session_state.get('temp_data', []):
        st.session_state.hide_add_button = False
        st.session_state.temp_data_input = None
        st.session_state.temp_data_widget = None
    else:
        st.session_state.temp_data.pop()

def add_button():
    if 'temp_data' not in st.session_state:
        st.session_state.temp_data = []
        
    st.session_state.temp_data.append(
        {
            "widget": st.session_state.get('temp_data_widget'),
            "input": st.session_state.get('temp_data_input')
        }
    )
    st.session_state.temp_data_widget = None
    st.session_state.temp_data_input = None

def save_button():
    write_cache()
    st.session_state.temp_data = []
    st.session_state.hide_add_button = False
    st.session_state.temp_data_input = None
    st.session_state.temp_data_widget = None

def sync_and_save(new_layout: list):
    sorted_layout = sorted(new_layout, key=lambda x: x['y'])
    new_order_indices = [int(item['i']) for item in sorted_layout]
    
    current_cache = st.session_state.get('temp_quick_cache', [])
    ordered_data = [current_cache[i] for i in new_order_indices if i < len(current_cache)]
    
    write_cache(replace_data=ordered_data)
import json
import os
import streamlit as st



def read_cache() -> tuple[dict, list]:
    path = "./cache/quick_navigation.json"
    
    if os.path.exists(path):    
        with open(path, "r") as file:
            data = json.load(file)
    else:
        with open(path, 'w') as f:
            json.dump([], f, indent=4) 
        data = []
    
    return data



def write_cache(replace_data:dict=None):
    config_path = './cache/quick_navigation.json'
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    
    if replace_data is not None:
        with open(config_path, "w") as f:
            json.dump(replace_data, f, indent=4)
        st.session_state.quick_cache = read_cache()
        return
    
    data = []
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            try:
                data = json.load(f)
                if not isinstance(data, list):
                    data = []
            except json.JSONDecodeError:
                data = []
    
    data.append(st.session_state.temp_data)
    with open(config_path, "w") as f:
        json.dump(data, f, indent=4)
        
    st.session_state.quick_cache = read_cache()


    
def render_control_bar(is_disabled:bool):
    buttons = [
        (":material/delete_forever:", "Cancel adding the widget!", None, cancel_button, False),
        (":material/dashboard_2_edit:", "Add the widget!", "Pick a widget and enter details!", add_button, True if is_disabled else (False if st.session_state.temp_data_widget != None and st.session_state.temp_data_input != None else True)),
        (":material/dashboard_customize:", "Save the card widgets!", "Add a widget with details first!", save_button, False if st.session_state.temp_data != [] else True)
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
            use_container_width=True
        )



def cancel_button():
    if st.session_state.temp_data == []:
        st.session_state.hide_add_button = False
        st.temp_data_input = None
        st.temp_data_widget = None
    else:
        st.session_state.temp_data.pop()
    


def add_button():
    st.session_state.temp_data.append(
        {
            "widget": st.session_state.temp_data_widget,
            "input": st.session_state.temp_data_input
        }
    )
    st.session_state.temp_data_widget = None
    st.session_state.temp_data_input = None
    


def save_button():
    write_cache(replace_data=None)
    st.session_state.temp_data = []
    st.session_state.hide_add_button = False
    st.temp_data_input = None
    st.temp_data_widget = None
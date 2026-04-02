from utilities.util_network import better_get
import os
import json
import streamlit as st



@st.cache_data(ttl=5*60)
def check_live_status(channel:str):
    url = f'https://www.twitch.tv/{channel}'
    contents = better_get(url).content.decode('utf-8')
    if 'isLiveBroadcast' in contents:
        return True
    else:
        return False



def read_cache() -> tuple[dict, list]:
    path = "./cache/twitch_priority.json"
    
    if os.path.exists(path):    
        with open(path, "r") as file:
            data = json.load(file)
    else:
        with open(path, 'w') as f:
            json.dump([], f, indent=4) 
        data = []
    
    return data



def save_config(channel:str, replace_data:dict=None):
    config_path = "./cache/twitch_priority.json"    
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    
    if replace_data == None:
        data = []
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    data = []
        
        if channel in data:
            pass
        else:
            data.append(channel)

        with open(config_path, "w") as f:
            json.dump(data, f, indent=4)
    
    else:
        with open(config_path, "w") as f:
            json.dump(replace_data, f, indent=4)
    
    st.session_state.twitch_cache = read_cache()
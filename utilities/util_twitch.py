from utilities.util_network import better_get
import os
import json
import streamlit as st



@st.cache_data(ttl=5*60)
def check_live_status(channel:str):
    response = better_get(f'https://www.twitch.tv/{channel}')
    if response is None:
        return False
    return 'isLiveBroadcast' in response.content.decode('utf-8')



def read_cache() -> list:
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

    if replace_data is None:
        if channel not in st.session_state.twitch_cache:
            st.session_state.twitch_cache.append(channel)
        with open(config_path, "w") as f:
            json.dump(st.session_state.twitch_cache, f, indent=4)
    
    else:
        with open(config_path, "w") as f:
            json.dump(replace_data, f, indent=4)
        st.session_state.twitch_cache = replace_data
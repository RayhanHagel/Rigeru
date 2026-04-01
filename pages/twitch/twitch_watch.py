import streamlit as st
import streamlit.components.v1 as components
from utilities.util_twitch import check_live_status




st.title("📺 Twitch Watch!")

channel_lists = [
    "michaelreeves",
    "mrekk"
]

if "check_twitch" not in st.session_state:
    for channel in channel_lists:
        if check_live_status(channel):
            st.session_state.check_twitch = channel
            break

embed_url = f"https://player.twitch.tv/?channel={st.session_state.check_twitch}&parent=localhost"
components.iframe(embed_url, height=400, scrolling=False)
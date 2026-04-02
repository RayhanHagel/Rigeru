import streamlit as st
import streamlit.components.v1 as components
from utilities.util_twitch import check_live_status
from utilities.util_persistent import apply_logo
from streamlit_autorefresh import st_autorefresh




apply_logo()
st.title("📺 Twitch Watch!")


minutes = 5
count = st_autorefresh(interval=minutes*60000, key="twitchcheck")
st.session_state.check_twitch = None


for channel in st.session_state.get('twitch_cache', []):
    if check_live_status(channel):
        st.session_state.check_twitch = channel
        break

if st.session_state.check_twitch is not None:
    video_url = f"https://player.twitch.tv/?channel={st.session_state.check_twitch}&parent=localhost"
    components.iframe(video_url, height=400, scrolling=False)
    
    chat_embed = f"https://www.twitch.tv/embed/{st.session_state.check_twitch}/chat?parent=localhost"
    components.iframe(chat_embed, height=400, scrolling=False)
else:
    st.markdown(":violet[Did not find any live streams from the provided list.]")
import streamlit as st
from utilities.util_manga import read_cache as manga_rc
from utilities.util_quick import read_cache as quick_rc




st.session_state.quick = {
    "home": "pages\quick\quick_home.py",
    "sort": "pages\quick\quick_sort.py"
}

st.session_state.manga = {
    "search": "pages\manga\manga_search.py",
    "library": "pages\manga\manga_library.py",
    "read": "pages\manga\manga_read.py",
    "sort": "pages\manga\manga_sort.py",
    "pdf": "pages\manga\manga_pdf.py"
}

st.session_state.twitch = {
    "player": "pages\\twitch\\twitch_watch.py"
}


st.session_state.quick_cache = quick_rc()
st.session_state.manga_cache = manga_rc()


pages = {
    "Quick Navigation": [
        st.Page(st.session_state.quick["home"], title="Home"),
        st.Page(st.session_state.quick["sort"], title="Sort", visibility="hidden")
    ],
    "Manga and Manhwa": [
        st.Page(st.session_state.manga["search"], title="Search Titles"),
        st.Page(st.session_state.manga["library"], title="Library Folder"),
        st.Page(st.session_state.manga["read"], title="Read Selected", visibility="hidden"),
        st.Page(st.session_state.manga["sort"], title="Sort Library", visibility="hidden"),
        st.Page(st.session_state.manga["pdf"], title="Browse PDF", visibility="hidden")
    ],
    "Twitch Player": [
        st.Page(st.session_state.twitch["player"], title="Watch")
    ]
}

pg = st.navigation(pages)
pg.run()
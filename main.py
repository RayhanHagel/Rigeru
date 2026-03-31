import streamlit as st
from utilities.util_manga import read_cache


st.session_state.manga = {
    "search": "pages\manga\manga_search.py",
    "library": "pages\manga\manga_library.py",
    "read": "pages\manga\manga_read.py",
    "sort": "pages\manga\manga_sort_library.py",
    "pdf": "pages\manga\manga_pdf.py"
}

st.session_state.cache_data, st.session_state.library_list = read_cache()

pages = {
    "Manga and Manhwa": [
        st.Page(st.session_state.manga["search"], title="Search Titles"),
        st.Page(st.session_state.manga["library"], title="Library Folder"),
        st.Page(st.session_state.manga["read"], title="Read Selected", visibility="hidden"),
        st.Page(st.session_state.manga["sort"], title="Sort Library", visibility="hidden"),
        st.Page(st.session_state.manga["pdf"], title="Browse PDF", visibility="hidden")
    ],
}

pg = st.navigation(pages)
pg.run()
import streamlit as st
import streamlit_extras.specialized_inputs as stsi
from utilities.util_manga import change_chapter_read, download_chapter, refresh_library

from utilities.util_network import get_image_cache

# --- State Initialization & Routing ---
if "selected_title" not in st.session_state:
    st.switch_page(st.session_state.nav_manga["manga_library"])

if "downloading_all" not in st.session_state:
    st.session_state.downloading_all = False

chapter_json = st.session_state.manga_cache.get(st.session_state.selected_title)
st.session_state.open_chapter = False

if not chapter_json:
    st.error("Error loading manga details. Please return to the library.")
    st.stop()

st.header("☄️ Manga and Manhwa")

# --- Top Action Bar ---
column_subheader = st.columns(spec=[0.92, 0.08], gap="small", vertical_alignment="bottom")
column_subheader[0].subheader(body=st.session_state.selected_title, width="stretch", divider="violet")
column_subheader[1].button(label="", icon=":material/refresh:", on_click=refresh_library, args=(st.session_state.selected_title,), width="stretch")

# --- Content Grid ---
column_outside = st.columns(spec=[0.35, 0.65], gap="small", border=True)

# Left Column: Cover Image
with column_outside[0]:
    cached_image = get_image_cache(url=chapter_json["image"], crop=True)
    st.image(image=cached_image if cached_image else chapter_json["image"], width="stretch")

# Right Column: Details & Actions
with column_outside[1]:
    st.write("**Tag Information**")
    st.markdown(
        f":violet-badge[:material/edit_document: {chapter_json['status']}] "
        f":violet-badge[:material/menu_book: {chapter_json['type']}] "
        f":violet-badge[:material/kid_star: Rating {chapter_json['rating']}] "
        f":violet-badge[:material/bookmark: Chapter {chapter_json['chapters_amount']}]"
    )

    chapter_read_cols = st.columns(spec=[0.3, 0.3, 0.4], gap="small", vertical_alignment="bottom")

    # Chapter Progress Input
    with chapter_read_cols[0]:
        input_chapter_value = stsi.specialized_text_input(
            label="Chapter read",
            suffix=str(chapter_json["chapters_amount"]),
            value=str(chapter_json["chapter_read"]),
        )
        try:
            val = int(input_chapter_value)
            max_chapters = int(chapter_json["chapters_amount"])
            if val > max_chapters:
                st.toast(":red[Input cannot be larger than total chapters]", icon=":material/error:")
            elif val < 0:
                st.toast(":red[Input cannot be less than zero]", icon=":material/error:")
            elif val != int(chapter_json["chapter_read"]):
                change_chapter_read(title=st.session_state.selected_title, chapter_read=val)
        except ValueError:
            st.toast(":red[Please enter a valid integer]", icon=":material/error:")

    # Download All Button
    chapter_to_download = [url for url in chapter_json.get("chapters_url", []) if url not in chapter_json.get("chapter_downloaded", [])]

    if chapter_to_download:
        if chapter_read_cols[2].button("Download All", key="download_all", icon=":material/deployed_code_update:", width="stretch", disabled=st.session_state.downloading_all):
            st.session_state.downloading_all = True
            with st.status(f"Downloading 0/{len(chapter_to_download)} chapters...") as status:
                for index, chapter_url in enumerate(chapter_to_download):
                    current_chap_num = chapter_url.split("/")[-1]
                    st.write(f"Downloading Chapter {current_chap_num}...")
                    download_chapter(
                        title=st.session_state.selected_title,
                        chapter_key=current_chap_num,
                        chapter_url=chapter_url,
                        website_type=chapter_json["website"]
                    )
                    status.update(label=f"Downloaded {index + 1}/{len(chapter_to_download)}...")
                status.update(label="All downloads complete!", state="complete", expanded=False)
            st.session_state.downloading_all = False
            st.rerun()
    else:
        chapter_read_cols[2].button("Download All", key="download_all", icon=":material/deployed_code_update:", width="stretch", disabled=True, help="All chapters downloaded!")

    # Chapter List Container
    with st.container(height=350, border=True):
        for chapter_url in chapter_json.get("chapters_url", []):
            col_in = st.columns(spec=[0.3, 0.3, 0.4], gap="small", vertical_alignment="center")
            current_chapter = chapter_url.split("/")[-1]

            col_in[0].write(f"**Chapter {current_chapter}**")

            if chapter_url in chapter_json.get("chapter_downloaded", []):
                if col_in[1].button("Read", key=f"read_{current_chapter}", icon=":material/library_books:", width="stretch"):
                    st.session_state.open_chapter = current_chapter
                    st.switch_page(st.session_state.nav_manga["manga_pdf"])

                col_in[2].button("Downloaded", key=f"dl_done_{current_chapter}", icon=":material/download_done:", disabled=True, width="stretch")
            else:
                col_in[1].button("Read", key=f"read_dis_{current_chapter}", icon=":material/library_books:", disabled=True, help="Download first!", width="stretch")
                col_in[2].button(
                    "Download",
                    on_click=download_chapter,
                    args=(st.session_state.selected_title, current_chapter, chapter_url, chapter_json["website"]),
                    key=f"dl_{current_chapter}",
                    icon=":material/download:",
                    width="stretch"
                )



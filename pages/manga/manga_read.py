import streamlit as st
import streamlit_extras.specialized_inputs as stsi
from streamlit_extras.eval_javascript import *
from utilities.util_manga import (change_chapter_read, download_chapter, refresh_library)
from utilities.util_persistent import (apply_logo, apply_footer)
from utilities.util_network import get_image_cache




if "selected_title" not in st.session_state:
    st.switch_page(st.session_state.manga["library"])

if "downloading_all" not in st.session_state:
    st.session_state.downloading_all = False


chapter_json = st.session_state.manga_cache[st.session_state.selected_title]
st.session_state.open_chapter = False

apply_logo()
st.header("☄️ Manga and Manhwa")
column_subheader = st.columns(spec=[0.92, 0.08], gap="small", vertical_alignment="bottom")
column_subheader[0].subheader(body=st.session_state.selected_title, width="stretch", divider="violet")
column_subheader[1].button(label="", icon=":material/refresh:", on_click=refresh_library, args=(st.session_state.selected_title, ), use_container_width=True)


column_outside = st.columns(spec=[0.35, 0.65], gap="small", border=True)
with column_outside[0]:
    cached_image = get_image_cache(url=chapter_json["image"], crop=True)
    st.image(image=cached_image, width=350)

with column_outside[1]:
    st.write("**Tag Informations**")
    st.markdown(
        f":violet-badge[:material/edit_document: {chapter_json['status']}] :violet-badge[:material/menu_book: {chapter_json['type']}] :violet-badge[:material/kid_star: Rating {chapter_json['rating']}] :violet-badge[:material/bookmark: Chapter {chapter_json['chapters_amount']}]",
        width=400,
    )
        
    chapter_read = st.columns(spec=[0.3, 0.3, 0.4], gap="small", vertical_alignment="bottom")
    with chapter_read[0]:
        input_chapter_value = stsi.specialized_text_input(
            label="Chapter read",
            suffix=chapter_json["chapters_amount"],
            value=chapter_json["chapter_read"],
        )
        try:
            input_chapter_value = int(input_chapter_value)
            if input_chapter_value > chapter_json["chapters_amount"]:
                st.toast(body=":red[The input can't be larger than the chapter amount]", duration="short", icon=":material/error:")
                st.stop()
            if input_chapter_value < 0:
                st.toast(body=":red[The input can't be lower than zero]", duration="short", icon=":material/error:")
                st.stop()
            if int(input_chapter_value) != int(chapter_json["chapter_read"]):
                change_chapter_read(title=st.session_state.selected_title, chapter_read=int(input_chapter_value))           
        except ValueError:
            st.toast(body=":red[The input only accept integers]", duration="short", icon=":material/error:")
    
    chapter_to_download = [url for url in chapter_json["chapters_url"] if url not in chapter_json["chapter_downloaded"]]
    if chapter_to_download != []:
        st.session_state.downloading_all = False
        download_all = chapter_read[2].button(label="Download All", key="download_all", icon=":material/deployed_code_update:", use_container_width=True, disabled=st.session_state.downloading_all)
        if download_all:
            st.session_state.downloading_all = True
            with st.status(f"Downloading chapters 0/{len(chapter_to_download)}!") as status:
                for index, chapter_url in enumerate(chapter_to_download):
                    st.write(f"Chapter {chapter_url.split('/')[-1]}")
                    download_chapter(
                        title=st.session_state.selected_title,
                        chapter_key=chapter_url.split("/")[-1],
                        chapter_url=chapter_url,
                        website_type=chapter_json["website"]
                    )
                    status.update(label=f"Downloading chapters {index+1}/{len(chapter_to_download)}")
                status.update(label="Download complete!", state="complete", expanded=False)
            st.session_state.downloading_all = False
    else:
        download_all = chapter_read[2].button(label="Download All", key="download_all", icon=":material/deployed_code_update:", use_container_width=True, disabled=True, help="All chapters already downloaded!")
        
    with st.container(height=250, border=True):
        for chapter_url in chapter_json["chapters_url"]:
            column_inside = st.columns(spec=[0.3, 0.3, 0.4], gap="small", vertical_alignment="center", width="stretch")
            current_chapter = chapter_url.split("/")[-1]
            
            if "asurascans" in chapter_json["website"]:
                column_inside[0].write(f"**Chapter {current_chapter}**")
                        
            if chapter_url in chapter_json["chapter_downloaded"]:
                read_button = column_inside[1].button(
                    label="Read",
                    key=f"read_{current_chapter}",
                    icon=":material/library_books:",
                    use_container_width=True
                )
                if read_button:
                    st.session_state.open_chapter = current_chapter
                    st.switch_page(st.session_state.manga["pdf"])
                    
                column_inside[2].button(
                    label="Downloaded",
                    key=f"downloaded_{current_chapter}",
                    icon=":material/download_done:",
                    disabled=True,
                    use_container_width=True
                )
            else:
                column_inside[1].button(
                    label="Read",
                    key=f"read_{current_chapter}",
                    icon=":material/library_books:",
                    disabled=True,
                    help="Download the chapter first!", 
                    use_container_width=True
                )
                column_inside[2].button(
                    label="Download",
                    on_click=download_chapter,
                    args=(st.session_state.selected_title, current_chapter, chapter_url, chapter_json["website"]),
                    key=f"download_{current_chapter}",
                    icon=":material/download:",
                    use_container_width=True
                )


apply_footer()
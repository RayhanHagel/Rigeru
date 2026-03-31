import streamlit as st
from utilities.util_manga import download_chapter, change_chapter_read, refresh_library, change_chapter_state
import streamlit_extras.specialized_inputs as stsi
from utilities.util_persistent import apply_logo




if "selected_title" not in st.session_state:
    st.switch_page(st.session_state.manga["library"])

if "downloading_all" not in st.session_state:
    st.session_state.downloading_all = False


title = st.session_state.cache_data[st.session_state.selected_title]


apply_logo()
st.header("☄️ Manga and Manhwa")
column_subheader = st.columns(spec=[0.92, 0.08], gap="small", vertical_alignment="bottom")
column_subheader[0].subheader(body=st.session_state.selected_title, width="stretch", divider="violet")
column_subheader[1].button(label="", icon=":material/refresh:", on_click=refresh_library, args=(st.session_state.cache_data, st.session_state.selected_title), use_container_width=True)


column_outside = st.columns(spec=[0.35, 0.65], gap="small", border=True)
with column_outside[0]:
    st.image(image=title["image"], width=350)

with column_outside[1]:
    st.write("**Tag Informations**")
    st.markdown(
        f":violet-badge[:material/edit_document: {title['status']}] :violet-badge[:material/menu_book: {title['type']}] :violet-badge[:material/kid_star: Rating {title['rating']}] :violet-badge[:material/bookmark: Chapter {title['chapters_amount']}]",
        width=400,
    )
        
    chapter_read = st.columns(spec=[0.3, 0.3, 0.4], gap="small", vertical_alignment="bottom")
    with chapter_read[0]:
        input_chapter_value = stsi.specialized_text_input(
            label="Chapter read",
            suffix=title["chapters_amount"],
            value=title["chapter_read"],
        )
        try:
            input_chapter_value = int(input_chapter_value)
            if input_chapter_value > title["chapters_amount"]:
                st.toast(body=":red[The input can't be larger than the chapter amount]", duration="short", icon=":material/error:")
                st.stop()
            if input_chapter_value < 0:
                st.toast(body=":red[The input can't be lower than zero]", duration="short", icon=":material/error:")
                st.stop()
            if int(input_chapter_value) != int(title["chapter_read"]):
                change_chapter_read(title=st.session_state.selected_title, chapter_read=int(input_chapter_value))           
        except ValueError:
            st.toast(body=":red[The input only accept integers]", duration="short", icon=":material/error:")
    
    chapter_to_download = list(set(title["chapters_url"]) - set(title["chapter_downloaded"]))
    if chapter_to_download != []:
        download_all = chapter_read[2].button(label="Download All", key="download_all", icon=":material/deployed_code_update:", use_container_width=True, disabled=st.session_state.downloading_all)
        if download_all:
            st.session_state.downloading_all = True
            chapter_to_download = list(set(title["chapters_url"]) - set(title["chapter_downloaded"]))
            with st.status(f"Downloading chapters 0/{len(chapter_to_download)}!") as status:
                for index, chapter_url in enumerate(chapter_to_download):
                    st.write(f"Chapter {chapter_url.split('/')[-1]}")
                    download_chapter(
                        title=st.session_state.selected_title,
                        chapter_key=chapter_url.split("/")[-1],
                        chapter_url=chapter_url,
                        website_type=title["website"]
                    )
                    status.update(label=f"Downloading chapters {index+1}/{len(chapter_to_download)}")
                status.update(label="Download complete!", state="complete", expanded=False)
            st.session_state.downloading_all = False
    else:
        download_all = chapter_read[2].button(label="Download All", key="download_all", icon=":material/deployed_code_update:", use_container_width=True, disabled=True, help="All chapters already downloaded!")
        
    with st.container(height=250, border=True):
        for chapter_url in title["chapters_url"]:
            column_inside = st.columns(spec=[0.3, 0.3, 0.4], gap="small", vertical_alignment="center", width="stretch")
            current_chapter = chapter_url.split("/")[-1]
            
            if "asurascans" in title["website"]:
                column_inside[0].write(f"**Chapter {current_chapter}**")
                        
            if chapter_url in title["chapter_downloaded"]:
                read_button = column_inside[1].button(
                    label="Read",
                    on_click=change_chapter_state,
                    args=(current_chapter),
                    key=f"read_{current_chapter}",
                    icon=":material/library_books:",
                    use_container_width=True
                )
                if read_button:
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
                    args=(st.session_state.selected_title, current_chapter, chapter_url, title["website"]),
                    key=f"download_{current_chapter}",
                    icon=":material/download:",
                    use_container_width=True
                )

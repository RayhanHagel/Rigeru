import streamlit as st
from streamlit_searchbox import st_searchbox
from utilities.util_manga import (save_config, search_titles, asura_get_chapter)
from utilities.util_persistent import (apply_logo, apply_footer)
from utilities.util_network import get_image_cache




if "search_lookup" not in st.session_state:
    st.session_state.search_lookup = {}

apply_logo()
st.header("☄️ Manga and Manhwa")
st.subheader("Select Source")
website_text = "Choosing multiple sources could lead to longer search result."
website_options = {
    "🌑 AsuraScans": "asurascans.com/",
    "😺 MangaDex": "mangadex.org/"
}
selected_website_options = st.pills(website_text, website_options.keys(), selection_mode="multi")


if selected_website_options:
    st.subheader("Search Title")
    chapter_title = st_searchbox(
        search_function=lambda search_term: search_titles(
            websites=selected_website_options, 
            title=search_term
        ),
        placeholder="Type here...",
        key="file_search",
        debounce=300
    )


    if chapter_title:
        chapter_url = st.session_state.search_lookup.get(chapter_title)
        chapter_title = chapter_title[chapter_title.find(" ")+1:]
        website = [value for _, value in website_options.items() if value in str(chapter_url)][0]
        
        if website == "asurascans.com/":
            chapter_json = asura_get_chapter(chapter_url=chapter_url, website=website)    
        elif website == "mangadex.org/":
            ...
        
        if chapter_json is None:
            st.toast(":red[Failed to get information on {chapter_title}]", duration="infinite", icon=":material/apps_outage:")
        else:
            chapter_json["chapter_read"] = 0
            image = get_image_cache(url=chapter_json["image"], crop=True)
            st.image(image=chapter_json["image"] if image is None else image, width=400)
            st.markdown(
                f":violet-badge[:material/edit_document: {chapter_json['status']}] :violet-badge[:material/menu_book: {chapter_json['type']}] :violet-badge[:material/kid_star: Rating {chapter_json['rating']}] :violet-badge[:material/bookmark: Chapter {chapter_json['chapters_amount']}]",
                width=400,
                text_alignment="center"
            )

            button1, button2 = st.columns(spec=2, gap="small", width=400)
            button1.link_button(label="Go to page", url=chapter_url, icon=":material/open_in_new:", use_container_width=True)
            if button2.button(label="Add to Library", icon=":material/bookmark_add:", on_click=save_config, args=(chapter_title, chapter_json), use_container_width=True):
                st.toast(body=f":green[Successfully saved to library!]", duration="short", icon=":material/bookmark_add:")


apply_footer()
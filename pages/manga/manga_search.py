from urllib.parse import urljoin
import streamlit as st
from bs4 import BeautifulSoup
from streamlit_searchbox import st_searchbox
from utilities.util_manga import save_config, search_titles
from utilities.util_network import better_get
from utilities.util_persistent import apply_logo




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
    result_select = st_searchbox(
        search_function=lambda search_term: search_titles(
            websites=selected_website_options, 
            title=search_term
        ),
        placeholder="Type here...",
        key="file_search",
        debounce=300
    )


    if result_select:
        title_url = st.session_state.search_lookup.get(result_select)
        website_chosen = [value for key, value in website_options.items() if value in str(title_url)][0]

        if title_url:
            title_url_response = BeautifulSoup(better_get(title_url).text, "html.parser")
            
            title_chapters_unclean = title_url_response.find("div", class_="divide-y divide-white/5").find_all("a", href=True)
            title_chapters_cleaned = []
            for chapter in title_chapters_unclean[::-1]:
                title_chapters_cleaned.append(urljoin(f"https://{website_chosen}", chapter["href"]))
                
            title_status = title_url_response.find("span", class_="text-base font-bold text-[#A78BFA] capitalize").text.strip().capitalize()
            title_type = title_url_response.find("span", class_="text-base font-bold text-[#913FE2] uppercase").text.strip().capitalize()
            title_rating = title_url_response.find("span", class_="text-xl font-bold bg-gradient-to-r from-[#FFDA6E] to-[#FFC414] bg-clip-text text-transparent").text.strip()
            title_chapter = title_url_response.find("span", class_="text-xl font-bold bg-gradient-to-b from-[#48C855] to-[#C6FFAB] bg-clip-text text-transparent").text.strip()
            title_image = title_url_response.find("img", id="cover-viewer-img")["data-full-src"]
            
            json_to_save = {
                "main_url": title_url,
                "chapters_amount": int(title_chapter),
                "status": title_status,
                "type": title_type,
                "rating": float(title_rating),
                "website": website_chosen,
                "image": title_image,
                "chapter_read": 0,
                "chapter_downloaded": [],
                "chapters_url": title_chapters_cleaned,
            }
            
            st.image(image=title_image, width=400)
            st.markdown(
                f":violet-badge[:material/edit_document: {title_status}] :violet-badge[:material/menu_book: {title_type}] :violet-badge[:material/kid_star: Rating {title_rating}] :violet-badge[:material/bookmark: Chapter {title_chapter}]",
                width=400,
                text_alignment="center"
            )
                        
            button1, button2 = st.columns(spec=2, gap="small", width=400)
            button1.link_button(label="Go to page", url=title_url, icon=":material/open_in_new:", use_container_width=True)
            if button2.button(label="Add to Library", icon=":material/bookmark_add:", on_click=save_config, args=(result_select[result_select.find(" ")+1:], json_to_save), use_container_width=True):
                st.toast(body=f":green[Successfully saved to library!]", duration="short", icon=":material/bookmark_add:")
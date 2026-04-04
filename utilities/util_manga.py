import json
import os
import shutil
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin
import streamlit as st
from bs4 import BeautifulSoup
from PIL import Image
from utilities.util_network import better_get




def save_config(key:str=None, value:str=None, replace_data:bool=False):
    config_path = "./cache/reading_library.json"    
    if not replace_data and key is not None and value is not None:
        if key in st.session_state.manga_cache:
            if isinstance(st.session_state.manga_cache[key], dict) and isinstance(value, dict):
                st.session_state.manga_cache[key].update(value) 
            else:
                st.session_state.manga_cache[key] = value
        else:
            st.session_state.manga_cache[key] = value

        with open(config_path, "w") as f:
            json.dump(st.session_state.manga_cache, f, indent=4)
    
    else:
        with open(config_path, "w") as f:
            json.dump(st.session_state.manga_cache, f, indent=4)




def refresh_library(title:str=None) -> None:
    if title is None:
        for chapter_title, value in st.session_state.manga_cache.items():
            chapter_json = None
            if value["website"] == "asurascans.com/":
                chapter_json = asura_get_chapter(chapter_url=value["main_url"], website=value["website"]
                )
            elif value["website"] == "mangadex.org/":
                ...
            
            if chapter_json is None:
                st.toast(body=f":red[Failed to refresh library for {chapter_title}]", duration="infinite", icon=":material/apps_outage:")
            else:
                save_config(key=chapter_title, value=chapter_json)
                st.toast(body=f":blue[Refreshed library for **{chapter_title}**!]", duration="short", icon=":material/cached:")
    else:
        if st.session_state.manga_cache[title]["website"] == "asurascans.com/":
            chapter_json = asura_get_chapter(
                chapter_url=st.session_state.manga_cache[title]["main_url"],
                website=st.session_state.manga_cache[title]["website"]
            )
        elif st.session_state.manga_cache[title]["website"] == "mangadex.org/":
            ...
        if chapter_json is None:
            st.toast(body=f":red[Failed to refresh library for {title}]", duration="infinite", icon=":material/apps_outage:")
        else:
            save_config(key=title, value=chapter_json)
            st.toast(body=f":blue[Refreshed library for **{title}**!]", duration="short", icon=":material/cached:")




def asura_get_chapter(chapter_url:str, website:str) -> dict:
    response = better_get(chapter_url)
    if response is None:
        return None
    
    title_url_response = BeautifulSoup(response.content, "lxml")
    
    try:
        title_chapters_unclean = title_url_response.find("div", class_="divide-y divide-white/5").find_all("a", href=True)
        title_chapters_cleaned = []
        for chapter in title_chapters_unclean[::-1]:
            title_chapters_cleaned.append(urljoin(f"https://{website}", chapter['href']))
            
        title_status = title_url_response.find("span", class_="text-base font-bold text-[#A78BFA] capitalize").text.strip().capitalize()
        title_type = title_url_response.find("span", class_="text-base font-bold text-[#913FE2] uppercase").text.strip().capitalize()
        title_rating = title_url_response.find("span", class_="text-xl font-bold bg-gradient-to-r from-[#FFDA6E] to-[#FFC414] bg-clip-text text-transparent").text.strip()
        title_chapter = title_url_response.find("span", class_="text-xl font-bold bg-gradient-to-b from-[#48C855] to-[#C6FFAB] bg-clip-text text-transparent").text.strip()
        title_image = title_url_response.find("img", id="cover-viewer-img")["data-full-src"]
    except (AttributeError, IndexError, TypeError):
        return None
    
    chapter_json = {
        "main_url": chapter_url,
        "chapters_amount": int(title_chapter),
        "status": title_status,
        "type": title_type,
        "rating": float(title_rating),
        "website": website,
        "image": title_image,
        "chapter_downloaded": [],
        "chapters_url": title_chapters_cleaned,
    }
    return chapter_json




def search_titles(websites:list, title:str) -> list:
    search_results = []
    combined_results = {}
    
    if len(title) < 4:
        return []
    
    for website in websites:
        if website == "🌑 AsuraScans":
            search_response = search_titles_asura(title)
        elif website == "😺 MangaDex":
            search_response = search_titles_mangadex(title)
        if search_response is not None:
            search_results.extend(search_response.keys())
            combined_results.update(search_response)
    
    if search_results == [] or combined_results == {}:
        st.session_state.search_lookup = {}
        return []
    
    st.session_state.search_lookup = combined_results
    return search_results




def search_titles_asura(title:str) -> dict:
    response = better_get(f"https://api.asurascans.com/api/search?q={title}")
    if response is None:
        return None
    
    response_json = response.json()["data"]
    if response_json is None:
        return None
    
    search_result_clean = {f"🌑 {item['title']}" : f"https://asurascans.com/comics/{item['slug']}" for item in response_json}
    if len(search_result_clean) == 0:
        return None
    else:
        return search_result_clean




def search_titles_mangadex(title:str) -> dict:
    return None




def read_cache() -> dict:
    path = "./cache/reading_library.json"
    
    if os.path.exists(path):
        with open(path, "r") as file:
            data = json.load(file)
    else:
        with open(path, "w") as file:
            json.dump({}, file, indent=4)
        data = {}

    return data




def download_chapter(title:str, chapter_key:str, chapter_url:str, website_type:str) -> None:
    title_path = f"./cache/library/{title}"
    chapter_path = f"{title_path}/Chapter {chapter_key}"
    os.makedirs(chapter_path, exist_ok=True)
    
    images_url, images_path = [], []
    
    if website_type == "asurascans.com/":
        url, path = get_images_asura(chapter_url, chapter_path)
        if url is None or path is None:
            st.toast(body=f":red[Failed to fetch images for **Chapter {chapter_key}**]", duration="infinite", icon=":material/file_download_off:")
            shutil.rmtree(chapter_path, ignore_errors=True)
            return None
        images_url.extend(url)
        images_path.extend(path)
    
    elif website_type == "mangadex.org/":
        ...
    
    with ThreadPoolExecutor() as executor:
        executor.map(threaded_download, images_url, images_path)

    images_combine = []
    for image in images_path:
        try:
            images_combine.append(Image.open(image))
        except Exception as e:
            st.toast(body=f":red[Failed to download **Chapter {chapter_key}**]", duration="infinite", icon=":material/file_download_off:")
            shutil.rmtree(chapter_path, ignore_errors=True)
            return None
    
    pdf_path = f"{title_path}/Chapter {chapter_key.zfill(2)}.pdf"
    if not images_combine:
        st.toast(body=f":red[No images found for **Chapter {chapter_key}**]", icon=":material/no_photography:")
        shutil.rmtree(chapter_path, ignore_errors=True)
        return None
    
    images_combine[0].save(pdf_path, "PDF", resolution=100, save_all=True, append_images=images_combine[1:])
    st.toast(body=f":green[Done downloading **Chapter {chapter_key}**]", duration="short", icon=":material/download_done:")
    
    try:
        shutil.rmtree(chapter_path)
    except OSError as e:
        print(f"[Erorr] Failed to remove folder {title}/{chapter_key} - {e}")
    st.session_state.manga_cache[title]["chapter_downloaded"].append(chapter_url)
    save_config(replace_data=True)




def get_images_asura(chapter_url:str, chapter_path:str) -> tuple[list[str], list[str]]:
    response = better_get(chapter_url)
    if response is None:
        return None, None
    chapter_html = BeautifulSoup(response.content, "lxml")
    chapter_body = chapter_html.find("div", class_="max-w-full md:max-w-[720px] mx-auto overflow-hidden flex flex-col leading-[0]")
    
    chapter_images = chapter_body.find_all("img")    
    chapter_images_format = chapter_images[0]["src"].replace("/001.webp", "")
    
    raw_url = chapter_body.find_all("div", class_="relative w-full")
    add_ones = True if int(raw_url[0]["data-page"]) == 0 else False
    cleaned_url = [f"{chapter_images_format}/{str((int(x['data-page'])+1) if add_ones else x['data-page']).zfill(3)}.webp" for x in raw_url]
    cleaned_path = [f"{chapter_path}/{str((int(x['data-page'])+1) if add_ones else x['data-page']).zfill(3)}.png" for x in raw_url]
    
    return cleaned_url, cleaned_path




def threaded_download(url:str, image_path:str) -> None:
    image_data = better_get(url)
    if image_data is None:
        print(url)
    else:
        with open(image_path, "wb") as handler:
            handler.write(image_data.content)




def change_chapter_read(title:str, chapter_read:int) -> None:
    st.session_state.manga_cache[title]["chapter_read"] = chapter_read
    save_config(replace_data=True)
    st.toast(body=":green[Done saving **Chapter Read**]", duration="short", icon=":material/save_as:")




def sync_and_save(new_layout):
    sorted_layout = sorted(new_layout, key=lambda item: (item['y'], item['x']))
    new_order_indices = [int(item['i']) for item in sorted_layout]
    items = list(st.session_state.temp_manga_cache.items())
    st.session_state.manga_cache = {items[i][0]: items[i][1] for i in new_order_indices}
    save_config(replace_data=True)
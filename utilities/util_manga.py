import json
import os
import shutil
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin
import streamlit as st
from bs4 import BeautifulSoup
from PIL import Image
from utilities.util_network import better_get




def save_config(key:str=None, value:str=None, replace_data:dict=None, reread_cache:bool=True):
    config_path = "./cache/reading_library.json"    
    if replace_data == None:
        data = st.session_state.manga_cache
        if key in data:
            if isinstance(data[key], dict) and isinstance(value, dict):
                data[key].update(value) 
            else:
                data[key] = value
        else:
            data[key] = value

        with open(config_path, "w") as f:
            json.dump(data, f, indent=4)
    
    else:
        with open(config_path, "w") as f:
            json.dump(replace_data, f, indent=4)
    
    if reread_cache:
        st.session_state.manga_cache = read_cache()




def refresh_library(data:list, title:str=None) -> None:
    if title == None:
        for key, value in data.items():
            if data[key]["website"] == "asurascans.com/":
                refresh_asura(key, value)
            elif data[key]["website"] == "mangadex.org/":
                ...
            
    else:
        if data[title]["website"] == "asurascans.com/":
            refresh_asura(title, data[title])
        elif data[title]["website"] == "mangadex.org/":
            ...



def refresh_asura(key:str, value:dict) -> None:
    title_url_response = BeautifulSoup(better_get(value["main_url"]).text, "html.parser")
    
    title_chapters_unclean = title_url_response.find("div", class_="divide-y divide-white/5").find_all("a", href=True)
    title_chapters_cleaned = []
    for chapter in title_chapters_unclean[::-1]:
        title_chapters_cleaned.append(urljoin(f"https://{value['website']}", chapter['href']))
        
    title_status = title_url_response.find("span", class_="text-base font-bold text-[#A78BFA] capitalize").text.strip().capitalize()
    title_rating = title_url_response.find("span", class_="text-xl font-bold bg-gradient-to-r from-[#FFDA6E] to-[#FFC414] bg-clip-text text-transparent").text.strip()
    title_chapter = title_url_response.find("span", class_="text-xl font-bold bg-gradient-to-b from-[#48C855] to-[#C6FFAB] bg-clip-text text-transparent").text.strip()
    title_image = title_url_response.find("img", id="cover-viewer-img")["data-full-src"]

    json_to_save = {
        "chapters_amount": int(title_chapter),
        "status": title_status,
        "rating": float(title_rating),
        "image": title_image,
        "chapters_url": title_chapters_cleaned,
    }
    save_config(key, json_to_save)
    st.toast(body=f":blue[Refreshed library for **{key}**!]", duration="short", icon=":material/cached:")



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
        search_results.extend(search_response.keys()) if search_response != {} else None
        combined_results.update(search_response)
    
    st.session_state.search_lookup.update(combined_results)
    return search_results




def search_titles_asura(title:str) -> dict:
    try:
        asura_search_url = f"https://api.asurascans.com/api/search?q={title}"
        search_result_unclean = better_get(asura_search_url).json()["data"]
        search_result_clean = {f"🌑 {item['title']}" : f"https://asurascans.com/comics/{item['slug']}" for item in search_result_unclean}
        if len(search_result_clean) == 0:
            raise Exception()
        else:
            return search_result_clean
    except:
        print("[Error] Result are none, please try with another title")
        return {}




def search_titles_mangadex(title:str) -> dict:
    ...




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
        images_url.extend(url)
        images_path.extend(path)
    
    if website_type == "mangadex.org/":
        ...
    
    with ThreadPoolExecutor() as executor:
        executor.map(threaded_download, images_url, images_path)

    images_combine = []
    for image in images_path:
        try:
            images_combine.append(Image.open(image))
        except Exception as e:
            print(f"[Error] {e} {image}")
            st.toast(body=f":red[Failed to download **Chapter {chapter_key}**]", duration="infinite", icon=":material/file_download_off:")
            return None
    
    pdf_path = f"{title_path}/Chapter {chapter_key.zfill(2)}.pdf"
    images_combine[0].save(pdf_path, "PDF", resolution=100, save_all=True, append_images=images_combine[1:])
    st.toast(body=f":green[Done downloading **Chapter {chapter_key}**]", duration="short", icon=":material/download_done:")
    
    try:
        shutil.rmtree(chapter_path)
    except OSError as e:
        print(f"[Erorr] Failed to remove folder {title}/{chapter_key} - {e}")
    st.session_state.manga_cache[title]["chapter_downloaded"].append(chapter_url)[title]["chapter_downloaded"].append(chapter_url)
    save_config(title, st.session_state.manga_cache[title]["chapter_downloaded"].append(chapter_url)[title], reread_cache=False)




def get_images_asura(chapter_url:str, chapter_path:str) -> tuple[list[str], list[str]]:
    chapter_html = BeautifulSoup(better_get(chapter_url).text, "html.parser")
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
    if image_data == None:
        print(url)
    else:
        with open(image_path, "wb") as handler:
            handler.write(image_data.content)




def change_chapter_read(title:str, chapter_read:int) -> None:
    st.session_state.manga_cache[title]["chapter_read"] = chapter_read
    save_config(title, st.session_state.manga_cache[title], reread_cache=False)
    st.toast(body=":green[Done saving **Chapter Read**]", duration="short", icon=":material/save_as:")




def change_chapter_state(current_chapter:str):
    st.session_state.open_chapter = current_chapter




@st.cache_data(persist="disk", show_spinner=True)
def get_cached_image(url:str):
    response = better_get(url)
    return response.content




def sync_and_save(new_layout):
    sorted_layout = sorted(new_layout, key=lambda item: (item['y'], item['x']))
    new_order_indices = [int(item['i']) for item in sorted_layout]
    ordered_data = {list(st.session_state.temp_manga_cache.items())[i][0]: list(st.session_state.temp_manga_cache.items())[i][1] for i in new_order_indices}
    save_config(replace_data=ordered_data)
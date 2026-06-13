import json
import os
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import streamlit as st
from bs4 import BeautifulSoup
from PIL import Image
from utilities.util_network import better_get


def save_config(key: str = None, value: dict = None, replace_data: bool = False):
    config_path = "./cache/reading_library.json"
    os.makedirs(os.path.dirname(config_path), exist_ok=True)

    if not replace_data and key is not None and value is not None:
        if key in st.session_state.get('manga_cache', {}):
            if isinstance(st.session_state.manga_cache[key], dict) and isinstance(value, dict):
                st.session_state.manga_cache[key].update(value)
            else:
                st.session_state.manga_cache[key] = value
        else:
            st.session_state.manga_cache[key] = value

    with open(config_path, "w") as f:
        json.dump(st.session_state.get('manga_cache', {}), f, indent=4)


def refresh_library(title: str = None) -> None:
    cache = st.session_state.get('manga_cache', {})
    if title is None:
        for chapter_title, value in cache.items():
            chapter_json = None
            if value.get("website") == "asurascans.com/":
                chapter_json = asura_get_chapter(chapter_url=value["main_url"], website=value["website"])

            if chapter_json is None:
                st.toast(body=f":red[Failed to refresh library for {chapter_title}]", icon="⚠️")
            else:
                save_config(key=chapter_title, value=chapter_json)
                st.toast(body=f":blue[Refreshed library for **{chapter_title}**!]", icon="🔄")
    else:
        if cache.get(title, {}).get("website") == "asurascans.com/":
            chapter_json = asura_get_chapter(
                chapter_url=cache[title]["main_url"],
                website=cache[title]["website"]
            )
            if chapter_json is None:
                st.toast(body=f":red[Failed to refresh library for {title}]", icon="⚠️")
            else:
                save_config(key=title, value=chapter_json)
                st.toast(body=f":blue[Refreshed library for **{title}**!]", icon="🔄")


def asura_get_chapter(chapter_url: str, website: str) -> dict | None:
    response = better_get(chapter_url, timeout=10)
    if response is None:
        return None

    title_url_response = BeautifulSoup(response.content, "lxml")

    try:
        title_chapters_unclean = title_url_response.find("div", class_="divide-y divide-white/5").find_all("a", href=True)
        title_chapters_cleaned = [urljoin(f"https://{website}", chapter['href']) for chapter in title_chapters_unclean[::-1]]

        title_status = title_url_response.find("span", class_="text-base font-bold text-[#A78BFA] capitalize").text.strip().capitalize()
        title_type = title_url_response.find("span", class_="text-base font-bold text-[#913FE2] uppercase").text.strip().capitalize()
        title_rating = title_url_response.find("span", class_="text-xl font-bold bg-gradient-to-r from-[#FFDA6E] to-[#FFC414] bg-clip-text text-transparent").text.strip()
        title_chapter = title_url_response.find("span", class_="text-xl font-bold bg-gradient-to-b from-[#48C855] to-[#C6FFAB] bg-clip-text text-transparent").text.strip()
        title_image = title_url_response.find("img", id="cover-viewer-img")["data-full-src"]

        return {
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
    except Exception:
        return None


def search_titles(websites: list, title: str) -> list:
    search_results = []
    combined_results = {}

    if len(title) < 4:
        return []

    for website in websites:
        if website == "🌑 AsuraScans":
            search_response = search_titles_asura(title)
            if search_response:
                search_results.extend(search_response.keys())
                combined_results.update(search_response)

    if not search_results or not combined_results:
        st.session_state.search_lookup = {}
        return []

    st.session_state.search_lookup = combined_results
    return search_results


def search_titles_asura(title: str) -> dict | None:
    response = better_get(f"https://api.asurascans.com/api/search?q={title}", timeout=8)
    if response is None:
        return None

    try:
        response_json = response.json().get("data", [])
        if not response_json:
            return None

        search_result_clean = {f"🌑 {item['title']}": f"https://asurascans.com/comics/{item['slug']}" for item in response_json}
        return search_result_clean if search_result_clean else None
    except Exception:
        return None


def read_cache() -> dict:
    path = "./cache/reading_library.json"
    if os.path.exists(path):
        try:
            with open(path, "r") as file:
                return json.load(file)
        except Exception:
            pass

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as file:
        json.dump({}, file, indent=4)
    return {}


def _download_single_image(args: tuple) -> bool:
    """Downloads a single image. Designed to be called from a thread pool."""
    url, image_path = args
    image_data = better_get(url, timeout=15)
    if image_data:
        try:
            with open(image_path, "wb") as handler:
                handler.write(image_data.content)
            return True
        except Exception:
            pass
    return False


def change_chapter_read(title: str, chapter_read: int) -> None:
    """Updates the chapter_read value for a given title and persists it."""
    save_config(key=title, value={"chapter_read": chapter_read})


def download_chapter(title: str, chapter_key: str, chapter_url: str, website_type: str) -> bool:
    """
    Downloads all images for a chapter and converts them to a PDF.
    Uses a ThreadPoolExecutor to fetch images concurrently for speed.
    Returns True on success, False on failure.
    """
    if website_type != "asurascans.com/":
        return False

    chapter_dir = os.path.join(".", "cache", "library", title, f"chapter_{chapter_key}_imgs")
    pdf_path = os.path.join(".", "cache", "library", title, f"Chapter {str(chapter_key).zfill(2)}.pdf")
    os.makedirs(chapter_dir, exist_ok=True)

    # 1. Fetch the chapter page to get image URLs
    chapter_page = better_get(chapter_url, timeout=10)
    if chapter_page is None:
        return False

    try:
        soup = BeautifulSoup(chapter_page.content, "lxml")
        image_tags = soup.find_all("img", class_=lambda c: c and "chapter-image" in c)
        if not image_tags:
            # Fallback: grab all large images from a reader div
            reader_div = soup.find("div", id="readerarea")
            if reader_div:
                image_tags = reader_div.find_all("img")
        image_urls = [img.get("src") or img.get("data-src") for img in image_tags if img.get("src") or img.get("data-src")]
    except Exception:
        return False

    if not image_urls:
        return False

    # 2. Download images concurrently
    download_tasks = [
        (url, os.path.join(chapter_dir, f"{str(idx).zfill(4)}.jpg"))
        for idx, url in enumerate(image_urls)
    ]

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(_download_single_image, task): task for task in download_tasks}
        for future in as_completed(futures):
            future.result()  # surface any exceptions silently

    # 3. Convert downloaded images to PDF
    image_files = sorted([
        os.path.join(chapter_dir, f)
        for f in os.listdir(chapter_dir)
        if f.endswith(".jpg")
    ])

    if not image_files:
        return False

    try:
        pil_images = []
        for img_path in image_files:
            try:
                img = Image.open(img_path).convert("RGB")
                pil_images.append(img)
            except Exception:
                continue

        if not pil_images:
            return False

        pil_images[0].save(
            pdf_path, save_all=True, append_images=pil_images[1:]
        )
    except Exception:
        return False
    finally:
        # Clean up temp image directory
        shutil.rmtree(chapter_dir, ignore_errors=True)

    # 4. Record the chapter as downloaded
    cache_entry = st.session_state.get('manga_cache', {}).get(title, {})
    downloaded = cache_entry.get("chapter_downloaded", [])
    if chapter_url not in downloaded:
        downloaded.append(chapter_url)
        save_config(key=title, value={"chapter_downloaded": downloaded})

    return True


def sync_and_save(new_layout: list):
    """
    Called by streamlit-elements onLayoutChange.
    Re-orders manga_cache according to the dragged layout and persists.
    """
    sorted_layout = sorted(new_layout, key=lambda x: x['y'])
    new_order_indices = [int(item['i']) for item in sorted_layout]

    current_cache = st.session_state.get('temp_manga_cache', {})
    keys = list(current_cache.keys())
    reordered = {keys[i]: current_cache[keys[i]] for i in new_order_indices if i < len(keys)}

    st.session_state.temp_manga_cache = reordered
    st.session_state.manga_cache = reordered
    save_config(replace_data=True)

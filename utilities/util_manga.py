import os
import shutil
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import streamlit as st
from bs4 import BeautifulSoup
from PIL import Image

# Import shared utilities
from utilities.util_network import better_get
from utilities.util_json import load_json, save_json
from utilities.util_playwright import get_async_stealth_page, smooth_scroll_to_bottom


def save_config(key: str = None, value: dict = None, replace_data: bool = False):
    config_path = "./cache/reading_library.json"

    if not replace_data and key is not None and value is not None:
        if key in st.session_state.get('manga_cache', {}):
            if isinstance(st.session_state.manga_cache[key], dict) and isinstance(value, dict):
                st.session_state.manga_cache[key].update(value)
            else:
                st.session_state.manga_cache[key] = value
        else:
            st.session_state.manga_cache[key] = value

    save_json(config_path, st.session_state.get('manga_cache', {}))


def refresh_library(title: str = None) -> None:
    cache = st.session_state.get('manga_cache', {})
    if title is None:
        for chapter_title, value in cache.items():
            chapter_json = None
            if value.get("website") == "asurascans.com/":
                chapter_json = asura_get_chapter(chapter_url=value["main_url"], website=value["website"])
            elif value.get("website") == "mangadex.org/":
                chapter_json = mangadex_get_chapter(chapter_url=value["main_url"], website=value["website"])
            
            if chapter_json is None:
                st.toast(body=f":red[Failed to refresh library for {chapter_title}]", icon="⚠️")
            else:
                save_config(key=chapter_title, value=chapter_json)
                st.toast(body=f":blue[Refreshed library for **{chapter_title}**!]", icon="🔄")
    else:
        chapter_json = None
        if cache.get(title, {}).get("website") == "asurascans.com/":
            chapter_json = asura_get_chapter(
                chapter_url=cache[title]["main_url"],
                website=cache[title]["website"]
            )
        elif cache.get(title, {}).get("website") == "mangadex.org/":
            chapter_json = mangadex_get_chapter(chapter_url=cache[title]["main_url"], website=cache[title]["website"])
            
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


def mangadex_get_chapter(chapter_url: str, website: str) -> dict | None:
    """Fetches full manga details and chapter URLs from MangaDex using Tor Proxy."""
    try:
        manga_id = chapter_url.split("/title/")[-1].split("||")[0]
        cover_url = chapter_url.split("||")[-1] if "||" in chapter_url else ""

        # Fetch English chapters sorted in ascending order
        feed_url = f"https://api.mangadex.org/manga/{manga_id}/feed"
        params = {
            "translatedLanguage[]": ["en"],
            "order[chapter]": "asc",
            "limit": 500
        }
        
        # Disabled default headers to prevent 400s and passed a simple, honest User-Agent
        response = better_get(
            feed_url, 
            params=params, 
            headers={"User-Agent": "MangaApp/1.0"},
            timeout=30, 
            use_tor_proxies=True,
            use_default_headers=False
        )
        
        if response is None or response.status_code != 200:
            return None

        chapters_data = response.json().get("data", [])
        
        chapters_url_list = []
        last_chapter_num = 0
        
        for ch in chapters_data:
            ch_num = ch["attributes"]["chapter"]
            if ch_num:
                chapters_url_list.append(f"https://api.mangadex.org/at-home/server/{ch['id']}")
                try:
                    last_chapter_num = max(last_chapter_num, int(float(ch_num)))
                except ValueError:
                    pass

        return {
            "main_url": chapter_url,
            "chapters_amount": last_chapter_num if last_chapter_num > 0 else len(chapters_url_list),
            "status": "Ongoing", 
            "type": "Manga",
            "rating": 8.0,
            "website": website,
            "image": cover_url,
            "chapter_downloaded": [],
            "chapters_url": chapters_url_list,
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
        elif website == "😺 MangaDex":
            search_response = search_titles_mangadex(title)
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


def search_titles_mangadex(title: str) -> dict | None:
    """Searches titles on MangaDex using their official API via Tor Proxy."""
    url = "https://api.mangadex.org/manga"
    params = {
        "title": title,
        "contentRating[]": ["safe", "suggestive", "erotica"],
        "includes[]": ["cover_art"],
        "order[relevance]": "desc",
        "order[followedCount]": "desc"
    }
    
    # Disabled default headers to prevent 400s and passed a simple, honest User-Agent
    response = better_get(
        url, 
        params=params, 
        headers={"User-Agent": "MangaApp/1.0"},
        timeout=30, 
        use_tor_proxies=True,
        use_default_headers=False
    )
    if response is None or response.status_code != 200:
        return None

    try:
        data = response.json().get("data", [])
        results = {}
        for manga in data:
            manga_id = manga["id"]
            
            # Safely extract the title (usually 'en', fallback to whatever is available)
            title_dict = manga.get("attributes", {}).get("title", {})
            manga_title = title_dict.get("en") or next(iter(title_dict.values()), "Unknown Title")
            
            # Extract cover file name from the included relationships
            cover_file = ""
            for rel in manga.get("relationships", []):
                if rel.get("type") == "cover_art" and "attributes" in rel:
                    cover_file = rel["attributes"].get("fileName", "")
                    break
            
            cover_url = f"https://uploads.mangadex.org/covers/{manga_id}/{cover_file}" if cover_file else ""
            results[f"😺 {manga_title}"] = f"https://mangadex.org/title/{manga_id}||{cover_url}"
            
        return results if results else None
    except Exception as e:
        print(f"MangaDex Search Error: {e}")
        return None


def read_cache() -> dict:
    path = "./cache/reading_library.json"
    return load_json(path, default_factory=dict)


def download_single_image(args: tuple) -> bool:
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


async def get_asura_images(url: str) -> list:
    """Uses centralized Playwright utility to scroll, then BeautifulSoup to extract image URLs."""
    try:
        async with get_async_stealth_page() as page:
            await page.route(
                "**/*", 
                lambda route: route.abort() if route.request.resource_type == "image" else route.continue_()
            )
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await smooth_scroll_to_bottom(page, distance=800, delay_ms=200)
            await asyncio.sleep(1.5)
            html_content = await page.content()

        # Parse the HTML with BeautifulSoup
        soup = BeautifulSoup(html_content, "lxml")
        image_urls = []

        # 1. Primary Method: Look for the specific data attribute
        imgs = soup.find_all("img", attrs={"data-page-index": True})

        # 2. Fallback Method: Use the specific container from your CSS path
        if not imgs:
            container = soup.find("div", class_="max-w-full md:max-w-[720px] mx-auto overflow-hidden flex flex-col leading-[0]")
            if container:
                imgs = container.find_all("img")

        # Extract the source URLs
        for img in imgs:
            src = img.get('src') or img.get('data-src')
            if src and src.startswith('http'):
                image_urls.append(src)
        
        return image_urls

    except Exception as e:
        print(f"Scraping Error: {str(e)}")
        return []


def get_mangadex_images(api_url: str) -> list:
    """Fetches high-quality direct page paths using the MangaDex At-Home server API via Tor Proxy."""
    response = better_get(
        api_url, 
        headers={"User-Agent": "MangaApp/1.0"},
        timeout=30, 
        use_tor_proxies=True,
        use_default_headers=False
    )
    
    if response is None or response.status_code != 200:
        return []
    try:
        data = response.json()
        base_url = data.get("baseUrl")
        ch_hash = data.get("chapter", {}).get("hash")
        files = data.get("chapter", {}).get("data", [])
        
        return [f"{base_url}/data/{ch_hash}/{filename}" for filename in files]
    except Exception:
        return []


def download_chapter(title: str, chapter_key: str, chapter_url: str, website_type: str) -> bool:
    """
    Downloads all images for a chapter and converts them to a PDF.
    Uses an Async Playwright browser to force lazy loaded images to appear.
    Returns True on success, False on failure.
    """
    if website_type not in ["asurascans.com/", "mangadex.org/"]:
        return False

    chapter_dir = os.path.join(".", "cache", "library", title, f"chapter_{chapter_key}_imgs")
    pdf_path = os.path.join(".", "cache", "library", title, f"Chapter {str(chapter_key).zfill(2)}.pdf")
    os.makedirs(chapter_dir, exist_ok=True)

    # 1. Fetch the chapter image URLs using headless browser (bypasses lazy loading)
    if website_type == "mangadex.org/":
        image_urls = get_mangadex_images(chapter_url)
    else:
        image_urls = asyncio.run(get_asura_images(chapter_url))
    if not image_urls:
        return False
    
    # 2. Download images concurrently
    download_tasks = [
        (url, os.path.join(chapter_dir, f"{str(idx).zfill(4)}.jpg"))
        for idx, url in enumerate(image_urls)
    ]

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(download_single_image, task): task for task in download_tasks}
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
import os
import shutil
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin
import time

# Import shared utilities
from utilities.util_network import better_get, better_post
from utilities.util_json import load_json, save_json

def refresh_library_standalone(cache: dict) -> tuple[dict, list]:
    """Standalone version of refresh_library that doesn't depend on st.session_state.
    Takes and returns the cache dict directly. Returns (updated_cache, results_log)."""
    results = []
    for chapter_title, value in cache.items():
        chapter_json = None
        try:
            if value.get("website") == "asurascans.com/":
                chapter_json = asura_get_chapter(chapter_url=value["main_url"], website=value["website"])
            elif value.get("website") == "mangadex.org/":
                chapter_json = mangadex_get_chapter(chapter_url=value["main_url"], website=value["website"])
        except Exception as e:
            results.append({"title": chapter_title, "success": False, "error": str(e)})
            continue

        if chapter_json is None:
            results.append({"title": chapter_title, "success": False, "error": "Failed to fetch"})
        else:
            if isinstance(cache[chapter_title], dict) and isinstance(chapter_json, dict):
                cache[chapter_title].update(chapter_json)
            else:
                cache[chapter_title] = chapter_json
            results.append({"title": chapter_title, "success": True})
    return cache, results


def asura_get_chapter(chapter_url: str, website: str) -> dict | None:
    from bs4 import BeautifulSoup
    from utilities.util_network import get_image_cache
    
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
        
        local_image_path = get_image_cache(
            url=title_image, 
            crop=True,
            use_default_headers=True
        )

        return {
            "main_url": chapter_url,
            "chapters_amount": int(title_chapter),
            "status": title_status,
            "type": title_type,
            "rating": float(title_rating),
            "website": website,
            "image": title_image,
            "local_image": local_image_path,
            "chapter_downloaded": [],
            "chapters_url": title_chapters_cleaned,
        }
    except Exception:
        return None


def mangadex_get_chapter(chapter_url: str, website: str) -> dict | None:
    """Fetches full manga details and chapter URLs from MangaDex using Tor Proxy."""
    from utilities.util_network import get_image_cache
    
    try:
        manga_id = chapter_url.split("/title/")[-1].split("||")[0]
        cover_url = chapter_url.split("||")[-1] if "||" in chapter_url else ""

        # Fetch Manga Rating via Statistics API
        stats_url = f"https://api.mangadex.org/statistics/manga/{manga_id}"
        stats_response = better_get(
            stats_url,
            headers={"User-Agent": "MangaApp/1.0"},
            timeout=15,
            use_default_headers=False
        )
        
        rating_val = 0.0
        if stats_response and stats_response.status_code == 200:
            stats_data = stats_response.json().get("statistics", {}).get(manga_id, {})
            rating_info = stats_data.get("rating", {})
            bayesian = rating_info.get("bayesian")
            if bayesian is not None:
                rating_val = float(bayesian)

        # Fetch English chapters sorted in ascending order with strict filters
        feed_url = f"https://api.mangadex.org/manga/{manga_id}/feed"
        params = {
            "translatedLanguage[]": ["en"],
            "order[chapter]": "asc",
            "limit": 500,
            "includeExternalUrl": 0,      
            "includeEmptyPages": 0,       
            "includeFuturePublishAt": 0   
        }
        
        response = better_get(
            feed_url, 
            params=params, 
            headers={"User-Agent": "MangaApp/1.0"},
            timeout=30, 
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
                chapters_url_list.append(f"https://api.mangadex.org/at-home/server/{ch['id']}/chapter-{ch_num}")
                try:
                    last_chapter_num = max(last_chapter_num, int(float(ch_num)))
                except ValueError:
                    pass
        
        local_image_path = None
        if cover_url:
            local_image_path = get_image_cache(
                url=cover_url, 
                crop=True,
                use_default_headers=False,
                headers={"User-Agent": "MangaApp/1.0"}
            )

        return {
            "main_url": chapter_url,
            "chapters_amount": last_chapter_num if last_chapter_num > 0 else len(chapters_url_list),
            "status": "Ongoing", 
            "type": "Manga",
            "rating": round(rating_val, 2),
            "website": website,
            "image": cover_url,
            "local_image": local_image_path,
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

    return search_results

def search_titles_asura(title: str) -> dict | None:
    response = better_get(f"https://api.asurascans.com/api/search?q={title}", timeout=8)
    if response is None:
        return None

    try:
        response_json = response.json().get("data", [])
        if not response_json:
            return None

        search_result_clean = {
            f"🌑 {item['title']}": f"https://asurascans.com/comics/{item['slug']}||{item.get('cover', '')}" 
            for item in response_json
        }
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
    
    response = better_get(
        url, 
        params=params, 
        headers={"User-Agent": "MangaApp/1.0"},
        timeout=30, 
        use_default_headers=False
    )
    if response is None or response.status_code != 200:
        return None

    try:
        data = response.json().get("data", [])
        if not data:
            return None
            
        manga_ids = [manga["id"] for manga in data]
        stats_url = "https://api.mangadex.org/statistics/composite/manga"
        stats_params = {"entityIds[]": manga_ids}
        
        stats_response = better_get(
            stats_url,
            params=stats_params,
            headers={"User-Agent": "MangaApp/1.0"},
            timeout=15,
            use_default_headers=False
        )
        
        stats_data = {}
        if stats_response and stats_response.status_code == 200:
            stats_data = stats_response.json().get("statistics", {})

        results = {}
        for manga in data:
            manga_id = manga["id"]
            
            title_dict = manga.get("attributes", {}).get("title", {})
            manga_title = title_dict.get("en") or next(iter(title_dict.values()), "Unknown Title")
            
            cover_file = ""
            for rel in manga.get("relationships", []):
                if rel.get("type") == "cover_art" and "attributes" in rel:
                    cover_file = rel["attributes"].get("fileName", "")
                    break
            
            cover_url = f"https://uploads.mangadex.org/covers/{manga_id}/{cover_file}.512.jpg" if cover_file else ""
            
            rating_str = ""
            if manga_id in stats_data:
                rating_info = stats_data[manga_id].get("rating", {})
                bayesian = rating_info.get("bayesian")
                if bayesian:
                    rating_str = f" (⭐ {bayesian:.1f})"

            results[f"😺 {manga_title}{rating_str}"] = f"https://mangadex.org/title/{manga_id}||{cover_url}"
            
        return results if results else None
    except Exception as e:
        print(f"MangaDex Search Error: {e}")
        return None

def read_cache() -> dict:
    path = "./cache/reading_library.json"
    return load_json(path, default_factory=dict)

def download_single_image(args: tuple) -> bool:
    url, image_path = args
    
    start_time = time.time()
    success = False
    cached = False
    bytes_downloaded = 0
    
    try:
        response = better_get(url, timeout=15)
        duration = int((time.time() - start_time) * 1000)
        
        if response is not None and response.status_code == 200:
            bytes_downloaded = len(response.content)
            with open(image_path, "wb") as handler:
                handler.write(response.content)
            success = True
            
            x_cache = response.headers.get("X-Cache", "")
            if x_cache.startswith("HIT"):
                cached = True
    except Exception:
        duration = int((time.time() - start_time) * 1000)
        success = False
        
    if "mangadex.network" in url:
        report_payload = {
            "url": url,
            "success": success,
            "cached": cached,
            "bytes": bytes_downloaded,
            "duration": duration
        }
        
        better_post(
            url="https://api.mangadex.network/report",
            json=report_payload,
            timeout=3,
            retries=1,
            use_default_headers=False,
        )

    return success


async def get_asura_images(url: str) -> list:
    """Uses centralized Playwright utility to scroll, then BeautifulSoup to extract image URLs."""
    from bs4 import BeautifulSoup
    from utilities.util_scraper import _run_node_scraper
    
    try:
        payload = {
            "action": "manga_asura",
            "url": url
        }
        res = await asyncio.to_thread(_run_node_scraper, payload)
        
        if not res.get("success"):
            print(f"Scraping Error: {res.get('error')}")
            return []
            
        html_content = res.get("html")

        soup = BeautifulSoup(html_content, "lxml")
        image_urls = []

        imgs = soup.find_all("img", attrs={"data-page-index": True})

        if not imgs:
            container = soup.find("div", class_="max-w-full md:max-w-[720px] mx-auto overflow-hidden flex flex-col leading-[0]")
            if container:
                imgs = container.find_all("img")

        for img in imgs:
            src = img.get('src') or img.get('data-src')
            if src and src.startswith('http'):
                image_urls.append(src)
        
        return image_urls

    except Exception as e:
        print(f"Scraping Error: {str(e)}")
        return []


def get_mangadex_images(api_url: str, use_data_saver: bool = False) -> list:
    if "/chapter-" in api_url:
        api_url = api_url.split("/chapter-")[0]
        
    response = better_get(
        api_url, 
        headers={"User-Agent": "MangaApp/1.0"}, 
        timeout=30, 
        use_default_headers=False
    )
    
    if response is None or response.status_code != 200:
        return []
        
    try:
        data = response.json()
        base_url = data.get("baseUrl")
        ch_hash = data.get("chapter", {}).get("hash")
        
        quality_key = "dataSaver" if use_data_saver else "data"
        url_path = "data-saver" if use_data_saver else "data"
        
        files = data.get("chapter", {}).get(quality_key, [])
        
        return [f"{base_url}/{url_path}/{ch_hash}/{filename}" for filename in files]
    except Exception:
        return []


def download_chapter(title: str, chapter_key: str, chapter_url: str, website_type: str) -> bool:
    from PIL import Image
    
    if website_type not in ["asurascans.com/", "mangadex.org/"]:
        return False

    chapter_dir = os.path.join(".", "cache", "library", title, f"chapter_{chapter_key}_imgs")
    pdf_path = os.path.join(".", "cache", "library", title, f"Chapter {str(chapter_key).zfill(2)}.pdf")
    os.makedirs(chapter_dir, exist_ok=True)

    if website_type == "mangadex.org/":
        image_urls = get_mangadex_images(chapter_url)
    else:
        if os.name == 'nt':
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        image_urls = asyncio.run(get_asura_images(chapter_url))
    if not image_urls:
        return False
    
    download_tasks = [
        (url, os.path.join(chapter_dir, f"{str(idx).zfill(4)}.jpg"))
        for idx, url in enumerate(image_urls)
    ]
    max_threads = min(20, len(download_tasks)) if download_tasks else 1
    with ThreadPoolExecutor(max_workers=max_threads) as executor:
        futures = {executor.submit(download_single_image, task): task for task in download_tasks}
        for future in as_completed(futures):
            future.result()

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
        shutil.rmtree(chapter_dir, ignore_errors=True)

    cache = read_cache()
    cache_entry = cache.get(title, {})
    downloaded = cache_entry.get("chapter_downloaded", [])
    if chapter_url not in downloaded:
        downloaded.append(chapter_url)
        cache_entry["chapter_downloaded"] = downloaded
        cache[title] = cache_entry
        save_json("./cache/reading_library.json", cache)

    return True

def get_read_progress(title: str, total_chapters: int, cache: dict) -> float:
    """Helper for FastAPI endpoints to calculate progress."""
    entry = cache.get(title, {})
    if not entry:
        return 0.0
    latest = float(entry.get("latest_chapter", 0) or 0)
    current = float(entry.get("current_chapter", 0) or 0)
    
    if latest <= 0 or current <= 0:
        return 0.0
        
    return min((current / latest) * 100, 100.0)

def get_manga_library_data() -> dict:
    """Returns the manga library cache data."""
    return read_cache()

def sort_manga_library_data(keys: list[str]) -> dict:
    """Reorders the manga library based on the provided list of keys."""
    cache = read_cache()
    reordered = {k: cache[k] for k in keys if k in cache}
    save_json("./cache/reading_library.json", reordered)
    return reordered

def update_manga_library_progress(title: str, chapter_read: int) -> int:
    """Updates the chapter_read for a given manga title."""
    cache = read_cache()
    if title not in cache:
        raise ValueError(f"Title '{title}' not found in library.")
    
    new_progress = max(0, chapter_read)
    cache[title]["chapter_read"] = new_progress
    save_json("./cache/reading_library.json", cache)
    return new_progress

def delete_manga_from_library_data(title: str) -> None:
    """Deletes a manga from the library cache."""
    cache = read_cache()
    if title in cache:
        del cache[title]
        save_json("./cache/reading_library.json", cache)
    else:
        raise ValueError("Title not found.")
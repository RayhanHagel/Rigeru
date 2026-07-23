import os
import re
import random
import asyncio
from datetime import datetime
from utilities.util_json import load_json, save_json
from utilities.util_scraper import _run_node_scraper

# Global Path Management
TEMP_DIR = os.path.join(".", "cache", "temp")
DB_FILE = os.path.join(".", "cache", "price_tracker", "tracked_prices.json")


def _ensure_paths():
    os.makedirs(os.path.dirname(TEMP_DIR), exist_ok=True)
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)


def load_tracked_items() -> list:
    """Loads tracked items from the local JSON file."""
    _ensure_paths()
    return load_json(DB_FILE, default_factory=list)


def save_tracked_items(items: list):
    """Saves tracked items to the local JSON file."""
    _ensure_paths()
    save_json(DB_FILE, items)


def add_item(name: str, url: str) -> tuple[bool, str]:
    """Adds a new item to the tracking list."""
    items = load_tracked_items()

    tracked_urls = {item['url'] for item in items}
    if url in tracked_urls:
        return False, "This URL is already being tracked."

    items.append({
        "id": str(datetime.now().timestamp()),
        "name": name,
        "url": url,
        "history": []
    })

    save_tracked_items(items)
    return True, f"Successfully added {name}!"


def delete_item(item_id: str):
    items = load_tracked_items()
    items = [i for i in items if i['id'] != item_id]
    save_tracked_items(items)


def _parse_price(price_str: str, domain: str) -> float | None:
    """Helper function to clean and convert price strings to floats."""
    if not price_str:
        return None

    clean_str = price_str.replace('\n', ' ')

    # NEW: Added \s to the regex capture group so it doesn't stop at spaces
    match = re.search(r'[\$£€Rp]\s*([0-9,.\s]+)', clean_str)

    if match:
        # NEW: Added .replace(' ', '') to strip out those internal spaces
        num_str = match.group(1).replace(',', '').replace(' ', '').strip()

        if "Rp" in clean_str or "tokopedia" in domain or "shopee.co.id" in domain:
            num_str = num_str.replace('.', '')
        try:
            return float(num_str)
        except ValueError:
            return None
    return None


def _scrape_item_logic(url: str) -> tuple[bool, dict | str]:
    """Core scraping logic using Node.js Playwright instance."""
    try:
        payload = {
            "action": "price_monitor",
            "url": url
        }
        res = _run_node_scraper(payload)
        
        if not res.get("success"):
            return False, f"Scraping Error: {res.get('error')}"
            
        domain = url.lower()
        price_text = res.get("price_text", "")
        original_price_text = res.get("original_price_text", "")
        discount_text = res.get("discount_text", "")

        # Parse extracted text
        current_price = _parse_price(price_text, domain)

        if current_price is None:
            return False, "Could not locate or parse the current price on the page."

        original_price = _parse_price(original_price_text, domain)

        # Calculate discount
        discount_pct = ""
        if discount_text:
            disc_match = re.search(r'(\d+)%', discount_text)
            if disc_match:
                discount_pct = f"{disc_match.group(1)}%"
        elif original_price and original_price > current_price:
            pct = int(((original_price - current_price) / original_price) * 100)
            discount_pct = f"{pct}%"

        return True, {
            "price": current_price,
            "original_price": original_price,
            "discount": discount_pct
        }

    except Exception as e:
        return False, f"Scraping Error: {str(e)}"


async def _scrape_price_async(url: str) -> tuple[bool, dict | str]:
    """Single item scraper (used if you ever need to scrape a single link dynamically)."""
    return await asyncio.to_thread(_scrape_item_logic, url)


async def _refresh_all_prices_async() -> list:
    """Async generator that processes items using isolated browser contexts."""
    items = load_tracked_items()
    logs = []

    for item in items:
        # Uses thread pool so Node process executes async relative to event loop
        success, result = await asyncio.to_thread(_scrape_item_logic, item['url'])

        if success:
            now = datetime.now()
            current_day = now.strftime("%Y-%m-%d")
            full_date_str = now.strftime("%Y-%m-%d %H:%M")

            new_entry = {
                "date": full_date_str,
                "price": result["price"],
                "original_price": result["original_price"],
                "discount": result["discount"]
            }

            if not item['history']:
                item['history'].append(new_entry)
            else:
                last_saved_day = item['history'][-1]['date'].split(' ')[0]
                if last_saved_day == current_day:
                    item['history'][-1] = new_entry
                else:
                    item['history'].append(new_entry)

            logs.append(f"✅ {item['name']}: Updated to {result['price']}")
        else:
            logs.append(f"❌ {item['name']}: Failed ({result})")

    save_tracked_items(items)
    return logs


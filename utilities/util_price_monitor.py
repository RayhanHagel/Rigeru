import os
import re
import random
import asyncio
from datetime import datetime
from utilities.util_json import load_json, save_json
from utilities.util_playwright import get_async_stealth_page

# Global Path Management
CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")
DB_FILE = os.path.join(CACHE_DIR, "tracked_prices.json")


def _ensure_paths():
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)


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

    if any(item['url'] == url for item in items):
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
    match = re.search(r'[\$£€Rp]\s*([0-9,.]+)', clean_str)

    if match:
        num_str = match.group(1).replace(',', '')
        if "Rp" in clean_str or "tokopedia" in domain or "shopee.co.id" in domain:
            num_str = num_str.replace('.', '')
        try:
            return float(num_str)
        except ValueError:
            return None
    return None


async def _scrape_price_async(url: str) -> tuple[bool, dict | str]:
    """Asynchronous core function utilizing the centralized stealth API."""
    try:
        async with get_async_stealth_page() as page:
            await asyncio.sleep(random.uniform(1.0, 3.0))
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)
            await page.wait_for_timeout(random.randint(3000, 5000))

            domain = url.lower()
            price_text = ""
            original_price_text = ""
            discount_text = ""

            # Selectors based on platform
            if "amazon" in domain:
                sel = await page.query_selector('.a-price .a-offscreen, #priceblock_ourprice')
                if sel:
                    price_text = await sel.inner_text()

                orig_sel = await page.query_selector('.a-text-strike, .a-text-price .a-offscreen')
                if orig_sel:
                    original_price_text = await orig_sel.inner_text()

            elif "ebay" in domain:
                sel = await page.query_selector('.x-price-primary, #prcIsum')
                if sel:
                    price_text = await sel.inner_text()

                orig_sel = await page.query_selector('.ux-textspans--STRIKETHROUGH')
                if orig_sel:
                    original_price_text = await orig_sel.inner_text()

            elif "shopee" in domain:
                sel = await page.query_selector('.pqTWkA, .p1N00a, div:has-text("Rp")')
                if sel:
                    price_text = await sel.inner_text()

                orig_sel = await page.query_selector('div[style*="line-through"]')
                if orig_sel:
                    original_price_text = await orig_sel.inner_text()

            elif "tokopedia" in domain:
                sel = await page.query_selector('[data-testid="lblPDPDetailProductPrice"], .price')
                if sel:
                    price_text = await sel.inner_text()

                orig_sel = await page.query_selector('[data-testid="lblPDPDetailOriginalPrice"]')
                if orig_sel:
                    original_price_text = await orig_sel.inner_text()

                disc_sel = await page.query_selector('[data-testid="lblPDPDetailDiscountPercentage"]')
                if disc_sel:
                    discount_text = await disc_sel.inner_text()

            else:
                price_text = await page.inner_text("body")

            # Parse extracted text
            current_price = _parse_price(price_text, domain)

            if current_price is None:
                return False, "Could not locate or parse the current price on the page."

            original_price = _parse_price(original_price_text, domain)

            # Extract or calculate discount percentage
            discount_pct = ""
            if discount_text:
                disc_match = re.search(r'(\d+)%', discount_text)
                if disc_match:
                    discount_pct = f"{disc_match.group(1)}%"
            elif original_price and original_price > current_price:
                pct = int(
                    ((original_price - current_price) / original_price) * 100)
                discount_pct = f"{pct}%"

            return True, {
                "price": current_price,
                "original_price": original_price,
                "discount": discount_pct
            }

    except Exception as e:
        return False, f"Scraping Error: {str(e)}"


def scrape_price(url: str) -> tuple[bool, dict | str]:
    """Synchronous wrapper so Streamlit's UI thread doesn't break."""
    return asyncio.run(_scrape_price_async(url))


def refresh_all_prices() -> list:
    """Iterates through tracked items and updates their prices (keeps one per day)."""
    items = load_tracked_items()
    logs = []

    for item in items:
        success, result = scrape_price(item['url'])
        if success:
            now = datetime.now()
            # Date for checking (YYYY-MM-DD) and Datetime for saving
            current_day = now.strftime("%Y-%m-%d")
            full_date_str = now.strftime("%Y-%m-%d %H:%M")

            new_entry = {
                "date": full_date_str,
                "price": result["price"],
                "original_price": result["original_price"],
                "discount": result["discount"]
            }

            # Logic: Enforce 1 price point per day
            if not item['history']:
                item['history'].append(new_entry)
            else:
                last_saved_day = item['history'][-1]['date'].split(' ')[0]
                if last_saved_day == current_day:
                    # Overwrite today's previous entry to avoid DB clutter
                    item['history'][-1] = new_entry
                else:
                    item['history'].append(new_entry)

            logs.append(f"✅ {item['name']}: Updated to {result['price']}")
        else:
            logs.append(f"❌ {item['name']}: Failed ({result})")

    save_tracked_items(items)
    return logs
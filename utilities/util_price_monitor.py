import os
import re
import random
import asyncio
from datetime import datetime
from utilities.util_json import load_json, save_json
from utilities.util_playwright import get_async_stealth_browser, DEFAULT_UA

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


async def _scrape_item_logic(page, url: str) -> tuple[bool, dict | str]:
    """Core scraping logic applied to an existing, open Playwright page tab."""
    try:
        # --- STEAM AGE GATE BYPASS ---
        if "steampowered.com" in url.lower():
            try:
                await page.context.add_cookies([
                    {"name": "birthtime", "value": "283993201",
                        "domain": "store.steampowered.com", "path": "/"},
                    {"name": "lastagecheckage", "value": "1-January-1900",
                        "domain": "store.steampowered.com", "path": "/"}
                ])
            except Exception:
                pass

        await asyncio.sleep(random.uniform(1.0, 2.0))

        # --- TIMEOUT & REFRESH LOGIC ---
        try:
            # Setting a 45-second timeout for the initial load
            await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            if "Timeout" in type(e).__name__ or "Timeout" in str(e):
                print(f"Timeout detected for {url}. Refreshing page...")
                await page.reload(wait_until="domcontentloaded", timeout=45000)
            else:
                raise e
        # -------------------------------

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

        elif "steampowered.com" in domain:
            sel = await page.query_selector('.discount_final_price, .game_purchase_price')
            if sel:
                price_text = await sel.inner_text()
            orig_sel = await page.query_selector('.discount_original_price')
            if orig_sel:
                original_price_text = await orig_sel.inner_text()
            disc_sel = await page.query_selector('.discount_pct')
            if disc_sel:
                discount_text = await disc_sel.inner_text()

        else:
            price_text = await page.inner_text("body")

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
    async with get_async_stealth_browser(headless=False) as context:
        page = await context.new_page()
        try:
            return await _scrape_item_logic(page, url)
        finally:
            await page.close()


def scrape_price(url: str) -> tuple[bool, dict | str]:
    """Synchronous wrapper."""
    return asyncio.run(_scrape_price_async(url))


async def _refresh_all_prices_async() -> list:
    """Async generator that processes items using isolated browser contexts."""
    items = load_tracked_items()
    logs = []

    # Open the browser engine ONCE
    async with get_async_stealth_browser() as browser:
        
        for item in items:
            # 🔥 CRITICAL FIX: Create a completely isolated "Incognito" context for every item
            context = await browser.new_context(
                user_agent=DEFAULT_UA,
                viewport={"width": 1920, "height": 1080},
                device_scale_factor=1,
                has_touch=False,
                ignore_https_errors=True
            )
            
            # Apply stealth override to the new context
            await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # Open a page inside this clean, isolated environment
            page = await context.new_page()
            
            success, result = await _scrape_item_logic(page, item['url'])

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

            # 🔥 DESTROY THE CONTEXT: This completely wipes Tokopedia's tracking cookies and local storage 
            # so the next item starts with a 100% clean slate, preventing the blank page ban!
            await context.close()

    save_tracked_items(items)
    return logs


def refresh_all_prices() -> list:
    """Synchronous trigger used by the Streamlit background thread."""
    return asyncio.run(_refresh_all_prices_async())

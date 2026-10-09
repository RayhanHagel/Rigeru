import os
import re
import random
import asyncio
from datetime import datetime
from utilities.core.util_store import get_data, set_data
from utilities.web.util_scraper import _run_node_scraper

def load_tracked_items() -> list[dict]:
    """Loads tracked items from the store.

    Returns:
        list[dict]: List of tracked item dictionaries.
    """
    return get_data("tracked_prices") or []

def save_tracked_items(items: list[dict]) -> None:
    """Saves tracked items to the store.

    Args:
        items (list[dict]): List of item dictionaries to persist.
    """
    set_data("tracked_prices", items)


def add_item(name: str, url: str) -> tuple[bool, str]:
    """Adds a new item to the tracking list.

    Args:
        name (str): Item display name.
        url (str): Web URL for the product page.

    Returns:
        tuple[bool, str]: Success flag and confirmation message.
    """
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


def delete_item(item_id: str) -> None:
    """Deletes a tracked item by its ID.

    Args:
        item_id (str): Unique identifier of the tracked item.
    """
    items = load_tracked_items()
    items = [i for i in items if i['id'] != item_id]
    save_tracked_items(items)


def _parse_price(price_str: str, domain: str) -> float | None:
    """Helper function to clean and convert price strings to floats.

    Args:
        price_str (str): Raw price text from page scraping.
        domain (str): Domain or URL string used for currency-specific heuristic matching.

    Returns:
        float | None: Parsed numeric price value or None if unparseable.
    """
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
    """Core scraping logic using Node.js Playwright instance.

    Args:
        url (str): URL of the item to scrape.

    Returns:
        tuple[bool, dict | str]: Success status and dictionary with price/discount details or error string.
    """
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
    """Single item scraper (used if you ever need to scrape a single link dynamically).

    Args:
        url (str): Web URL of the product to scrape.

    Returns:
        tuple[bool, dict | str]: Tuple with success flag and extracted details dict or error message.
    """
    return await asyncio.to_thread(_scrape_item_logic, url)


async def _refresh_all_prices_async() -> list[str]:
    """Async generator that processes items using isolated browser contexts.

    Returns:
        list[str]: Log lines summarizing the outcome of refreshing each tracked item.
    """
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

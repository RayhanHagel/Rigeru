import asyncio
import sys
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

from utilities.web.util_price_monitor import (
    load_tracked_items,
    add_item,
    delete_item,
    _refresh_all_prices_async
)

router = APIRouter(
    prefix="/api/web-downloads/price-monitor",
    tags=["Price Monitor"]
)

class AddItemRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Display name of the product or item to monitor.")
    url: str = Field(..., min_length=5, description="Full HTTP/HTTPS URL of the product page.")

# Global state to track background refresh
is_refreshing_flag: bool = False

@router.get("/items")
def get_items() -> List[Dict[str, Any]]:
    """
    Retrieve all tracked price monitor items decorated with price fluctuation statistics.

    Returns:
        List[Dict[str, Any]]: List of tracked item records with lowest/current price calculations.
    """
    items = load_tracked_items()
    
    processed: List[Dict[str, Any]] = []
    for item in items:
        history = item.get('history', [])
        is_cheapest = False
        price_never_changed = False
        cheapest_val = None
        current_price = None

        if history:
            prices = [h['price'] for h in history]
            cheapest_val = min(prices)
            highest_val = max(prices)
            current_price = history[-1]['price']
            
            price_fluctuated = highest_val > cheapest_val
            if not price_fluctuated:
                price_never_changed = True
            if current_price <= cheapest_val and price_fluctuated:
                is_cheapest = True
                
        item['_current_price'] = current_price
        item['_cheapest_val'] = cheapest_val
        item['_is_cheapest'] = is_cheapest
        item['_price_never_changed'] = price_never_changed
        
        processed.append(item)
    return processed

@router.post("/items")
def add_new_item(req: AddItemRequest) -> Dict[str, str]:
    """
    Register a new product URL for automated periodic price scraping.

    Args:
        req (AddItemRequest): Request object with item name and web page URL.

    Returns:
        Dict[str, str]: Success confirmation message.

    Raises:
        HTTPException: If URL is invalid or scraping fails during initialization.
    """
    if not (req.url.startswith("http://") or req.url.startswith("https://")):
        raise HTTPException(status_code=400, detail="Invalid URL: must begin with http:// or https://")

    success, msg = add_item(req.name.strip(), req.url.strip())
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

@router.delete("/items/{item_id}")
def delete_tracked_item(item_id: str) -> Dict[str, str]:
    """
    Remove an item from active price monitoring.

    Args:
        item_id (str): Unique identifier of the tracked item.

    Returns:
        Dict[str, str]: Confirmation status message.

    Raises:
        HTTPException: If item_id is empty.
    """
    clean_id = item_id.strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="Item ID cannot be empty.")
    delete_item(clean_id)
    return {"status": "success"}

def run_refresh_task() -> None:
    """
    Worker task executing asynchronous price scraping for all tracked items.

    Returns:
        None
    """
    global is_refreshing_flag
    try:
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        asyncio.run(_refresh_all_prices_async())
    finally:
        is_refreshing_flag = False

@router.post("/refresh")
def start_refresh(background_tasks: BackgroundTasks) -> Dict[str, str]:
    """
    Trigger a background refresh scraping job across all tracked items.

    Args:
        background_tasks (BackgroundTasks): Background task runner.

    Returns:
        Dict[str, str]: Status message ('started' or 'already_running').
    """
    global is_refreshing_flag
    if is_refreshing_flag:
        return {"status": "already_running"}
    
    is_refreshing_flag = True
    background_tasks.add_task(run_refresh_task)
    return {"status": "started"}

@router.get("/refresh/status")
def get_refresh_status() -> Dict[str, bool]:
    """
    Query the active running status of the price monitor background scraper.

    Returns:
        Dict[str, bool]: Boolean flag indicating if scraping is actively running.
    """
    global is_refreshing_flag
    return {"is_refreshing": is_refreshing_flag}

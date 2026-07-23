import asyncio
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from utilities.util_price_monitor import (
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
    name: str
    url: str

# Global state to track background refresh
is_refreshing_flag = False

@router.get("/items")
def get_items():
    items = load_tracked_items()
    
    processed = []
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
def add_new_item(req: AddItemRequest):
    success, msg = add_item(req.name, req.url)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return {"message": msg}

@router.delete("/items/{item_id}")
def delete_tracked_item(item_id: str):
    delete_item(item_id)
    return {"status": "success"}

def run_refresh_task():
    global is_refreshing_flag
    try:
        import sys
        import asyncio
        if sys.platform == "win32":
            asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
        asyncio.run(_refresh_all_prices_async())
    finally:
        is_refreshing_flag = False

@router.post("/refresh")
def start_refresh(background_tasks: BackgroundTasks):
    global is_refreshing_flag
    if is_refreshing_flag:
        return {"status": "already_running"}
    
    is_refreshing_flag = True
    background_tasks.add_task(run_refresh_task)
    return {"status": "started"}

@router.get("/refresh/status")
def get_refresh_status():
    global is_refreshing_flag
    return {"is_refreshing": is_refreshing_flag}

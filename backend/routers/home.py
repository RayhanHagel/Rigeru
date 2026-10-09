import json
import os
from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/api/home",
    tags=["Home & Dashboard"]
)


@router.get("/quick-cache")
def get_quick_cache() -> Dict[str, Any]:
    """
    Retrieve cached layout and widget items for the dashboard.

    Returns:
        Dict[str, Any]: Dictionary containing cached layout items and configuration.
    """
    from utilities.productivity_lifestyle.util_home import get_quick_cache_data
    try:
        return get_quick_cache_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SortQuickCacheRequest(BaseModel):
    items: List[List[Dict[str, Any]]] = Field(..., description="Ordered grid matrix of widget configurations.")

@router.post("/quick-cache/sort")
def sort_quick_cache(req: SortQuickCacheRequest) -> Dict[str, str]:
    """
    Update and persist the quick cache widget grid layout.

    Args:
        req (SortQuickCacheRequest): Payload containing ordered matrix of widget cards.

    Returns:
        Dict[str, str]: Confirmation status message.
    """
    if not isinstance(req.items, list):
        raise HTTPException(status_code=400, detail="Invalid items payload: list of rows expected.")
    from utilities.productivity_lifestyle.util_home import save_quick_cache_data
    try:
        save_quick_cache_data(req.items)
        return {"message": "Order saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

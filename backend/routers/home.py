import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(
    prefix="/api/home",
    tags=["Home & Dashboard"]
)


@router.get("/quick-cache")
def get_quick_cache():
    """Returns the quick cache data for the dashboard."""
    from utilities.util_home import get_quick_cache_data
    try:
        return get_quick_cache_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class SortQuickCacheRequest(BaseModel):
    items: list[list[dict]]

@router.post("/quick-cache/sort")
def sort_quick_cache(req: SortQuickCacheRequest):
    """Updates the quick cache order."""
    from utilities.util_home import save_quick_cache_data
    try:
        save_quick_cache_data(req.items)
        return {"message": "Order saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

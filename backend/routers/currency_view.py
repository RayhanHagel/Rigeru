import json
from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List

from utilities.util_currency import (
    get_available_currencies,
    convert_currency,
    get_historical_trend
)

router = APIRouter(
    prefix="/api/web-downloads/currency",
    tags=["Currency Converter"]
)

@router.get("/available")
def available_currencies():
    success, data = get_available_currencies()
    if not success:
        raise HTTPException(status_code=500, detail=str(data))
    return data

@router.get("/convert")
def convert(amount: float, base: str, target: str):
    success, result = convert_currency(amount, base, target)
    if not success:
        raise HTTPException(status_code=500, detail=str(result))
    return {"amount": amount, "base": base, "target": target, "result": result}

@router.get("/trend")
def trend(base: str, target: str, days: int = 30, forecast_days: int = 7):
    success, df_or_error, cached_time = get_historical_trend(base, target, days, forecast_days)
    if not success:
        raise HTTPException(status_code=500, detail=str(df_or_error))
    
    # df is a Pandas DataFrame with the date as index, and columns ['rate', 'type']
    # Let's convert it to a list of dicts.
    df_plot = df_or_error.reset_index()
    # The new column will be called 'index', rename to 'date'
    df_plot.rename(columns={'index': 'date'}, inplace=True)
    # Convert dates to string format
    df_plot['date'] = df_plot['date'].dt.strftime('%Y-%m-%d')
    
    records = df_plot.to_dict(orient="records")
    return {
        "cached_time": cached_time,
        "trend_data": records
    }

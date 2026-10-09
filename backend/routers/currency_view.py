import json
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Query
import numpy as np

from utilities.productivity_lifestyle.util_currency import (
    get_available_currencies,
    convert_currency,
    get_historical_trend
)

router = APIRouter(
    prefix="/api/web-downloads/currency",
    tags=["Currency Converter"]
)

@router.get("/available")
def available_currencies() -> Dict[str, str]:
    """
    Retrieve list of all supported ISO currency codes and names.

    Returns:
        Dict[str, str]: Mapping of currency symbols to their full names.

    Raises:
        HTTPException: If currency list fails to load from the remote API or cache.
    """
    success, data = get_available_currencies()
    if not success:
        raise HTTPException(status_code=500, detail=str(data))
    return data

@router.get("/convert")
def convert(
    amount: float = Query(..., gt=0, description="Amount of money to convert (must be > 0)"),
    base: str = Query(..., min_length=2, max_length=10, description="Source currency code (e.g. USD)"),
    target: str = Query(..., min_length=2, max_length=10, description="Target currency code (e.g. EUR)")
) -> Dict[str, Any]:
    """
    Convert a monetary value from a base currency to a target currency.

    Args:
        amount (float): Positive numeric value to convert.
        base (str): Base currency code.
        target (str): Target currency code.

    Returns:
        Dict[str, Any]: Conversion result including base, target, original amount, and converted amount.

    Raises:
        HTTPException: If conversion fails or invalid currency symbols are provided.
    """
    base_clean = base.strip().upper()
    target_clean = target.strip().upper()
    if not base_clean or not target_clean:
        raise HTTPException(status_code=400, detail="Base and target currency symbols must not be empty.")

    success, result = convert_currency(amount, base_clean, target_clean)
    if not success:
        raise HTTPException(status_code=500, detail=str(result))
    return {"amount": amount, "base": base_clean, "target": target_clean, "result": result}

@router.get("/trend")
def trend(
    base: str = Query(..., min_length=2, max_length=10, description="Source currency code"),
    target: str = Query(..., min_length=2, max_length=10, description="Target currency code"),
    days: int = Query(30, ge=1, le=365, description="Historical lookback window in days"),
    forecast_days: int = Query(7, ge=0, le=90, description="Number of future forecast days")
) -> Dict[str, Any]:
    """
    Fetch historical exchange rates and future linear forecast trend.

    Args:
        base (str): Base currency code.
        target (str): Target currency code.
        days (int, optional): Lookback days. Defaults to 30.
        forecast_days (int, optional): Forward forecast days. Defaults to 7.

    Returns:
        Dict[str, Any]: Historical and predicted exchange rates with timestamp metadata.

    Raises:
        HTTPException: If historical trend generation fails.
    """
    base_clean = base.strip().upper()
    target_clean = target.strip().upper()
    if not base_clean or not target_clean:
        raise HTTPException(status_code=400, detail="Base and target currency symbols must not be empty.")

    success, df_or_error, cached_time = get_historical_trend(base_clean, target_clean, days, forecast_days)
    if not success:
        raise HTTPException(status_code=500, detail=str(df_or_error))
    
    df_plot = df_or_error.reset_index()
    df_plot.rename(columns={'index': 'date'}, inplace=True)
    df_plot['date'] = df_plot['date'].dt.strftime('%Y-%m-%d')
    df_plot = df_plot.replace({np.nan: None})
    
    records = df_plot.to_dict(orient="records")
    return {
        "cached_time": cached_time,
        "trend_data": records
    }

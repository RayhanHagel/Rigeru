import os
import concurrent.futures
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from utilities.util_network import better_get
from utilities.util_store import get_data, set_data

_executor = ThreadPoolExecutor(max_workers=4)

def _get_currency_manager() -> dict:
    return get_data("currency_trends") or {}

def _set_currency_manager(data: dict):
    set_data("currency_trends", data)


def fetch_url(url: str) -> dict:
    """Fetches JSON data from the provided URL."""
    response = better_get(url)
    if response and response.status_code == 200:
        return response.json()
    raise Exception(f"Failed to fetch data from {url}")

def _revalidate_currencies():
    """Background task: fetches the latest currency list and updates the cache."""
    try:
        data = fetch_url("https://api.frankfurter.app/currencies")
        manager = _get_currency_manager()
        manager["feed"] = data
        _set_currency_manager(manager)
    except Exception as e:
        print(f"Currency SWR background revalidation failed: {e}")

def get_available_currencies() -> tuple[bool, dict | str]:
    """Retrieves a list of available currencies, prioritizing cache and triggering background update."""
    data = _get_currency_manager().get("feed")
            
    _executor.submit(_revalidate_currencies)

    if data:
        return True, data
        
    try:
        data = fetch_url("https://api.frankfurter.app/currencies")
        manager = _get_currency_manager()
        manager["feed"] = data
        _set_currency_manager(manager)
        return True, data
    except Exception as e:
        return False, f"Network error: {str(e)}"

def convert_currency(amount: float, base: str, target: str) -> tuple[bool, float | str]:
    """Converts a specific amount from one currency to another using the latest rates."""
    if base == target:
        return True, amount
    try:
        url = f"https://api.frankfurter.app/latest?amount={amount}&from={base}&to={target}"
        future = _executor.submit(fetch_url, url)
        data = future.result()
        return True, data['rates'][target]
    except Exception as e:
        return False, f"Network error: {str(e)}"

def _revalidate_trend(url: str, key: str):
    """Background task: fetches data and automatically updates the cache."""
    try:
        data = fetch_url(url)
        data['_cached_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        manager = _get_currency_manager()
        if "trends" not in manager:
            manager["trends"] = {}
        manager["trends"][key] = data
        _set_currency_manager(manager)
            
    except Exception as e:
        print(f"Trend SWR background revalidation failed: {e}")

def get_historical_trend(base: str, target: str, days: int = 30, forecast_days: int = 7) -> tuple[bool, any, str]:
    """
    Fetches historical exchange rates for a given period and extrapolates a short-term trend.
    Returns a success boolean, a pandas DataFrame with historical and predicted rates, and the cache timestamp.
    """
    if base == target:
        return False, "Same currency selected.", ""
        
    import pandas as pd
    import numpy as np
    
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    url = f"https://api.frankfurter.app/{start_date}..?from={base}&to={target}"
    key = f"{base}_{target}"
    
    api_data = None
    cached_time = None
    
    try:
        manager = _get_currency_manager()
        trends = manager.get("trends", {})
        if key in trends:
            api_data = trends[key]
            cached_time = api_data.get('_cached_at', 'Unknown Time')
    except Exception:
        pass 
            
    _executor.submit(_revalidate_trend, url, key)
    
    if not api_data:
        try:
            api_data = fetch_url(url)
            api_data['_cached_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            manager = _get_currency_manager()
            if "trends" not in manager:
                manager["trends"] = {}
            manager["trends"][key] = api_data
            _set_currency_manager(manager)
            
            cached_time = "Just now"
        except Exception as e:
            return False, f"Network error: {str(e)}", ""

    try:
        rates = api_data.get('rates', {})
        df = pd.DataFrame.from_dict(rates, orient='index')
        df.index = pd.to_datetime(df.index)
        df.columns = ['rate']
        df['type'] = 'Historical'
        
        if len(df) > 1:
            y = df['rate'].values
            x = np.arange(len(y))
            
            z = np.polyfit(x, y, 1)
            p = np.poly1d(z)
            
            last_date = df.index[-1]
            future_dates = [last_date + timedelta(days=i) for i in range(1, forecast_days + 1)]
            future_x = np.arange(len(y), len(y) + forecast_days)
            future_y = p(future_x)
            
            df_future = pd.DataFrame({'rate': future_y, 'type': 'Extrapolation'}, index=future_dates)
            df = pd.concat([df, df_future])
            
        return True, df, cached_time
    except Exception as e:
        return False, f"Data processing error: {str(e)}", ""
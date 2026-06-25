import os
import json
from datetime import datetime, timedelta
import streamlit as st
from concurrent.futures import ThreadPoolExecutor
from utilities.util_network import better_get
from streamlit.runtime.scriptrunner import add_script_run_ctx, get_script_run_ctx

# UPDATED: New cache directory paths
CACHE_DIR = "./cache/currency/"
CACHE_FILE_CURRENCIES = os.path.join(CACHE_DIR, "currency_feed.json")

_executor = ThreadPoolExecutor(max_workers=4)

def fetch_url(url: str) -> dict:
    response = better_get(url)
    if response and response.status_code == 200:
        return response.json()
    raise Exception(f"Failed to fetch data from {url}")

def _revalidate_currencies():
    try:
        data = fetch_url("https://api.frankfurter.app/currencies")
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(CACHE_FILE_CURRENCIES, 'w') as f:
            json.dump(data, f)
    except Exception as e:
        print(f"Currency SWR background revalidation failed: {e}")

def get_available_currencies() -> tuple[bool, dict | str]:
    data = None
    if os.path.exists(CACHE_FILE_CURRENCIES):
        try:
            with open(CACHE_FILE_CURRENCIES, 'r') as f:
                data = json.load(f)
        except Exception:
            pass 
            
    _executor.submit(_revalidate_currencies)

    if data:
        return True, data
        
    try:
        data = fetch_url("https://api.frankfurter.app/currencies")
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(CACHE_FILE_CURRENCIES, 'w') as f:
            json.dump(data, f)
        return True, data
    except Exception as e:
        return False, f"Network error: {str(e)}"

def convert_currency(amount: float, base: str, target: str) -> tuple[bool, float | str]:
    if base == target:
        return True, amount
    try:
        url = f"https://api.frankfurter.app/latest?amount={amount}&from={base}&to={target}"
        future = _executor.submit(fetch_url, url)
        data = future.result()
        return True, data['rates'][target]
    except Exception as e:
        return False, f"Network error: {str(e)}"

def _revalidate_trend(url: str, cache_file: str, ctx):
    """Background task: fetches data and automatically forces the UI to refresh."""
    try:
        if ctx:
            add_script_run_ctx(ctx=ctx)
            
        data = fetch_url(url)
        data['_cached_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(cache_file, 'w') as f:
            json.dump(data, f)
            
        st.rerun()
        
    except Exception as e:
        print(f"Trend SWR background revalidation failed: {e}")

def get_historical_trend(base: str, target: str, days: int = 30, forecast_days: int = 7) -> tuple[bool, any, str]:
    if base == target:
        return False, "Same currency selected.", ""
        
    import pandas as pd
    import numpy as np
    
    start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    url = f"https://api.frankfurter.app/{start_date}..?from={base}&to={target}"
    # The cache_file will now automatically build into ./cache/currency/trend_BASE_TARGET.json
    cache_file = os.path.join(CACHE_DIR, f"trend_{base}_{target}.json")
    
    api_data = None
    cached_time = None
    
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r') as f:
                api_data = json.load(f)
                cached_time = api_data.get('_cached_at', 'Unknown Time')
        except Exception:
            pass 
            
    ctx = get_script_run_ctx()
    _executor.submit(_revalidate_trend, url, cache_file, ctx)
    
    if not api_data:
        try:
            api_data = fetch_url(url)
            api_data['_cached_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(cache_file, 'w') as f:
                json.dump(api_data, f)
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
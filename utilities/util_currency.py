import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import streamlit as st
from concurrent.futures import ThreadPoolExecutor
from utilities.util_network import better_get

def fetch_url(url: str) -> dict:
    """Helper function to fetch URL data to be run in a thread."""
    response = better_get(url)
    if response and response.status_code == 200:
        return response.json()
    raise Exception(f"Failed to fetch data from {url}")

@st.cache_data(ttl=3600, show_spinner=False) 
def get_available_currencies() -> tuple[bool, dict | str]:
    """Fetches the list of supported currencies using a background thread."""
    try:
        with ThreadPoolExecutor() as executor:
            future = executor.submit(fetch_url, "https://api.frankfurter.app/currencies")
            data = future.result()
        return True, data
    except Exception as e:
        return False, f"Network error: {str(e)}"

def convert_currency(amount: float, base: str, target: str) -> tuple[bool, float | str]:
    """Converts an amount using a background thread to prevent UI lock."""
    if base == target:
        return True, amount
        
    try:
        url = f"https://api.frankfurter.app/latest?amount={amount}&from={base}&to={target}"
        with ThreadPoolExecutor() as executor:
            future = executor.submit(fetch_url, url)
            data = future.result()
        return True, data['rates'][target]
    except Exception as e:
        return False, f"Network error: {str(e)}"

@st.cache_data(ttl=3600, show_spinner=False)
def get_historical_trend(base: str, target: str, days: int = 30, forecast_days: int = 7) -> tuple[bool, pd.DataFrame | str]:
    """Fetches historical rates and extrapolates a future trend using Linear Regression."""
    if base == target:
        return False, "Same currency selected."
        
    try:
        start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        url = f"https://api.frankfurter.app/{start_date}..?from={base}&to={target}"
        
        with ThreadPoolExecutor() as executor:
            future = executor.submit(fetch_url, url)
            data = future.result()
            
        rates = data.get('rates', {})
        df = pd.DataFrame.from_dict(rates, orient='index')
        df.index = pd.to_datetime(df.index)
        df.columns = ['rate']
        df['type'] = 'Historical' # Tag data for the chart
        
        # --- Extrapolation Logic ---
        if len(df) > 1:
            y = df['rate'].values
            x = np.arange(len(y))
            
            # Fit a simple 1st-degree polynomial (linear regression)
            z = np.polyfit(x, y, 1)
            p = np.poly1d(z)
            
            # Generate future dates
            last_date = df.index[-1]
            future_dates = [last_date + timedelta(days=i) for i in range(1, forecast_days + 1)]
            future_x = np.arange(len(y), len(y) + forecast_days)
            future_y = p(future_x)
            
            # Create forecast dataframe and append
            df_future = pd.DataFrame({'rate': future_y, 'type': 'Extrapolation'}, index=future_dates)
            df = pd.concat([df, df_future])
            
        return True, df
    except Exception as e:
        return False, f"Network error: {str(e)}"
import io
from typing import Any
import pandas as pd

def parse_chart_data(file_content: bytes, filename: str) -> list[dict[str, Any]]:
    """Parses a CSV or Excel file and returns a list of dictionaries for Recharts.

    Args:
        file_content (bytes): Raw binary content of uploaded file.
        filename (str): Name of the file to determine format (.csv, .xls, .xlsx).

    Returns:
        list[dict[str, Any]]: List of row records formatted for charting.
    """
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_content))
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            raise ValueError("Unsupported file format. Please upload CSV or Excel.")
            
        # Clean up column names (strip whitespace)
        df.columns = [str(c).strip() for c in df.columns]
        
        # Replace NaN with None so it converts to null in JSON
        df = df.where(pd.notnull(df), None)
        
        # Convert to list of dicts
        return df.to_dict(orient='records')
        
    except Exception as e:
        print(f"Error parsing chart data: {e}")
        raise ValueError(f"Failed to parse file: {str(e)}")

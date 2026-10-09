import os
import time
import sqlite3
import requests
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

def init_tracker_db(db_path: str, primary_table_sql: str, id_col: str = "identifier") -> None:
    """

            Initialize SQLite database and location tracking schema tables.

            Args:
                db_path (str): Filepath to SQLite database file.
                primary_table_sql (str): SQL DDL creating the primary entity table.
                id_col (str, optional): Primary key column name for location history foreign key. Defaults to "identifier".

            Returns:
                None
            
    """
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute(primary_table_sql)
    c.execute(f'''
        CREATE TABLE IF NOT EXISTS location_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            {id_col} TEXT,
            timestamp REAL,
            lat REAL,
            lon REAL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    conn.commit()
    conn.close()


def log_location_history(
    conn: sqlite3.Connection,
    id_col: str,
    identifier: str,
    lat: Optional[float],
    lon: Optional[float],
    timestamp: float,
    throttle_seconds: int = 86400
) -> None:
    """

            Append a geo-tagged location history record throttled to prevent redundant entries.

            Args:
                conn (sqlite3.Connection): Open SQLite connection.
                id_col (str): Entity identifier column name.
                identifier (str): Entity MAC, BSSID, or IP address.
                lat (Optional[float]): Latitude coordinate.
                lon (Optional[float]): Longitude coordinate.
                timestamp (float): UNIX epoch timestamp.
                throttle_seconds (int, optional): Minimum interval in seconds between identical logs. Defaults to 86400.

            Returns:
                None
            
    """
    c = conn.cursor()
    c.execute(f"SELECT timestamp, lat, lon FROM location_history WHERE {id_col}=? ORDER BY timestamp DESC LIMIT 1", (identifier,))
    last_log = c.fetchone()
    
    should_log = True
    if last_log:
        last_timestamp, last_lat, last_lon = last_log
        if last_lat == lat and last_lon == lon:
            if (timestamp - last_timestamp) < throttle_seconds:
                should_log = False
                
    if should_log:
        c.execute(f"INSERT INTO location_history ({id_col}, timestamp, lat, lon) VALUES (?, ?, ?, ?)",
                  (identifier, timestamp, lat, lon))


def load_manual_location(db_path: str) -> Dict[str, Optional[float]]:
    """

            Load manually configured latitude and longitude from the database settings table.

            Args:
                db_path (str): Filepath to SQLite database file.

            Returns:
                Dict[str, Optional[float]]: Dictionary containing 'lat' and 'lon' coordinates.
            
    """
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key='manual_lat'")
    row_lat = c.fetchone()
    c.execute("SELECT value FROM settings WHERE key='manual_lon'")
    row_lon = c.fetchone()
    conn.close()

    if row_lat and row_lon:
        try:
            return {"lat": float(row_lat[0]), "lon": float(row_lon[0])}
        except ValueError:
            pass
    return {"lat": None, "lon": None}


def save_manual_location(db_path: str, lat: float, lon: float) -> None:
    """

            Persist manual geographic coordinates to the settings table.

            Args:
                db_path (str): Target SQLite database file.
                lat (float): Latitude coordinate.
                lon (float): Longitude coordinate.

            Returns:
                None
            
    """
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('manual_lat', ?)", (str(lat),))
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('manual_lon', ?)", (str(lon),))
    conn.commit()
    conn.close()


def search_nominatim(query: str) -> List[Dict[str, Any]]:
    """

            Query OpenStreetMap Nominatim reverse geocoder for location candidates.

            Args:
                query (str): Location search string.

            Returns:
                List[Dict[str, Any]]: List of matching location records with display name and coordinates.
            
    """
    if not query.strip():
        return []
    try:
        url = f"https://nominatim.openstreetmap.org/search?q={requests.utils.quote(query)}&format=json&limit=5"
        headers = {"User-Agent": "Rigeru-Dashboard/2.0"}
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            return [
                {
                    "display_name": item.get("display_name"),
                    "lat": float(item.get("lat")),
                    "lon": float(item.get("lon"))
                }
                for item in res.json()
            ]
    except Exception as e:
        logger.error(f"Error geocoding location: {e}")
    return []

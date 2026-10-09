import asyncio
import os
import time
import sqlite3
import logging
from typing import Dict, Any, List
from bleak import BleakScanner
from pydantic import BaseModel

logger = logging.getLogger(__name__)

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "bluetooth_tracker.db"))
TRACKER_STATE = {
    "is_running": False,
    "task": None,
    "last_location": {"lat": None, "lon": None},
    "manual_location": {"lat": None, "lon": None}
}

class Device(BaseModel):
    mac: str
    name: str
    rssi: int
    last_seen: float
    lat: float | None
    lon: float | None

DEVICES_TABLE_SQL = '''
    CREATE TABLE IF NOT EXISTS devices (
        mac TEXT PRIMARY KEY,
        name TEXT,
        first_seen REAL,
        last_seen REAL,
        last_lat REAL,
        last_lon REAL
    )
'''

def init_db() -> None:
    """

            Initialize the SQLite database tables and load manual location settings.

            Returns:
                None
            
    """
    from utilities.system_network.util_tracker import init_tracker_db, load_manual_location
    init_tracker_db(DB_PATH, DEVICES_TABLE_SQL, id_col="mac")
    
    # Load settings if not already loaded
    if TRACKER_STATE["manual_location"]["lat"] is None:
        loc = load_manual_location(DB_PATH)
        if loc["lat"] is not None:
            TRACKER_STATE["manual_location"] = loc
            TRACKER_STATE["last_location"] = loc

async def get_current_location() -> tuple[float | None, float | None]:
    """

            Retrieve current latitude and longitude coordinates from tracker state.

            Returns:
                tuple[float | None, float | None]: Tuple of (lat, lon) coordinates.
            
    """
    if TRACKER_STATE.get("manual_location", {}).get("lat") is not None:
        return (TRACKER_STATE["manual_location"]["lat"], TRACKER_STATE["manual_location"]["lon"])

    return (None, None)

def update_device_in_db(mac: str, name: str, lat: float | None, lon: float | None, timestamp: float) -> None:
    """

            Insert or update a discovered Bluetooth device and log location history.

            Args:
                mac (str): Device Bluetooth MAC address.
                name (str): Device advertised name.
                lat (float | None): Latitude coordinate.
                lon (float | None): Longitude coordinate.
                timestamp (float): Observation UNIX timestamp.

            Returns:
                None
            
    """
    from utilities.system_network.util_tracker import log_location_history
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Check if device exists
    c.execute("SELECT first_seen FROM devices WHERE mac=?", (mac,))
    row = c.fetchone()
    
    if row:
        # Update last_seen
        c.execute("UPDATE devices SET last_seen=?, last_lat=?, last_lon=?, name=? WHERE mac=?", 
                  (timestamp, lat, lon, name, mac))
    else:
        # Insert new device
        c.execute("INSERT INTO devices (mac, name, first_seen, last_seen, last_lat, last_lon) VALUES (?, ?, ?, ?, ?, ?)",
                  (mac, name, timestamp, timestamp, lat, lon))
    
    # Log to history (throttled to 24h per location)
    log_location_history(conn, "mac", mac, lat, lon, timestamp)
    
    conn.commit()
    conn.close()

async def _scan_loop() -> None:
    """

            Background coroutine executing continuous BLE peripheral discovery scans.

            Returns:
                None
            
    """
    logger.info("Bluetooth tracking started.")
    while TRACKER_STATE["is_running"]:
        try:
            # Update location every scan cycle
            lat, lon = await get_current_location()
            TRACKER_STATE["last_location"] = {"lat": lat, "lon": lon}
            
            # Scan for 5 seconds
            devices = await BleakScanner.discover(timeout=5.0)
            now = time.time()
            
            for d in devices:
                mac = d.address
                name = d.name or "Unknown Device"
                update_device_in_db(mac, name, lat, lon, now)
                
            # Sleep a bit before next scan
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"Error in scan loop: {e}")
            await asyncio.sleep(10) # wait longer on error

def start_tracking() -> dict[str, str]:
    """

            Initiate asynchronous Bluetooth tracking background task.

            Returns:
                dict[str, str]: Status dictionary indicating started or already running.
            
    """
    init_db()
    if TRACKER_STATE["is_running"]:
        return {"status": "already_running"}
    
    TRACKER_STATE["is_running"] = True
    TRACKER_STATE["task"] = asyncio.create_task(_scan_loop())
    return {"status": "started"}

def stop_tracking() -> dict[str, str]:
    """

            Halt active Bluetooth tracking background task.

            Returns:
                dict[str, str]: Status dictionary indicating stopped or not running.
            
    """
    if not TRACKER_STATE["is_running"]:
        return {"status": "not_running"}
    
    TRACKER_STATE["is_running"] = False
    if TRACKER_STATE["task"]:
        TRACKER_STATE["task"].cancel()
        TRACKER_STATE["task"] = None
    return {"status": "stopped"}

def get_status() -> dict[str, Any]:
    """

            Retrieve tracking state and last known geographic position.

            Returns:
                dict[str, Any]: Tracker state containing 'is_running' and 'last_location'.
            
    """
    init_db()
    return {
        "is_running": TRACKER_STATE["is_running"],
        "last_location": TRACKER_STATE["last_location"]
    }

def get_devices() -> List[Dict[str, Any]]:
    """

            Query all recorded Bluetooth devices sorted by most recently seen.

            Returns:
                List[Dict[str, Any]]: List of device records.
            
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM devices ORDER BY last_seen DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_device_history(mac: str) -> List[Dict[str, Any]]:
    """

            Retrieve timestamped location history for a specific Bluetooth MAC address.

            Args:
                mac (str): Device MAC address.

            Returns:
                List[Dict[str, Any]]: Chronological list of location history entries.
            
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM location_history WHERE mac=? ORDER BY timestamp DESC", (mac,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def clear_devices() -> dict[str, str]:
    """

            Purge all discovered devices and historical location trails from the database.

            Returns:
                dict[str, str]: Status dictionary indicating cleared.
            
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM devices")
    c.execute("DELETE FROM location_history")
    conn.commit()
    c.execute("VACUUM")
    conn.commit()
    conn.close()
    return {"status": "cleared"}

def set_manual_location(lat: float, lon: float) -> dict[str, Any]:
    """

            Update manual geographic coordinates for Bluetooth device tracking.

            Args:
                lat (float): Latitude coordinate.
                lon (float): Longitude coordinate.

            Returns:
                dict[str, Any]: Success response with stored coordinates.
            
    """
    from utilities.system_network.util_tracker import save_manual_location
    TRACKER_STATE["manual_location"] = {"lat": lat, "lon": lon}
    TRACKER_STATE["last_location"] = {"lat": lat, "lon": lon}
    init_db()
    save_manual_location(DB_PATH, lat, lon)
    return {"status": "success", "lat": lat, "lon": lon}

import asyncio
import os
import time
import sqlite3
import logging
from typing import Dict, Any, List
from bleak import BleakScanner
from pydantic import BaseModel

logger = logging.getLogger(__name__)

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "bluetooth_tracker.db"))
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

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS devices (
            mac TEXT PRIMARY KEY,
            name TEXT,
            first_seen REAL,
            last_seen REAL,
            last_lat REAL,
            last_lon REAL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS location_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mac TEXT,
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
    
    # Load settings if not already loaded
    if TRACKER_STATE["manual_location"]["lat"] is None:
        c.execute("SELECT value FROM settings WHERE key='manual_lat'")
        row_lat = c.fetchone()
        c.execute("SELECT value FROM settings WHERE key='manual_lon'")
        row_lon = c.fetchone()
        if row_lat and row_lon:
            lat = float(row_lat[0])
            lon = float(row_lon[0])
            TRACKER_STATE["manual_location"] = {"lat": lat, "lon": lon}
            TRACKER_STATE["last_location"] = {"lat": lat, "lon": lon}

    conn.commit()
    conn.close()

async def get_current_location() -> tuple[float | None, float | None]:
    """Returns (lat, lon) using manual location state."""
    if TRACKER_STATE.get("manual_location", {}).get("lat") is not None:
        return (TRACKER_STATE["manual_location"]["lat"], TRACKER_STATE["manual_location"]["lon"])

    return (None, None)

def update_device_in_db(mac: str, name: str, lat: float | None, lon: float | None, timestamp: float):
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
    
    # Log to history (throttle to once per day if at the same location)
    c.execute("SELECT timestamp, lat, lon FROM location_history WHERE mac=? ORDER BY timestamp DESC LIMIT 1", (mac,))
    last_log = c.fetchone()
    
    should_log = True
    if last_log:
        last_timestamp, last_lat, last_lon = last_log
        if last_lat == lat and last_lon == lon:
            if (timestamp - last_timestamp) < 86400: # 24 hours in seconds
                should_log = False
                
    if should_log:
        c.execute("INSERT INTO location_history (mac, timestamp, lat, lon) VALUES (?, ?, ?, ?)",
                  (mac, timestamp, lat, lon))
    
    conn.commit()
    conn.close()

async def _scan_loop():
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

def start_tracking():
    init_db()
    if TRACKER_STATE["is_running"]:
        return {"status": "already_running"}
    
    TRACKER_STATE["is_running"] = True
    TRACKER_STATE["task"] = asyncio.create_task(_scan_loop())
    return {"status": "started"}

def stop_tracking():
    if not TRACKER_STATE["is_running"]:
        return {"status": "not_running"}
    
    TRACKER_STATE["is_running"] = False
    if TRACKER_STATE["task"]:
        TRACKER_STATE["task"].cancel()
        TRACKER_STATE["task"] = None
    return {"status": "stopped"}

def get_status():
    init_db()
    return {
        "is_running": TRACKER_STATE["is_running"],
        "last_location": TRACKER_STATE["last_location"]
    }

def get_devices() -> List[Dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM devices ORDER BY last_seen DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_device_history(mac: str) -> List[Dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM location_history WHERE mac=? ORDER BY timestamp DESC", (mac,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def clear_devices():
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

def set_manual_location(lat: float, lon: float):
    TRACKER_STATE["manual_location"] = {"lat": lat, "lon": lon}
    TRACKER_STATE["last_location"] = {"lat": lat, "lon": lon}
    
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('manual_lat', ?)", (str(lat),))
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('manual_lon', ?)", (str(lon),))
    conn.commit()
    conn.close()
    
    return {"status": "success", "lat": lat, "lon": lon}

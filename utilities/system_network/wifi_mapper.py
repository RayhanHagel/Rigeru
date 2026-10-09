import asyncio
import os
import time
import sqlite3
import logging
import subprocess
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "wifi_mapper.db"))
TRACKER_STATE = {
    "is_running": False,
    "task": None,
    "last_location": {"lat": None, "lon": None},
    "manual_location": {"lat": None, "lon": None},
    "wlan_error_logged": False
}

NETWORKS_TABLE_SQL = '''
    CREATE TABLE IF NOT EXISTS networks (
        bssid TEXT PRIMARY KEY,
        ssid TEXT,
        security TEXT,
        signal TEXT,
        first_seen REAL,
        last_seen REAL,
        last_lat REAL,
        last_lon REAL
    )
'''

def init_db() -> None:
    """

            Initialize SQLite Wi-Fi mapper database schema and load saved location settings.

            Returns:
                None
            
    """
    from utilities.system_network.util_tracker import init_tracker_db, load_manual_location
    init_tracker_db(DB_PATH, NETWORKS_TABLE_SQL, id_col="bssid")
    
    if TRACKER_STATE["manual_location"]["lat"] is None:
        loc = load_manual_location(DB_PATH)
        if loc["lat"] is not None:
            TRACKER_STATE["manual_location"] = loc
            TRACKER_STATE["last_location"] = loc

async def get_current_location() -> tuple[float | None, float | None]:
    """

            Retrieve current geographic coordinates from tracker state.

            Returns:
                tuple[float | None, float | None]: Tuple of (lat, lon) coordinates.
            
    """
    if TRACKER_STATE.get("manual_location", {}).get("lat") is not None:
        return (TRACKER_STATE["manual_location"]["lat"], TRACKER_STATE["manual_location"]["lon"])
    return (None, None)

def update_network_in_db(bssid: str, ssid: str, security: str, signal: str, lat: float | None, lon: float | None, timestamp: float) -> None:
    """

            Insert or update a wireless network record and append location history.

            Args:
                bssid (str): Network BSSID MAC address.
                ssid (str): Network SSID name.
                security (str): Authentication security type.
                signal (str): Signal strength percentage.
                lat (float | None): Latitude coordinate.
                lon (float | None): Longitude coordinate.
                timestamp (float): Observation UNIX timestamp.

            Returns:
                None
            
    """
    from utilities.system_network.util_tracker import log_location_history
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    c.execute("SELECT first_seen FROM networks WHERE bssid=?", (bssid,))
    row = c.fetchone()
    
    if row:
        c.execute("UPDATE networks SET last_seen=?, last_lat=?, last_lon=?, ssid=?, security=?, signal=? WHERE bssid=?", 
                  (timestamp, lat, lon, ssid, security, signal, bssid))
    else:
        c.execute("INSERT INTO networks (bssid, ssid, security, signal, first_seen, last_seen, last_lat, last_lon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  (bssid, ssid, security, signal, timestamp, timestamp, lat, lon))
    
    log_location_history(conn, "bssid", bssid, lat, lon, timestamp)
    
    conn.commit()
    conn.close()

def scan_wifi() -> list[dict[str, str]] | str:
    """

            Invoke Windows netsh wlan utility to discover nearby Wi-Fi access points.

            Returns:
                list[dict[str, str]] | str: List of discovered network dictionaries or "error".
            
    """
    networks = []
    try:
        result = subprocess.run('netsh wlan show networks mode=bssid', shell=True, capture_output=True, text=True, encoding='utf-8', errors='ignore')
        
        if result.returncode != 0:
            if not TRACKER_STATE.get("wlan_error_logged"):
                logger.error("Wi-Fi scan failed. You may not have a Wi-Fi adapter or the WLAN AutoConfig service is disabled.")
                TRACKER_STATE["wlan_error_logged"] = True
            return "error"
            
        TRACKER_STATE["wlan_error_logged"] = False
        output = result.stdout
        current_ssid = ""
        current_auth = ""
        
        for line in output.split('\n'):
            line = line.strip()
            if line.startswith("SSID"):
                parts = line.split(":", 1)
                if len(parts) > 1:
                    current_ssid = parts[1].strip()
            elif line.startswith("Authentication"):
                parts = line.split(":", 1)
                if len(parts) > 1:
                    current_auth = parts[1].strip()
            elif line.startswith("BSSID"):
                parts = line.split(":", 1)
                if len(parts) > 1:
                    networks.append({
                        "ssid": current_ssid or "Hidden Network",
                        "bssid": parts[1].strip(),
                        "security": current_auth,
                        "signal": "Unknown"
                    })
            elif line.startswith("Signal"):
                parts = line.split(":", 1)
                if len(parts) > 1 and networks:
                    networks[-1]["signal"] = parts[1].strip()
    except Exception as e:
        logger.error(f"Wifi scan error: {e}")
    return networks

async def _scan_loop() -> None:
    """

            Continuous background coroutine executing Wi-Fi scans.

            Returns:
                None
            
    """
    logger.info("WiFi tracking started.")
    while TRACKER_STATE["is_running"]:
        try:
            lat, lon = await get_current_location()
            TRACKER_STATE["last_location"] = {"lat": lat, "lon": lon}
            
            networks = await asyncio.to_thread(scan_wifi)
            
            if networks == "error":
                # Automatically stop the tracker if scanning fails (e.g. no adapter)
                TRACKER_STATE["is_running"] = False
                break
                
            now = time.time()
            
            for net in networks:
                update_network_in_db(net["bssid"], net["ssid"], net["security"], net["signal"], lat, lon, now)
                
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"Error in scan loop: {e}")
            await asyncio.sleep(10)

def start_tracking() -> dict[str, str]:
    """

            Launch asynchronous Wi-Fi scanning background task.

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

            Halt active Wi-Fi scanning background task.

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

            Retrieve Wi-Fi tracker run status and current coordinates.

            Returns:
                dict[str, Any]: Status dictionary containing 'is_running' and 'last_location'.
            
    """
    init_db()
    return {
        "is_running": TRACKER_STATE["is_running"],
        "last_location": TRACKER_STATE["last_location"]
    }

def get_networks() -> List[Dict[str, Any]]:
    """

            Retrieve all recorded Wi-Fi networks sorted by latest timestamp.

            Returns:
                List[Dict[str, Any]]: List of network records.
            
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM networks ORDER BY last_seen DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_network_history(bssid: str) -> List[Dict[str, Any]]:
    """

            Fetch chronological location tracking history for a specific BSSID.

            Args:
                bssid (str): Access point BSSID.

            Returns:
                List[Dict[str, Any]]: Historical location records.
            
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM location_history WHERE bssid=? ORDER BY timestamp DESC", (bssid,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def clear_networks() -> dict[str, str]:
    """

            Purge all Wi-Fi records and history entries from the database.

            Returns:
                dict[str, str]: Status dictionary indicating cleared.
            
    """
    init_db()
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM networks")
    c.execute("DELETE FROM location_history")
    conn.commit()
    c.execute("VACUUM")
    conn.commit()
    conn.close()
    return {"status": "cleared"}

def set_manual_location(lat: float, lon: float) -> dict[str, Any]:
    """

            Set manual latitude and longitude coordinates for Wi-Fi mapping.

            Args:
                lat (float): Latitude coordinate.
                lon (float): Longitude coordinate.

            Returns:
                dict[str, Any]: Response dictionary with updated coordinates.
            
    """
    from utilities.system_network.util_tracker import save_manual_location
    TRACKER_STATE["manual_location"] = {"lat": lat, "lon": lon}
    TRACKER_STATE["last_location"] = {"lat": lat, "lon": lon}
    init_db()
    save_manual_location(DB_PATH, lat, lon)
    return {"status": "success", "lat": lat, "lon": lon}

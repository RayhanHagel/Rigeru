import asyncio
import os
import time
import sqlite3
import logging
import subprocess
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "wifi_mapper.db"))
TRACKER_STATE = {
    "is_running": False,
    "task": None,
    "last_location": {"lat": None, "lon": None},
    "manual_location": {"lat": None, "lon": None},
    "wlan_error_logged": False
}

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
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
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS location_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bssid TEXT,
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
    if TRACKER_STATE.get("manual_location", {}).get("lat") is not None:
        return (TRACKER_STATE["manual_location"]["lat"], TRACKER_STATE["manual_location"]["lon"])
    return (None, None)

def update_network_in_db(bssid: str, ssid: str, security: str, signal: str, lat: float | None, lon: float | None, timestamp: float):
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
    
    c.execute("SELECT timestamp, lat, lon FROM location_history WHERE bssid=? ORDER BY timestamp DESC LIMIT 1", (bssid,))
    last_log = c.fetchone()
    
    should_log = True
    if last_log:
        last_timestamp, last_lat, last_lon = last_log
        if last_lat == lat and last_lon == lon:
            if (timestamp - last_timestamp) < 86400:
                should_log = False
                
    if should_log:
        c.execute("INSERT INTO location_history (bssid, timestamp, lat, lon) VALUES (?, ?, ?, ?)",
                  (bssid, timestamp, lat, lon))
    
    conn.commit()
    conn.close()

def scan_wifi():
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

async def _scan_loop():
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

def get_networks() -> List[Dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM networks ORDER BY last_seen DESC")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_network_history(bssid: str) -> List[Dict[str, Any]]:
    init_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM location_history WHERE bssid=? ORDER BY timestamp DESC", (bssid,))
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def clear_networks():
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

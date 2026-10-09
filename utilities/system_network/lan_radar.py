import asyncio
import os
import re
import socket
import time
import subprocess
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

TRACKER_STATE = {
    "is_running": False,
    "task": None,
    "devices": {}
}

def scan_lan() -> dict[str, dict[str, Any]]:
    """

            Scan local ARP table and resolve hostnames for active LAN devices.

            Returns:
                dict[str, dict[str, Any]]: Mapping of MAC addresses to device info dictionaries.
            
    """
    devices = {}
    try:
        output = subprocess.check_output('arp -a', shell=True, text=True, encoding='utf-8', errors='ignore')
        
        pattern = re.compile(r'\s*(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F\-]{17})\s+(\w+)')
        
        for line in output.split('\n'):
            match = pattern.match(line)
            if match:
                ip, mac, type_ = match.groups()
                if type_ in ['dynamic', 'static'] and not ip.startswith('224.') and not ip.startswith('239.') and ip != '255.255.255.255':
                    hostname = "Unknown"
                    try:
                        socket.setdefaulttimeout(0.1)
                        hostname_res = socket.gethostbyaddr(ip)
                        hostname = hostname_res[0]
                    except Exception:
                        pass
                    
                    devices[mac] = {
                        "ip": ip,
                        "mac": mac.replace('-', ':').upper(),
                        "type": type_,
                        "hostname": hostname,
                        "last_seen": time.time()
                    }
    except Exception as e:
        logger.error(f"LAN scan error: {e}")
    return devices

async def _scan_loop() -> None:
    """

            Asynchronous periodic loop running background LAN scans.

            Returns:
                None
            
    """
    logger.info("LAN tracking started.")
    while TRACKER_STATE["is_running"]:
        try:
            new_devices = await asyncio.to_thread(scan_lan)
            for mac, data in new_devices.items():
                TRACKER_STATE["devices"][mac] = data
            await asyncio.sleep(10)
        except Exception as e:
            logger.error(f"Error in LAN scan loop: {e}")
            await asyncio.sleep(10)

def start_tracking() -> dict[str, str]:
    """

            Start background periodic LAN radar scan task.

            Returns:
                dict[str, str]: Status dictionary.
            
    """
    if TRACKER_STATE["is_running"]:
        return {"status": "already_running"}
    
    TRACKER_STATE["is_running"] = True
    TRACKER_STATE["task"] = asyncio.create_task(_scan_loop())
    return {"status": "started"}

def stop_tracking() -> dict[str, str]:
    """

            Terminate running LAN radar scan task.

            Returns:
                dict[str, str]: Status dictionary.
            
    """
    if not TRACKER_STATE["is_running"]:
        return {"status": "not_running"}
    
    TRACKER_STATE["is_running"] = False
    if TRACKER_STATE["task"]:
        TRACKER_STATE["task"].cancel()
        TRACKER_STATE["task"] = None
    return {"status": "stopped"}

def get_status() -> dict[str, bool]:
    """

            Get current LAN tracking task status.

            Returns:
                dict[str, bool]: Dictionary indicating 'is_running'.
            
    """
    return {
        "is_running": TRACKER_STATE["is_running"]
    }

def get_devices() -> List[Dict[str, Any]]:
    """

            Retrieve list of devices active within the last 5 minutes.

            Returns:
                List[Dict[str, Any]]: Sorted list of device records.
            
    """
    now = time.time()
    active_devices = []
    for mac, data in list(TRACKER_STATE["devices"].items()):
        if now - data["last_seen"] < 300:
            active_devices.append(data)
    
    active_devices.sort(key=lambda x: [int(p) for p in x["ip"].split('.')])
    return active_devices

def clear_devices() -> dict[str, str]:
    """

            Clear in-memory discovered device table.

            Returns:
                dict[str, str]: Status dictionary indicating cleared.
            
    """
    TRACKER_STATE["devices"] = {}
    return {"status": "cleared"}

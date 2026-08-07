from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
from fastapi.responses import StreamingResponse, PlainTextResponse
import queue
import threading

from utilities.util_package_manager import load_local_cache, save_local_cache, fetch_all_fresh_data
import utilities.util_package_scoop as scoop
import utilities.util_package_winget as winget
import utilities.util_package_choco as choco
import utilities.windows_tweaks as tweaks
from utilities.util_stream import current_log_queue

def stream_generator(func, *args, **kwargs):
    q = queue.Queue()
    def worker():
        current_log_queue.set(q)
        try:
            func(*args, **kwargs)
        except Exception as e:
            q.put(f"Exception: {str(e)}\n")
        finally:
            q.put(None)
    thread = threading.Thread(target=worker)
    thread.start()
    while True:
        item = q.get()
        if item is None:
            break
        yield item

router = APIRouter(prefix="/api/system", tags=["System & Network"])

# ==========================================
# Static Storage Management
# ==========================================

@router.get("/static-storage/size")
def get_static_storage_size():
    import os
    static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static")
    if not os.path.exists(static_dir):
        return {"size_bytes": 0, "size_str": "0 B"}
    
    media_exts = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.mp4'}
    total_size = 0
    for dirpath, _, filenames in os.walk(static_dir):
        for f in filenames:
            ext = os.path.splitext(f)[1].lower()
            if ext in media_exts:
                fp = os.path.join(dirpath, f)
                if not os.path.islink(fp):
                    total_size += os.path.getsize(fp)
                
    # format size
    size_str = f"{total_size} B"
    if total_size > 1024 * 1024 * 1024:
        size_str = f"{total_size / (1024 * 1024 * 1024):.2f} GB"
    elif total_size > 1024 * 1024:
        size_str = f"{total_size / (1024 * 1024):.2f} MB"
    elif total_size > 1024:
        size_str = f"{total_size / 1024:.2f} KB"
        
    return {"size_bytes": total_size, "size_str": size_str}

@router.delete("/static-storage/clear")
def clear_static_storage():
    import os
    import shutil
    static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static")
    if not os.path.exists(static_dir):
        return {"message": "Static folder is already empty."}
        
    try:
        media_exts = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.mp4'}
        deleted_count = 0
        for dirpath, _, filenames in os.walk(static_dir):
            for f in filenames:
                ext = os.path.splitext(f)[1].lower()
                if ext in media_exts:
                    file_path = os.path.join(dirpath, f)
                    try:
                        if os.path.isfile(file_path) or os.path.islink(file_path):
                            os.unlink(file_path)
                            deleted_count += 1
                    except Exception as e:
                        pass
        return {"message": f"Cleared {deleted_count} static media files."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear static storage: {str(e)}")

@router.get("/temp-storage/size")
def get_temp_storage_size():
    import os
    temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "temp")
    if not os.path.exists(temp_dir):
        return {"size_bytes": 0, "size_str": "0 B"}
    
    total_size = 0
    for dirpath, _, filenames in os.walk(temp_dir):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
                
    # format size
    size_str = f"{total_size} B"
    if total_size > 1024 * 1024 * 1024:
        size_str = f"{total_size / (1024 * 1024 * 1024):.2f} GB"
    elif total_size > 1024 * 1024:
        size_str = f"{total_size / (1024 * 1024):.2f} MB"
    elif total_size > 1024:
        size_str = f"{total_size / 1024:.2f} KB"
        
    return {"size_bytes": total_size, "size_str": size_str}

@router.delete("/temp-storage/clear")
def clear_temp_storage():
    import os
    import shutil
    temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "temp")
    if not os.path.exists(temp_dir):
        return {"message": "Temp folder is already empty."}
        
    try:
        deleted_count = 0
        for dirpath, dirnames, filenames in os.walk(temp_dir, topdown=False):
            for f in filenames:
                file_path = os.path.join(dirpath, f)
                try:
                    if os.path.isfile(file_path) or os.path.islink(file_path):
                        os.unlink(file_path)
                        deleted_count += 1
                except Exception:
                    pass
            for d in dirnames:
                dir_path = os.path.join(dirpath, d)
                try:
                    os.rmdir(dir_path)
                except Exception:
                    pass
        return {"message": f"Cleared {deleted_count} temp files."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear temp storage: {str(e)}")

# ==========================================
# Package Manager Endpoints
# ==========================================

@router.get("/packages/cache")
def get_package_cache():
    """Returns the cached installed packages for all package managers."""
    cache = load_local_cache()
    return cache

@router.post("/packages/revalidate")
def revalidate_package_cache():
    """Triggers a fetch of all packages and updates the local cache."""
    def _do_revalidate():
        current_cache = load_local_cache()
        fresh_data = fetch_all_fresh_data(current_cache)
        save_local_cache(fresh_data)
    return StreamingResponse(stream_generator(_do_revalidate), media_type="text/plain")

class PackageSearchReq(BaseModel):
    query: str

@router.post("/packages/{pm_name}/search")
def search_packages(pm_name: str, req: PackageSearchReq):
    query = req.query
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    if pm_name == "winget":
        if not winget.is_winget_installed():
            raise HTTPException(status_code=404, detail="Winget not installed")
        results = winget.search_winget(query)
        return {"results": results}
    elif pm_name == "scoop":
        if not scoop.is_scoop_installed():
            raise HTTPException(status_code=404, detail="Scoop not installed")
        results = scoop.search_scoop(query)
        return {"results": results}
    elif pm_name == "choco":
        if not choco.is_choco_installed():
            raise HTTPException(status_code=404, detail="Chocolatey not installed")
        results = choco.search_choco(query)
        return {"results": results}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown package manager: {pm_name}")

class PackageActionReq(BaseModel):
    packages: List[str]

@router.post("/packages/{pm_name}/install")
def install_packages(pm_name: str, req: PackageActionReq):
    pkgs = req.packages
    if not pkgs:
        raise HTTPException(status_code=400, detail="No packages provided")
        
    def _do_install():
        if pm_name == "winget":
            winget.install_packages(pkgs)
        elif pm_name == "scoop":
            scoop.install_packages(pkgs)
        elif pm_name == "choco":
            choco.install_packages(pkgs)
        else:
            q = current_log_queue.get()
            if q: q.put("Unknown package manager\n")
            
    return StreamingResponse(stream_generator(_do_install), media_type="text/plain")

@router.post("/packages/{pm_name}/uninstall")
def uninstall_packages(pm_name: str, req: PackageActionReq):
    pkgs = req.packages
    if not pkgs:
        raise HTTPException(status_code=400, detail="No packages provided")
        
    def _do_uninstall():
        for pkg in pkgs:
            if pm_name == "winget":
                winget.uninstall_package(pkg)
            elif pm_name == "scoop":
                scoop.uninstall_package(pkg)
            elif pm_name == "choco":
                choco.uninstall_package(pkg)
            else:
                q = current_log_queue.get()
                if q: q.put("Unknown package manager\n")
            
    return StreamingResponse(stream_generator(_do_uninstall), media_type="text/plain")

@router.post("/packages/{pm_name}/update")
def update_packages(pm_name: str, req: PackageActionReq):
    pkgs = req.packages
    if not pkgs:
        raise HTTPException(status_code=400, detail="No packages provided")
        
    def _do_update():
        for pkg in pkgs:
            if pm_name == "winget":
                winget.update_package(pkg)
            elif pm_name == "scoop":
                scoop.update_package(pkg)
            elif pm_name == "choco":
                choco.update_package(pkg)
            else:
                q = current_log_queue.get()
                if q: q.put("Unknown package manager\n")
            
    return StreamingResponse(stream_generator(_do_update), media_type="text/plain")

@router.post("/packages/{pm_name}/upgrade-all")
def upgrade_all_packages(pm_name: str):
    def _do_upgrade():
        if pm_name == "winget":
            winget.upgrade_all()
        elif pm_name == "scoop":
            scoop.update_all()
        elif pm_name == "choco":
            choco.upgrade_all()
        else:
            q = current_log_queue.get()
            if q: q.put("Unknown package manager\n")
            
    return StreamingResponse(stream_generator(_do_upgrade), media_type="text/plain")

@router.post("/packages/scoop/update-manager")
def update_scoop_manager():
    def _do_update():
        scoop.update_scoop()
    return StreamingResponse(stream_generator(_do_update), media_type="text/plain")

@router.post("/packages/scoop/cleanup")
def cleanup_scoop_manager():
    success, log = scoop.cleanup_scoop()
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

# ==========================================
# Docker Manager Endpoints
# ==========================================
import utilities.util_docker as util_docker

@router.get("/docker/status")
def get_docker_status():
    success, client = util_docker.get_docker_client()
    return {"running": success, "message": str(client) if not success else "Connected to Docker"}

@router.post("/docker/start-daemon")
def start_docker_daemon():
    success, log = util_docker.start_docker_daemon()
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

@router.get("/docker/containers")
def list_docker_containers():
    success, data = util_docker.list_containers()
    if not success:
        raise HTTPException(status_code=500, detail=str(data))
    
    # We must sanitize the raw_obj out before sending JSON
    clean_data = []
    for c in data:
        c.pop('raw_obj', None)
        clean_data.append(c)
        
    return {"containers": clean_data}

@router.post("/docker/containers/{container_id}/{action}")
def container_action(container_id: str, action: str):
    if action not in ["start", "stop", "restart"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    success, log = util_docker.container_action(container_id, action)
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

@router.get("/docker/project/{project_name}")
def get_docker_project_file(project_name: str):
    success, data = util_docker.read_project_compose_file(project_name)
    if not success:
        raise HTTPException(status_code=404, detail=data)
    return {"content": data}

class ProjectConfigRequest(BaseModel):
    content: str

@router.post("/docker/project/{project_name}/config")
def update_docker_project_file(project_name: str, req: ProjectConfigRequest):
    success, msg = util_docker.save_project_compose_file(project_name, req.content)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}

@router.post("/docker/project/{project_name}/compose-up")
def compose_up_project(project_name: str):
    success, msg = util_docker.compose_up_no_recreate(project_name)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}

@router.post("/docker/project/{project_name}/compose-down")
def compose_down_project(project_name: str):
    success, msg = util_docker.compose_down_v(project_name)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}

# ==========================================
# Environment Variables Endpoints
# ==========================================
import utilities.util_env as util_env

@router.get("/env/path")
def get_env_paths():
    paths, sys_raw, user_raw = util_env.load_env_data()
    return {
        "paths": paths,
        "sys_raw": sys_raw,
        "user_raw": user_raw
    }

@router.post("/env/refresh")
def refresh_env_paths():
    util_env.force_refresh()
    return {"message": "Environment variables refreshed"}

@router.get("/env/export")
def export_env():
    data = util_env.export_env_backup()
    return PlainTextResponse(
        content=data, 
        headers={"Content-Disposition": "attachment; filename=env_backup.txt"}
    )

# ==========================================
# Services & Startup Endpoints
# ==========================================
import utilities.util_services as util_services

@router.get("/services/list")
def get_services_list():
    startup, ms, non_ms = util_services.load_services_data()
    return {
        "startup": startup,
        "ms": ms,
        "non_ms": non_ms
    }

@router.post("/services/refresh")
def refresh_services():
    util_services.force_refresh()
    return {"message": "Services refreshed"}

# ==========================================
# System & Network Monitor Endpoints
# ==========================================
import utilities.util_sys_monitor as util_sys_monitor
import utilities.util_network_monitor as util_network_monitor

@router.get("/monitor/stats")
def get_monitor_stats():
    stats = util_sys_monitor.get_system_stats()
    
    # top processes
    top_proc_df = util_sys_monitor.get_top_processes(limit=15)
    processes = top_proc_df.to_dict(orient="records") if not top_proc_df.empty else []
    
    # network connections
    connections = util_network_monitor.get_active_connections()
    
    return {
        "hardware": stats,
        "processes": processes,
        "network": connections[:50] # limit to top 50 to avoid huge payloads
    }

# ==========================================
# Ping & DNS Endpoints
# ==========================================
import utilities.util_ping as util_ping

class PingRequest(BaseModel):
    host: str
    count: int = 4
    ipv6: bool = False

@router.post("/ping/run")
def run_ping(req: PingRequest):
    success, log = util_ping.run_ping(req.host, req.count, req.ipv6)
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

class DnsSpeedRequest(BaseModel):
    preset_names: Optional[List[str]] = None

@router.post("/ping/dns-speeds")
def get_dns_speeds(req: DnsSpeedRequest):
    speeds = util_ping.check_all_dns_speeds(req.preset_names)
    return {"speeds": speeds}

@router.get("/ping/dns-presets")
def get_dns_presets():
    return {"presets": util_ping.get_dns_presets()}

@router.get("/ping/interfaces")
def get_interfaces():
    ifaces = util_ping.get_network_interfaces()
    return {"interfaces": ifaces}

class SetDnsRequest(BaseModel):
    interface_name: str
    primary: str
    secondary: str = ""

@router.post("/ping/set-dns")
def set_dns(req: SetDnsRequest):
    success, log = util_ping.set_windows_dns(req.interface_name, req.primary, req.secondary)
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

@router.get("/ports")
def get_open_ports():
    import psutil
    import socket
    ports = []
    
    try:
        connections = psutil.net_connections(kind='inet')
        for conn in connections:
            # We are interested in listening ports and established ones, but let's stick to 'LISTEN' or open UDP
            if conn.status == 'LISTEN' or conn.type == socket.SOCK_DGRAM:
                app_name = "Unknown"
                if conn.pid:
                    try:
                        process = psutil.Process(conn.pid)
                        app_name = process.name()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        app_name = "Access Denied / Unknown"
                
                ports.append({
                    "port": conn.laddr.port,
                    "ip": conn.laddr.ip,
                    "status": conn.status if conn.status else "OPEN",
                    "type": "TCP" if conn.type == socket.SOCK_STREAM else "UDP",
                    "pid": conn.pid,
                    "app": app_name
                })
        
        # Remove duplicates by port and type
        unique_ports = { (p["port"], p["ip"], p["type"]): p for p in ports }.values()
        sorted_ports = sorted(list(unique_ports), key=lambda x: x["port"])
        return {"ports": sorted_ports}
    except ImportError:
        raise HTTPException(status_code=500, detail="psutil module is not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# Bluetooth Tracker Endpoints
# ==========================================
import utilities.bluetooth_tracker as util_bt

@router.get("/bluetooth/status")
def get_bluetooth_status():
    return util_bt.get_status()

@router.get("/bluetooth/devices")
def get_bluetooth_devices():
    return {"devices": util_bt.get_devices()}

@router.get("/bluetooth/history/{mac}")
def get_bluetooth_history(mac: str):
    return {"history": util_bt.get_device_history(mac)}

@router.post("/bluetooth/clear")
def clear_bluetooth_history():
    return util_bt.clear_devices()

@router.post("/bluetooth/start")
async def start_bluetooth_tracking():
    return util_bt.start_tracking()

@router.post("/bluetooth/stop")
async def stop_bluetooth_tracking():
    return util_bt.stop_tracking()


class SetLocationRequest(BaseModel):
    lat: float
    lon: float

@router.post("/bluetooth/set-location")
def set_bluetooth_location(req: SetLocationRequest):
    return util_bt.set_manual_location(req.lat, req.lon)

from utilities.util_network import better_get
import urllib.parse

@router.get("/bluetooth/search-location")
def search_location(q: str):
    url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q)}&format=json&limit=5"
    res = better_get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"})
    if res and res.status_code == 200:
        return res.json()
    return []

# ==========================================
# Wi-Fi Mapper Endpoints
# ==========================================
import utilities.wifi_mapper as util_wifi

@router.get("/wifi/status")
def get_wifi_status():
    return util_wifi.get_status()

@router.get("/wifi/networks")
def get_wifi_networks():
    return {"networks": util_wifi.get_networks()}

@router.get("/wifi/history/{bssid}")
def get_wifi_history(bssid: str):
    return {"history": util_wifi.get_network_history(bssid)}

@router.post("/wifi/clear")
def clear_wifi_history():
    return util_wifi.clear_networks()

@router.post("/wifi/start")
async def start_wifi_tracking():
    return util_wifi.start_tracking()

@router.post("/wifi/stop")
async def stop_wifi_tracking():
    return util_wifi.stop_tracking()

@router.post("/wifi/set-location")
def set_wifi_location(req: SetLocationRequest):
    return util_wifi.set_manual_location(req.lat, req.lon)

# ==========================================
# LAN Radar Endpoints
# ==========================================
import utilities.lan_radar as util_lan

@router.get("/lan/status")
def get_lan_status():
    return util_lan.get_status()

@router.get("/lan/devices")
def get_lan_devices():
    return {"devices": util_lan.get_devices()}

@router.post("/lan/start")
async def start_lan_tracking():
    return util_lan.start_tracking()

@router.post("/lan/stop")
async def stop_lan_tracking():
    return util_lan.stop_tracking()

@router.post("/lan/clear")
def clear_lan_devices():
    import utilities.lan_radar as lr
    lr.clear_devices()
    return {"status": "cleared"}

# ==========================================
# Windows Tweaks
# ==========================================

@router.get("/tweaks")
def get_windows_tweaks():
    """Get the status of all Windows tweaks and their PowerShell scripts"""
    return {"tweaks": tweaks.get_all_tweaks()}

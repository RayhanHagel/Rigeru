from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional

from utilities.util_package_manager import load_local_cache, save_local_cache, fetch_all_fresh_data
import utilities.util_package_scoop as scoop
import utilities.util_package_winget as winget
import utilities.util_package_choco as choco

router = APIRouter(prefix="/api/system", tags=["System & Network"])

# ==========================================
# Static Storage Management
# ==========================================

@router.get("/static-storage/size")
def get_static_storage_size():
    import os
    static_dir = "static"
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
    static_dir = "static"
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

# ==========================================
# Package Manager Endpoints
# ==========================================

@router.get("/packages/cache")
def get_package_cache():
    """Returns the cached installed packages for all package managers."""
    cache = load_local_cache()
    return cache

@router.post("/packages/revalidate")
def revalidate_package_cache(background_tasks: BackgroundTasks):
    """Triggers a background fetch of all packages and updates the local cache."""
    def fetch_and_save():
        current_cache = load_local_cache()
        fresh_data = fetch_all_fresh_data(current_cache)
        save_local_cache(fresh_data)
        
    background_tasks.add_task(fetch_and_save)
    return {"message": "Revalidation started in the background"}

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
        
    if pm_name == "winget":
        success, log = winget.install_packages(pkgs)
    elif pm_name == "scoop":
        success, log = scoop.install_packages(pkgs)
    elif pm_name == "choco":
        success, log = choco.install_packages(pkgs)
    else:
        raise HTTPException(status_code=400, detail="Unknown package manager")
        
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

@router.post("/packages/{pm_name}/uninstall")
def uninstall_packages(pm_name: str, req: PackageActionReq):
    pkgs = req.packages
    if not pkgs:
        raise HTTPException(status_code=400, detail="No packages provided")
        
    # the util functions take a single package name for uninstall/update
    log_messages = []
    has_error = False
    
    for pkg in pkgs:
        if pm_name == "winget":
            success, log = winget.uninstall_package(pkg)
        elif pm_name == "scoop":
            success, log = scoop.uninstall_package(pkg)
        elif pm_name == "choco":
            success, log = choco.uninstall_package(pkg)
        else:
            raise HTTPException(status_code=400, detail="Unknown package manager")
            
        log_messages.append(log)
        if not success:
            has_error = True
            
    combined_log = "\n".join(log_messages)
    if has_error:
        raise HTTPException(status_code=500, detail=combined_log)
    return {"message": combined_log}

@router.post("/packages/{pm_name}/update")
def update_packages(pm_name: str, req: PackageActionReq):
    pkgs = req.packages
    if not pkgs:
        raise HTTPException(status_code=400, detail="No packages provided")
        
    log_messages = []
    has_error = False
    
    for pkg in pkgs:
        if pm_name == "winget":
            success, log = winget.update_package(pkg)
        elif pm_name == "scoop":
            success, log = scoop.update_package(pkg)
        elif pm_name == "choco":
            success, log = choco.update_package(pkg)
        else:
            raise HTTPException(status_code=400, detail="Unknown package manager")
            
        log_messages.append(log)
        if not success:
            has_error = True
            
    combined_log = "\n".join(log_messages)
    if has_error:
        raise HTTPException(status_code=500, detail=combined_log)
    return {"message": combined_log}

@router.post("/packages/{pm_name}/upgrade-all")
def upgrade_all_packages(pm_name: str):
    if pm_name == "winget":
        success, log = winget.upgrade_all()
    elif pm_name == "scoop":
        success, log = scoop.update_all()
    elif pm_name == "choco":
        success, log = choco.upgrade_all()
    else:
        raise HTTPException(status_code=400, detail="Unknown package manager")
        
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

@router.post("/packages/scoop/update-manager")
def update_scoop_manager():
    success, log = scoop.update_scoop()
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

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

# ==========================================
# Environment Variables Endpoints
# ==========================================
import utilities.util_env as util_env
from fastapi.responses import PlainTextResponse

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

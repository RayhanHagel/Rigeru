import os
import shutil
import queue
import threading
import socket
from typing import List, Optional, Dict, Any, Generator
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import BaseModel, Field

from utilities.system_network.util_package_manager import load_local_cache, save_local_cache, fetch_all_fresh_data
import utilities.system_network.util_package_scoop as scoop
import utilities.system_network.util_package_winget as winget
import utilities.system_network.util_package_choco as choco
import utilities.system_network.windows_tweaks as tweaks
from utilities.core.util_stream import current_log_queue
import utilities.system_network.util_docker as util_docker
import utilities.system_network.util_env as util_env
import utilities.system_network.util_services as util_services
import utilities.system_network.util_sys_monitor as util_sys_monitor
import utilities.system_network.util_network_monitor as util_network_monitor
import utilities.system_network.util_ping as util_ping
import utilities.system_network.bluetooth_tracker as util_bt
from utilities.system_network.util_tracker import search_nominatim
import utilities.system_network.wifi_mapper as util_wifi
import utilities.system_network.lan_radar as util_lan

router = APIRouter(prefix="/api/system", tags=["System & Network"])

def stream_generator(func: Any, *args: Any, **kwargs: Any) -> Generator[str, None, None]:
    """
    Run a blocking callable inside a worker thread and stream log output to the client.

    Args:
        func (Any): Target callable to execute in background thread.
        *args: Positional arguments forwarded to func.
        **kwargs: Keyword arguments forwarded to func.

    Yields:
        str: Log lines emitted by the function.

    Returns:
        Generator[str, None, None]: Text generator streaming live logs.
    """
    q: queue.Queue = queue.Queue()
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

# ==========================================
# Static Storage Management
# ==========================================

@router.get("/static-storage/size")
def get_static_storage_size() -> Dict[str, Any]:
    """
    Calculate the total size and file count of cached static media files on disk.

    Returns:
        Dict[str, Any]: Size in bytes and human-readable string representation (`{"size_bytes": int, "size_str": str}`).
    """
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
                
    size_str = f"{total_size} B"
    if total_size > 1024 * 1024 * 1024:
        size_str = f"{total_size / (1024 * 1024 * 1024):.2f} GB"
    elif total_size > 1024 * 1024:
        size_str = f"{total_size / (1024 * 1024):.2f} MB"
    elif total_size > 1024:
        size_str = f"{total_size / 1024:.2f} KB"
        
    return {"size_bytes": total_size, "size_str": size_str}

@router.delete("/static-storage/clear")
def clear_static_storage() -> Dict[str, str]:
    """
    Delete all cached static media files from the static directory.

    Returns:
        Dict[str, str]: Confirmation message with deleted item count.

    Raises:
        HTTPException: 500 if filesystem deletion fails.
    """
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
                    except Exception:
                        pass
        return {"message": f"Cleared {deleted_count} static media files."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear static storage: {str(e)}")

@router.get("/temp-storage/size")
def get_temp_storage_size() -> Dict[str, Any]:
    """
    Calculate the total disk space consumed by temporary processing files in the temp directory.

    Returns:
        Dict[str, Any]: Total bytes and formatted size string (`{"size_bytes": int, "size_str": str}`).
    """
    temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "temp")
    if not os.path.exists(temp_dir):
        return {"size_bytes": 0, "size_str": "0 B"}
    
    total_size = 0
    for dirpath, _, filenames in os.walk(temp_dir):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
                
    size_str = f"{total_size} B"
    if total_size > 1024 * 1024 * 1024:
        size_str = f"{total_size / (1024 * 1024 * 1024):.2f} GB"
    elif total_size > 1024 * 1024:
        size_str = f"{total_size / (1024 * 1024):.2f} MB"
    elif total_size > 1024:
        size_str = f"{total_size / 1024:.2f} KB"
        
    return {"size_bytes": total_size, "size_str": size_str}

@router.delete("/temp-storage/clear")
def clear_temp_storage() -> Dict[str, str]:
    """
    Remove all temporary processing files and subdirectories from the temp folder.

    Returns:
        Dict[str, str]: Confirmation message with deleted item count.

    Raises:
        HTTPException: 500 if clearing fails.
    """
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
def get_package_cache() -> Dict[str, Any]:
    """
    Retrieve cached inventory of installed packages across Winget, Scoop, and Chocolatey.

    Returns:
        Dict[str, Any]: Mapping of package manager names to installed application lists.
    """
    return load_local_cache()

@router.post("/packages/revalidate")
def revalidate_package_cache() -> StreamingResponse:
    """
    Stream live CLI execution refreshing package inventory across all installed package managers.

    Returns:
        StreamingResponse: Text/plain stream of scanner output.
    """
    def _do_revalidate():
        current_cache = load_local_cache()
        fresh_data = fetch_all_fresh_data(current_cache)
        save_local_cache(fresh_data)
    return StreamingResponse(stream_generator(_do_revalidate), media_type="text/plain")

class PackageSearchReq(BaseModel):
    query: str = Field(..., min_length=1, description="Application or package name to search.")

@router.post("/packages/{pm_name}/search")
def search_packages(pm_name: str, req: PackageSearchReq) -> Dict[str, List[Dict[str, Any]]]:
    """
    Search online repositories for available packages via a specified manager (winget, scoop, choco).

    Args:
        pm_name (str): Package manager name ('winget', 'scoop', or 'choco').
        req (PackageSearchReq): Search query.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Matching packages and versions (`{"results": [...]}`).

    Raises:
        HTTPException: 400 if pm_name invalid, 404 if package manager CLI is not installed.
    """
    clean_query = req.query.strip()
    if not clean_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    pm = pm_name.strip().lower()
    if pm == "winget":
        if not winget.is_winget_installed():
            raise HTTPException(status_code=404, detail="Winget not installed")
        results = winget.search_winget(clean_query)
        return {"results": results}
    elif pm == "scoop":
        if not scoop.is_scoop_installed():
            raise HTTPException(status_code=404, detail="Scoop not installed")
        results = scoop.search_scoop(clean_query)
        return {"results": results}
    elif pm == "choco":
        if not choco.is_choco_installed():
            raise HTTPException(status_code=404, detail="Chocolatey not installed")
        results = choco.search_choco(clean_query)
        return {"results": results}
    else:
        raise HTTPException(status_code=400, detail=f"Unknown package manager: {pm_name}")

class PackageActionReq(BaseModel):
    packages: List[str] = Field(..., min_items=1, description="List of package identifiers to operate on.")

@router.post("/packages/{pm_name}/install")
def install_packages(pm_name: str, req: PackageActionReq) -> StreamingResponse:
    """
    Stream live terminal output while installing selected packages.

    Args:
        pm_name (str): Package manager ('winget', 'scoop', 'choco').
        req (PackageActionReq): Package identifiers to install.

    Returns:
        StreamingResponse: Text/plain CLI output stream.

    Raises:
        HTTPException: 400 if package list is empty.
    """
    pkgs = [p.strip() for p in req.packages if p.strip()]
    if not pkgs:
        raise HTTPException(status_code=400, detail="No packages provided")
        
    pm = pm_name.strip().lower()
    def _do_install():
        if pm == "winget":
            winget.install_packages(pkgs)
        elif pm == "scoop":
            scoop.install_packages(pkgs)
        elif pm == "choco":
            choco.install_packages(pkgs)
        else:
            q = current_log_queue.get()
            if q:
                q.put("Unknown package manager\n")
            
    return StreamingResponse(stream_generator(_do_install), media_type="text/plain")

@router.post("/packages/{pm_name}/uninstall")
def uninstall_packages(pm_name: str, req: PackageActionReq) -> StreamingResponse:
    """
    Stream live terminal output while uninstalling selected packages.

    Args:
        pm_name (str): Package manager ('winget', 'scoop', 'choco').
        req (PackageActionReq): Package identifiers to uninstall.

    Returns:
        StreamingResponse: Text/plain CLI output stream.

    Raises:
        HTTPException: 400 if package list is empty.
    """
    pkgs = [p.strip() for p in req.packages if p.strip()]
    if not pkgs:
        raise HTTPException(status_code=400, detail="No packages provided")
        
    pm = pm_name.strip().lower()
    def _do_uninstall():
        for pkg in pkgs:
            if pm == "winget":
                winget.uninstall_package(pkg)
            elif pm == "scoop":
                scoop.uninstall_package(pkg)
            elif pm == "choco":
                choco.uninstall_package(pkg)
            else:
                q = current_log_queue.get()
                if q:
                    q.put("Unknown package manager\n")
            
    return StreamingResponse(stream_generator(_do_uninstall), media_type="text/plain")

@router.post("/packages/{pm_name}/update")
def update_packages(pm_name: str, req: PackageActionReq) -> StreamingResponse:
    """
    Stream live terminal output while upgrading selected packages to their latest versions.

    Args:
        pm_name (str): Package manager ('winget', 'scoop', 'choco').
        req (PackageActionReq): Target package identifiers.

    Returns:
        StreamingResponse: Text/plain CLI output stream.

    Raises:
        HTTPException: 400 if package list is empty.
    """
    pkgs = [p.strip() for p in req.packages if p.strip()]
    if not pkgs:
        raise HTTPException(status_code=400, detail="No packages provided")
        
    pm = pm_name.strip().lower()
    def _do_update():
        for pkg in pkgs:
            if pm == "winget":
                winget.update_package(pkg)
            elif pm == "scoop":
                scoop.update_package(pkg)
            elif pm == "choco":
                choco.update_package(pkg)
            else:
                q = current_log_queue.get()
                if q:
                    q.put("Unknown package manager\n")
            
    return StreamingResponse(stream_generator(_do_update), media_type="text/plain")

@router.post("/packages/{pm_name}/upgrade-all")
def upgrade_all_packages(pm_name: str) -> StreamingResponse:
    """
    Upgrade all outdated packages managed by a specific package manager.

    Args:
        pm_name (str): Package manager name ('winget', 'scoop', 'choco').

    Returns:
        StreamingResponse: Text/plain CLI output stream.
    """
    pm = pm_name.strip().lower()
    def _do_upgrade():
        if pm == "winget":
            winget.upgrade_all()
        elif pm == "scoop":
            scoop.update_all()
        elif pm == "choco":
            choco.upgrade_all()
        else:
            q = current_log_queue.get()
            if q:
                q.put("Unknown package manager\n")
            
    return StreamingResponse(stream_generator(_do_upgrade), media_type="text/plain")

@router.post("/packages/scoop/update-manager")
def update_scoop_manager() -> StreamingResponse:
    """
    Stream live output from updating the Scoop package manager itself and its bucket manifests.

    Returns:
        StreamingResponse: Text/plain CLI output stream.
    """
    def _do_update():
        scoop.update_scoop()
    return StreamingResponse(stream_generator(_do_update), media_type="text/plain")

@router.post("/packages/scoop/cleanup")
def cleanup_scoop_manager() -> Dict[str, str]:
    """
    Purge outdated package cache archives and old application builds managed by Scoop.

    Returns:
        Dict[str, str]: Log summary of cleaned files.

    Raises:
        HTTPException: 500 if cleanup command fails.
    """
    success, log = scoop.cleanup_scoop()
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

# ==========================================
# Docker Manager Endpoints
# ==========================================

@router.get("/docker/status")
def get_docker_status() -> Dict[str, Any]:
    """
    Check if the Docker daemon service is running and accessible via Docker socket.

    Returns:
        Dict[str, Any]: Operational status and diagnostic message (`{"running": bool, "message": str}`).
    """
    success, client = util_docker.get_docker_client()
    return {"running": success, "message": str(client) if not success else "Connected to Docker"}

@router.post("/docker/start-daemon")
def start_docker_daemon() -> Dict[str, str]:
    """
    Attempt to launch Docker Desktop or start the Docker Windows service.

    Returns:
        Dict[str, str]: Launch confirmation message.

    Raises:
        HTTPException: 500 if daemon fails to start.
    """
    success, log = util_docker.start_docker_daemon()
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

@router.get("/docker/containers")
def list_docker_containers() -> Dict[str, List[Dict[str, Any]]]:
    """
    List all local Docker containers including running, stopped, and exited instances.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Array of container objects with names, IDs, image, and status.

    Raises:
        HTTPException: 500 if Docker daemon query fails.
    """
    success, data = util_docker.list_containers()
    if not success:
        raise HTTPException(status_code=500, detail=str(data))
    
    clean_data = []
    for c in data:
        c.pop('raw_obj', None)
        clean_data.append(c)
        
    return {"containers": clean_data}

@router.post("/docker/containers/{container_id}/{action}")
def container_action(container_id: str, action: str) -> Dict[str, str]:
    """
    Execute lifecycle command (start, stop, restart) on a specific container.

    Args:
        container_id (str): Container name or ID.
        action (str): Target action ('start', 'stop', 'restart').

    Returns:
        Dict[str, str]: Status message confirming operation.

    Raises:
        HTTPException: 400 if action is invalid, 500 on container runtime error.
    """
    act = action.strip().lower()
    if act not in ["start", "stop", "restart"]:
        raise HTTPException(status_code=400, detail="Invalid action: expected start, stop, or restart")
    clean_id = container_id.strip()
    success, log = util_docker.container_action(clean_id, act)
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

@router.get("/docker/project/{project_name}")
def get_docker_project_file(project_name: str) -> Dict[str, str]:
    """
    Read the docker-compose.yml configuration file for a managed project.

    Args:
        project_name (str): Name of the compose project.

    Returns:
        Dict[str, str]: Raw YAML file text (`{"content": str}`).

    Raises:
        HTTPException: 404 if project compose file does not exist.
    """
    clean_name = project_name.strip()
    success, data = util_docker.read_project_compose_file(clean_name)
    if not success:
        raise HTTPException(status_code=404, detail=data)
    return {"content": data}

class ProjectConfigRequest(BaseModel):
    content: str = Field(..., min_length=1, description="Raw YAML docker-compose configuration content.")

@router.post("/docker/project/{project_name}/config")
def update_docker_project_file(project_name: str, req: ProjectConfigRequest) -> Dict[str, str]:
    """
    Save updated docker-compose.yml configuration for a project.

    Args:
        project_name (str): Compose project identifier.
        req (ProjectConfigRequest): Updated YAML content.

    Returns:
        Dict[str, str]: Status message confirming file update.

    Raises:
        HTTPException: 500 if saving file fails.
    """
    clean_name = project_name.strip()
    success, msg = util_docker.save_project_compose_file(clean_name, req.content)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}

@router.post("/docker/project/{project_name}/compose-up")
def compose_up_project(project_name: str) -> Dict[str, str]:
    """
    Run `docker compose up -d` for a managed project.

    Args:
        project_name (str): Project identifier.

    Returns:
        Dict[str, str]: Status message from Docker compose execution.

    Raises:
        HTTPException: 500 if compose up fails.
    """
    clean_name = project_name.strip()
    success, msg = util_docker.compose_up_no_recreate(clean_name)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}

@router.post("/docker/project/{project_name}/compose-down")
def compose_down_project(project_name: str) -> Dict[str, str]:
    """
    Run `docker compose down -v` to stop and dismantle project containers.

    Args:
        project_name (str): Project identifier.

    Returns:
        Dict[str, str]: Status message from Docker compose execution.

    Raises:
        HTTPException: 500 if compose down fails.
    """
    clean_name = project_name.strip()
    success, msg = util_docker.compose_down_v(clean_name)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}

# ==========================================
# Environment Variables Endpoints
# ==========================================

@router.get("/env/path")
def get_env_paths() -> Dict[str, Any]:
    """
    Inspect system and user Windows PATH environment variables and individual directory entries.

    Returns:
        Dict[str, Any]: Cleaned path lists, system raw string, and user raw string.
    """
    paths, sys_raw, user_raw = util_env.load_env_data()
    return {
        "paths": paths,
        "sys_raw": sys_raw,
        "user_raw": user_raw
    }

@router.post("/env/refresh")
def refresh_env_paths() -> Dict[str, str]:
    """
    Force reload the Windows registry environment variables into current process cache.

    Returns:
        Dict[str, str]: Confirmation message (`{"message": str}`).
    """
    util_env.force_refresh()
    return {"message": "Environment variables refreshed"}

@router.get("/env/export")
def export_env() -> PlainTextResponse:
    """
    Export current user and system PATH environment variables as a downloadable backup text file.

    Returns:
        PlainTextResponse: Formatted backup text file.
    """
    data = util_env.export_env_backup()
    return PlainTextResponse(
        content=data, 
        headers={"Content-Disposition": "attachment; filename=env_backup.txt"}
    )

# ==========================================
# Services & Startup Endpoints
# ==========================================

@router.get("/services/list")
def get_services_list() -> Dict[str, Any]:
    """
    Retrieve lists of Windows background services, startup applications, and Microsoft vs third-party services.

    Returns:
        Dict[str, Any]: Startup entries, Microsoft services, and third-party services.
    """
    startup, ms, non_ms = util_services.load_services_data()
    return {
        "startup": startup,
        "ms": ms,
        "non_ms": non_ms
    }

@router.post("/services/refresh")
def refresh_services() -> Dict[str, str]:
    """
    Force re-query Windows Service Control Manager and startup registry keys.

    Returns:
        Dict[str, str]: Status message (`{"message": str}`).
    """
    util_services.force_refresh()
    return {"message": "Services refreshed"}

# ==========================================
# System & Network Monitor Endpoints
# ==========================================

@router.get("/monitor/stats")
def get_monitor_stats() -> Dict[str, Any]:
    """
    Collect real-time CPU, RAM, disk, active process metrics, and socket connections.

    Returns:
        Dict[str, Any]: Hardware metrics, top processes list, and active network connections.
    """
    stats = util_sys_monitor.get_system_stats()
    top_proc_df = util_sys_monitor.get_top_processes(limit=15)
    processes = top_proc_df.to_dict(orient="records") if not top_proc_df.empty else []
    connections = util_network_monitor.get_active_connections()
    
    return {
        "hardware": stats,
        "processes": processes,
        "network": connections[:50]
    }

# ==========================================
# Ping & DNS Endpoints
# ==========================================

class PingRequest(BaseModel):
    host: str = Field(..., min_length=1, description="Hostname or IP address to ping.")
    count: int = Field(4, ge=1, le=20, description="Ping echo packet count.")
    ipv6: bool = Field(False, description="Use IPv6 addressing.")

@router.post("/ping/run")
def run_ping(req: PingRequest) -> Dict[str, str]:
    """
    Execute ICMP ping against a target domain or IP address.

    Args:
        req (PingRequest): Host, count, and IPv6 preference.

    Returns:
        Dict[str, str]: Raw ping execution text output.

    Raises:
        HTTPException: 500 if ping command fails.
    """
    clean_host = req.host.strip()
    if not clean_host:
        raise HTTPException(status_code=400, detail="Host cannot be empty.")
    success, log = util_ping.run_ping(clean_host, req.count, req.ipv6)
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

class DnsSpeedRequest(BaseModel):
    preset_names: Optional[List[str]] = Field(None, description="Optional subset of DNS resolver presets to benchmark.")

@router.post("/ping/dns-speeds")
def get_dns_speeds(req: DnsSpeedRequest) -> Dict[str, Any]:
    """
    Benchmark response latency across major public DNS providers (Cloudflare, Google, Quad9, etc.).

    Args:
        req (DnsSpeedRequest): Optional list of provider preset names.

    Returns:
        Dict[str, Any]: Benchmark latency metrics mapping (`{"speeds": [...]}`).
    """
    speeds = util_ping.check_all_dns_speeds(req.preset_names)
    return {"speeds": speeds}

@router.get("/ping/dns-presets")
def get_dns_presets() -> Dict[str, Any]:
    """
    List known public DNS resolver presets with primary and secondary IP addresses.

    Returns:
        Dict[str, Any]: Public DNS presets dictionary.
    """
    return {"presets": util_ping.get_dns_presets()}

@router.get("/ping/interfaces")
def get_interfaces() -> Dict[str, List[str]]:
    """
    List active network adapter interface names on the host machine.

    Returns:
        Dict[str, List[str]]: Array of adapter names.
    """
    ifaces = util_ping.get_network_interfaces()
    return {"interfaces": ifaces}

class SetDnsRequest(BaseModel):
    interface_name: str = Field(..., min_length=1, description="Network adapter name (e.g., 'Ethernet' or 'Wi-Fi').")
    primary: str = Field(..., min_length=7, description="Primary DNS server IPv4 address.")
    secondary: str = Field("", description="Optional secondary DNS server IPv4 address.")

@router.post("/ping/set-dns")
def set_dns(req: SetDnsRequest) -> Dict[str, str]:
    """
    Configure static DNS server IP addresses for a Windows network adapter.

    Args:
        req (SetDnsRequest): Adapter name and DNS IP addresses.

    Returns:
        Dict[str, str]: Confirmation status message.

    Raises:
        HTTPException: 500 if netsh DNS configuration fails.
    """
    clean_iface = req.interface_name.strip()
    clean_pri = req.primary.strip()
    clean_sec = req.secondary.strip()
    if not clean_iface or not clean_pri:
        raise HTTPException(status_code=400, detail="Interface name and primary DNS IP are required.")

    success, log = util_ping.set_windows_dns(clean_iface, clean_pri, clean_sec)
    if not success:
        raise HTTPException(status_code=500, detail=log)
    return {"message": log}

@router.get("/ports")
def get_open_ports() -> Dict[str, List[Dict[str, Any]]]:
    """
    Scan local TCP and UDP listening ports and correlate with owning application processes.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Array of open ports with IP, type, PID, and application name.

    Raises:
        HTTPException: 500 if socket query fails.
    """
    import psutil
    ports = []
    
    try:
        connections = psutil.net_connections(kind='inet')
        for conn in connections:
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
        
        unique_ports = { (p["port"], p["ip"], p["type"]): p for p in ports }.values()
        sorted_ports = sorted(list(unique_ports), key=lambda x: x["port"])
        return {"ports": sorted_ports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# Bluetooth Tracker Endpoints
# ==========================================

@router.get("/bluetooth/status")
def get_bluetooth_status() -> Dict[str, Any]:
    """
    Check if the Bluetooth background scanning worker is actively recording beacon signals.

    Returns:
        Dict[str, Any]: Scanner status dictionary (`{"scanning": bool}`).
    """
    return util_bt.get_status()

@router.get("/bluetooth/devices")
def get_bluetooth_devices() -> Dict[str, List[Dict[str, Any]]]:
    """
    Retrieve all detected Bluetooth devices and BLE beacons from the SQLite store.

    Returns:
        Dict[str, List[Dict[str, Any]]]: List of discovered devices with MAC, RSSI, and location.
    """
    return {"devices": util_bt.get_devices()}

@router.get("/bluetooth/history/{mac}")
def get_bluetooth_history(mac: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Fetch signal strength and GPS location timestamp history for a specific Bluetooth MAC address.

    Args:
        mac (str): Device MAC address.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Historical signal records for device.
    """
    clean_mac = mac.strip()
    return {"history": util_bt.get_device_history(clean_mac)}

@router.post("/bluetooth/clear")
def clear_bluetooth_history() -> Dict[str, str]:
    """
    Clear all logged Bluetooth devices and signal sightings from the SQLite database.

    Returns:
        Dict[str, str]: Status confirmation message.
    """
    return util_bt.clear_devices()

@router.post("/bluetooth/start")
async def start_bluetooth_tracking() -> Dict[str, str]:
    """
    Start the background Bluetooth low-energy scanner.

    Returns:
        Dict[str, str]: Scanner state confirmation.
    """
    return util_bt.start_tracking()

@router.post("/bluetooth/stop")
async def stop_bluetooth_tracking() -> Dict[str, str]:
    """
    Stop the background Bluetooth low-energy scanner.

    Returns:
        Dict[str, str]: Scanner state confirmation.
    """
    return util_bt.stop_tracking()

class SetLocationRequest(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate.")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate.")

@router.post("/bluetooth/set-location")
def set_bluetooth_location(req: SetLocationRequest) -> Dict[str, Any]:
    """
    Manually set the current host GPS coordinates for Bluetooth beacon geolocation tagging.

    Args:
        req (SetLocationRequest): Latitude and longitude.

    Returns:
        Dict[str, Any]: Stored coordinate acknowledgment.
    """
    return util_bt.set_manual_location(req.lat, req.lon)

@router.get("/bluetooth/search-location")
def search_location_bluetooth(q: str = Query(..., min_length=2, description="Address or city search query")) -> List[Dict[str, Any]]:
    """
    Geocode an address or city name via OpenStreetMap Nominatim for Bluetooth positioning.

    Args:
        q (str): Address or place query.

    Returns:
        List[Dict[str, Any]]: Geocoded location matches with lat/lon coordinates.
    """
    clean_q = q.strip()
    return search_nominatim(clean_q)

@router.get("/wifi/search-location")
def search_location_wifi(q: str = Query(..., min_length=2, description="Address or city search query")) -> List[Dict[str, Any]]:
    """
    Geocode an address or city name via OpenStreetMap Nominatim for Wi-Fi heatmapping.

    Args:
        q (str): Address or place query.

    Returns:
        List[Dict[str, Any]]: Geocoded location matches with lat/lon coordinates.
    """
    clean_q = q.strip()
    return search_nominatim(clean_q)

# ==========================================
# Wi-Fi Mapper Endpoints
# ==========================================

@router.get("/wifi/status")
def get_wifi_status() -> Dict[str, Any]:
    """
    Check if the background Wi-Fi scanner is actively mapping access points.

    Returns:
        Dict[str, Any]: Scanner status dictionary (`{"scanning": bool}`).
    """
    return util_wifi.get_status()

@router.get("/wifi/networks")
def get_wifi_networks() -> Dict[str, List[Dict[str, Any]]]:
    """
    Retrieve all detected Wi-Fi BSSIDs, SSIDs, and signal metrics from the SQLite store.

    Returns:
        Dict[str, List[Dict[str, Any]]]: List of mapped Wi-Fi networks.
    """
    return {"networks": util_wifi.get_networks()}

@router.get("/wifi/history/{bssid}")
def get_wifi_history(bssid: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Fetch historical signal RSSI sightings and coordinates for a specific Wi-Fi BSSID.

    Args:
        bssid (str): Access point BSSID / MAC.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Historical signal records for BSSID.
    """
    clean_bssid = bssid.strip()
    return {"history": util_wifi.get_network_history(clean_bssid)}

@router.post("/wifi/clear")
def clear_wifi_history() -> Dict[str, str]:
    """
    Delete all mapped Wi-Fi access points and sightings from SQLite database.

    Returns:
        Dict[str, str]: Status confirmation message.
    """
    return util_wifi.clear_networks()

@router.post("/wifi/start")
async def start_wifi_tracking() -> Dict[str, str]:
    """
    Start periodic background Wi-Fi network beacon scanning.

    Returns:
        Dict[str, str]: Scanner state confirmation.
    """
    return util_wifi.start_tracking()

@router.post("/wifi/stop")
async def stop_wifi_tracking() -> Dict[str, str]:
    """
    Stop periodic background Wi-Fi network beacon scanning.

    Returns:
        Dict[str, str]: Scanner state confirmation.
    """
    return util_wifi.stop_tracking()

@router.post("/wifi/set-location")
def set_wifi_location(req: SetLocationRequest) -> Dict[str, Any]:
    """
    Manually set the current host GPS coordinates for Wi-Fi access point wardriving heatmaps.

    Args:
        req (SetLocationRequest): Latitude and longitude.

    Returns:
        Dict[str, Any]: Stored coordinate acknowledgment.
    """
    return util_wifi.set_manual_location(req.lat, req.lon)

# ==========================================
# LAN Radar Endpoints
# ==========================================

@router.get("/lan/status")
def get_lan_status() -> Dict[str, Any]:
    """
    Check if the local ARP network scanner is actively running.

    Returns:
        Dict[str, Any]: Radar status dictionary (`{"scanning": bool}`).
    """
    return util_lan.get_status()

@router.get("/lan/devices")
def get_lan_devices() -> Dict[str, List[Dict[str, Any]]]:
    """
    List all detected network devices on the local subnet with IP, MAC, and vendor hostname.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Discovered LAN devices list.
    """
    return {"devices": util_lan.get_devices()}

@router.post("/lan/start")
async def start_lan_tracking() -> Dict[str, str]:
    """
    Start continuous ARP subnet radar ping scanning.

    Returns:
        Dict[str, str]: Radar status confirmation.
    """
    return util_lan.start_tracking()

@router.post("/lan/stop")
async def stop_lan_tracking() -> Dict[str, str]:
    """
    Stop continuous ARP subnet radar ping scanning.

    Returns:
        Dict[str, str]: Radar status confirmation.
    """
    return util_lan.stop_tracking()

@router.post("/lan/clear")
def clear_lan_devices() -> Dict[str, str]:
    """
    Clear all discovered LAN devices from the active memory cache.

    Returns:
        Dict[str, str]: Status confirmation message (`{"status": "cleared"}`).
    """
    util_lan.clear_devices()
    return {"status": "cleared"}

# ==========================================
# Windows Tweaks
# ==========================================

@router.get("/tweaks")
def get_windows_tweaks() -> Dict[str, List[Dict[str, Any]]]:
    """
    Inspect the applied/unapplied status of all Windows optimization tweaks and PowerShell scripts.

    Returns:
        Dict[str, List[Dict[str, Any]]]: Array of tweak definitions and current states.
    """
    return {"tweaks": tweaks.get_all_tweaks()}

import os
import threading
from utilities.util_store import get_data, set_data

def get_registry_startup() -> list[dict]:
    """Retrieves a list of applications configured to run at startup via the Windows Registry."""
    import winreg
    apps = []
    keys = [
        (winreg.HKEY_CURRENT_USER,
         r"Software\Microsoft\Windows\CurrentVersion\Run", "User"),
        (winreg.HKEY_LOCAL_MACHINE,
         r"Software\Microsoft\Windows\CurrentVersion\Run", "System")
    ]
    for hkey, subkey, scope in keys:
        try:
            reg = winreg.OpenKey(hkey, subkey, 0, winreg.KEY_READ)
            for i in range(1024):
                try:
                    name, value, _ = winreg.EnumValue(reg, i)
                    apps.append({"Name": name, "Path": value, "Scope": scope})
                except OSError:
                    break
            winreg.CloseKey(reg)
        except OSError:
            pass
    return apps


def get_service_dependencies(service_name: str) -> str:
    """Queries the Windows Service Control Manager to retrieve dependencies for a specific service."""
    import win32service
    try:
        scm = win32service.OpenSCManager(
            None, None, win32service.SC_MANAGER_CONNECT)
        svc = win32service.OpenService(
            scm, service_name, win32service.SERVICE_QUERY_CONFIG)
        config = win32service.QueryServiceConfig(svc)
        win32service.CloseServiceHandle(svc)
        win32service.CloseServiceHandle(scm)

        deps = config[7]
        if not deps:
            return "None"
        if isinstance(deps, str):
            return deps.replace("\x00", " ").strip()
        elif isinstance(deps, list) or isinstance(deps, tuple):
            return ", ".join(deps).replace("\x00", " ").strip()
        return "Unknown"
    except Exception:
        return "Unknown"


def get_windows_services() -> list[dict]:
    """Retrieves a comprehensive list of all Windows services and their current status."""
    import psutil
    services = []
    for svc in psutil.win_service_iter():
        try:
            info = svc.as_dict()
            svc_name = info.get('name', 'Unknown')

            deps = get_service_dependencies(svc_name)
            
            services.append({
                "Service Name": svc_name,
                "Display Name": info.get('display_name', ''),
                "Status": info.get('status', ''),
                "Start Type": info.get('start_type', ''),
                "Purpose (Description)": info.get('description', ''),
                "Dependencies": deps,
                "Path": info.get('binpath', '')
            })
        except psutil.NoSuchProcess:
            pass
        except Exception:
            pass
    return services


def fetch_and_cache_services():
    """Fetches both startup applications and Windows services, caching them to the store."""
    try:
        startup_apps = get_registry_startup()
        services = get_windows_services()

        ms_services = []
        non_ms_services = []
        for svc in services:
            desc = str(svc.get("Purpose (Description)", "")).lower()
            disp = str(svc.get("Display Name", "")).lower()
            path = str(svc.get("Path", "")).lower()
            
            if "microsoft" in desc or "microsoft" in disp or "windows" in disp or "system32" in path or "svchost.exe" in path:
                ms_services.append(svc)
            else:
                non_ms_services.append(svc)

        data = {
            "startup_apps": startup_apps,
            "ms_services": ms_services,
            "non_ms_services": non_ms_services
        }
        set_data("startup_services", data)
    except Exception as e:
        print(f"Failed to cache services: {e}")


def load_services_data() -> tuple[list[dict], list[dict], list[dict]]:
    """Loads services and startup apps from the store, triggering a background refresh."""
    data = get_data("startup_services")
    
    if data and "ms_services" in data:
        # Trigger background refresh if we already have stale cache
        threading.Thread(target=fetch_and_cache_services, daemon=True).start()
        return data.get("startup_apps", []), data.get("ms_services", []), data.get("non_ms_services", [])
        
    # Block and fetch if cache doesn't exist
    fetch_and_cache_services()
    data = get_data("startup_services") or {}
    return data.get("startup_apps", []), data.get("ms_services", []), data.get("non_ms_services", [])


def force_refresh_services():
    """Forces an immediate, blocking refresh of the services cache."""
    fetch_and_cache_services()

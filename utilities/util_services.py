import os
import json
import threading

CACHE_DIR = "./cache/services"
CACHE_FILE = os.path.join(CACHE_DIR, "cache.json")


def get_registry_startup() -> list[dict]:
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
            return deps
        if isinstance(deps, (list, tuple)):
            return ", ".join(deps)
        return str(deps)
    except Exception:
        return "Unknown"


def get_all_services_sync() -> tuple[list[dict], list[dict]]:
    import psutil
    ms_services = []
    non_ms_services = []

    for svc in psutil.win_service_iter():
        try:
            info = svc.as_dict()
            binpath = str(info.get('binpath', '')).lower()
            desc = str(info.get('description', 'No description provided.'))
            display = str(info.get('display_name', info.get('name')))
            name = info.get('name')

            is_ms = any(x in binpath for x in ["windows\\system32", "svchost.exe"]
                        ) or "microsoft" in display.lower() or "microsoft" in desc.lower()

            data = {
                "Service Name": name,
                "Display Name": display,
                "Status": info.get('status', 'unknown').capitalize(),
                "Start Type": info.get('start_type', 'unknown').capitalize(),
                "Dependencies": get_service_dependencies(name),
                "Path": info.get('binpath', 'Unknown'),
                "Purpose (Description)": desc
            }

            if is_ms:
                ms_services.append(data)
            else:
                non_ms_services.append(data)
        except Exception:
            pass

    ms_services.sort(key=lambda x: x['Display Name'])
    non_ms_services.sort(key=lambda x: x['Display Name'])

    return ms_services, non_ms_services


def fetch_and_cache():
    os.makedirs(CACHE_DIR, exist_ok=True)
    startup = get_registry_startup()
    ms, non_ms = get_all_services_sync()
    data = {"startup": startup, "ms": ms, "non_ms": non_ms}
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f)


def load_services_data() -> tuple[list[dict], list[dict], list[dict]]:
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r") as f:
            try:
                data = json.load(f)
                threading.Thread(target=fetch_and_cache, daemon=True).start()
                return data.get("startup", []), data.get("ms", []), data.get("non_ms", [])
            except json.JSONDecodeError:
                pass

    fetch_and_cache()
    with open(CACHE_FILE, "r") as f:
        data = json.load(f)
    return data.get("startup", []), data.get("ms", []), data.get("non_ms", [])


def force_refresh():
    fetch_and_cache()

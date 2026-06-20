import winreg
import psutil
import streamlit as st
import win32service


def get_registry_startup() -> list[dict]:
    """Fetches applications set to run on boot via the Registry."""
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
                except EnvironmentError:
                    break
            winreg.CloseKey(reg)
        except WindowsError:
            pass
    return apps


def get_service_dependencies(service_name: str) -> str:
    """Safely queries the Windows Service Control Manager for dependencies."""
    try:
        scm = win32service.OpenSCManager(
            None, None, win32service.SC_MANAGER_CONNECT)
        svc = win32service.OpenService(
            scm, service_name, win32service.SERVICE_QUERY_CONFIG)
        config = win32service.QueryServiceConfig(svc)
        win32service.CloseServiceHandle(svc)
        win32service.CloseServiceHandle(scm)

        deps = config[7]
        # FIX: Ensure we don't comma-separate a single string like "Tcpip" into "T, c, p, i, p"
        if not deps:
            return "None"
        if isinstance(deps, str):
            return deps
        if isinstance(deps, (list, tuple)):
            return ", ".join(deps)
        return str(deps)
    except Exception:
        return "Unknown"


@st.cache_data(ttl=120, show_spinner=False)
def get_all_services() -> tuple[list[dict], list[dict]]:
    """Scans all active/inactive services and groups them with dependency logic."""
    ms_services = []
    non_ms_services = []

    for svc in psutil.win_service_iter():
        try:
            info = svc.as_dict()
            binpath = str(info.get('binpath', '')).lower()
            desc = str(info.get('description', 'No description provided.'))
            display = str(info.get('display_name', info.get('name')))
            name = info.get('name')

            # Heuristics to determine if it is a core Microsoft Service
            is_ms = False
            if "windows" in binpath and "system32" in binpath:
                is_ms = True
            if "microsoft" in display.lower() or "microsoft" in desc.lower():
                is_ms = True
            if "svchost.exe" in binpath:
                is_ms = True

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

    # Sort alphabetical by Display Name
    ms_services.sort(key=lambda x: x['Display Name'])
    non_ms_services.sort(key=lambda x: x['Display Name'])

    return ms_services, non_ms_services

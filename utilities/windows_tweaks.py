import winreg
import platform

def is_windows():
    return platform.system() == "Windows"

def read_reg(hive, path, name):
    if not is_windows(): return None
    try:
        key = winreg.OpenKey(hive, path, 0, winreg.KEY_READ)
        value, _ = winreg.QueryValueEx(key, name)
        winreg.CloseKey(key)
        return value
    except FileNotFoundError:
        return None

TWEAKS = [
    {
        "id": "location_services",
        "category": "Privacy",
        "title": "Location Services",
        "description": "Allow apps and Windows to access your physical location.",
        "icon": "MapPin",
        "status_logic": lambda: "disabled" if (
            read_reg(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors", "DisableLocation") == 1
        ) else ("enabled" if read_reg(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location", "Value") == "Allow" else "disabled"),
        "enable_script": """
Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors" -Name "DisableLocation" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors" -Name "DisableWindowsLocationProvider" -ErrorAction SilentlyContinue
Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors" -Name "DisableLocationScripting" -ErrorAction SilentlyContinue
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location" -Name "Value" -Value "Allow" -ErrorAction SilentlyContinue
Set-Service lfsvc -StartupType Manual -ErrorAction SilentlyContinue
Start-Service lfsvc -ErrorAction SilentlyContinue
        """.strip(),
        "disable_script": """
if (!(Test-Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors")) { New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors" -Force }
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors" -Name "DisableLocation" -Value 1 -Type DWord -Force
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\LocationAndSensors" -Name "DisableWindowsLocationProvider" -Value 1 -Type DWord -Force
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore\\location" -Name "Value" -Value "Deny" -Force
Stop-Service lfsvc -ErrorAction SilentlyContinue
Set-Service lfsvc -StartupType Disabled -ErrorAction SilentlyContinue
        """.strip()
    },
    {
        "id": "hidden_files",
        "category": "Explorer",
        "title": "Show Hidden Files",
        "description": "Display files and folders that are normally hidden by the operating system.",
        "icon": "Eye",
        "status_logic": lambda: "enabled" if read_reg(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "Hidden") == 1 else "disabled",
        "enable_script": """
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "Hidden" -Value 1
Stop-Process -Name explorer -Force
        """.strip(),
        "disable_script": """
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "Hidden" -Value 2
Stop-Process -Name explorer -Force
        """.strip()
    },
    {
        "id": "file_extensions",
        "category": "Explorer",
        "title": "Show File Extensions",
        "description": "Display the file extension (like .txt or .exe) at the end of filenames.",
        "icon": "FileText",
        "status_logic": lambda: "enabled" if read_reg(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "HideFileExt") == 0 else "disabled",
        "enable_script": """
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "HideFileExt" -Value 0
Stop-Process -Name explorer -Force
        """.strip(),
        "disable_script": """
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced" -Name "HideFileExt" -Value 1
Stop-Process -Name explorer -Force
        """.strip()
    },
    {
        "id": "fast_startup",
        "category": "System",
        "title": "Fast Startup (Hibernation)",
        "description": "Uses hiberfil.sys to boot up faster. Disabling this saves disk space and ensures full shutdowns.",
        "icon": "Zap",
        "status_logic": lambda: "enabled" if read_reg(winreg.HKEY_LOCAL_MACHINE, r"System\CurrentControlSet\Control\Session Manager\Power", "HiberbootEnabled") == 1 else "disabled",
        "enable_script": """
powercfg /h on
Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Session Manager\\Power" -Name "HiberbootEnabled" -Value 1
        """.strip(),
        "disable_script": """
Set-ItemProperty -Path "HKLM:\\System\\CurrentControlSet\\Control\\Session Manager\\Power" -Name "HiberbootEnabled" -Value 0
powercfg /h off
        """.strip()
    },
    {
        "id": "task_manager",
        "category": "System",
        "title": "Task Manager Restrictions",
        "description": "Checks if Task Manager is disabled by organization policies.",
        "icon": "Activity",
        "status_logic": lambda: "disabled" if read_reg(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Policies\System", "DisableTaskMgr") == 1 else "enabled",
        "enable_script": """
Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "DisableTaskMgr" -ErrorAction SilentlyContinue
        """.strip(),
        "disable_script": """
if (!(Test-Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System")) { New-Item -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Force }
Set-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\System" -Name "DisableTaskMgr" -Value 1 -Type DWord -Force
        """.strip()
    },
    {
        "id": "windows_defender",
        "category": "Security",
        "title": "Windows Defender Real-time Protection",
        "description": "Microsoft Defender real-time scanning. Usually managed by Windows, but can be forced off.",
        "icon": "Shield",
        "status_logic": lambda: "disabled" if read_reg(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection", "DisableRealtimeMonitoring") == 1 else "enabled",
        "enable_script": """
Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection" -Name "DisableRealtimeMonitoring" -ErrorAction SilentlyContinue
Set-MpPreference -DisableRealtimeMonitoring $false
        """.strip(),
        "disable_script": """
if (!(Test-Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection")) { New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection" -Force }
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Real-Time Protection" -Name "DisableRealtimeMonitoring" -Value 1 -Type DWord -Force
Set-MpPreference -DisableRealtimeMonitoring $true
        """.strip()
    },
    {
        "id": "telemetry",
        "category": "Privacy",
        "title": "Windows Telemetry",
        "description": "Microsoft data collection and telemetry.",
        "icon": "Activity",
        "status_logic": lambda: "disabled" if read_reg(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Policies\Microsoft\Windows\DataCollection", "AllowTelemetry") == 0 else "enabled",
        "enable_script": """
Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -ErrorAction SilentlyContinue
Start-Service DiagTrack -ErrorAction SilentlyContinue
        """.strip(),
        "disable_script": """
if (!(Test-Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection")) { New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Force }
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection" -Name "AllowTelemetry" -Value 0 -Type DWord -Force
Stop-Service DiagTrack -ErrorAction SilentlyContinue
Set-Service DiagTrack -StartupType Disabled -ErrorAction SilentlyContinue
        """.strip()
    },
    {
        "id": "bing_search",
        "category": "System",
        "title": "Bing Web Search in Start Menu",
        "description": "Web results appearing when you search in the Windows Start Menu.",
        "icon": "Globe",
        "status_logic": lambda: "disabled" if read_reg(winreg.HKEY_CURRENT_USER, r"Software\Policies\Microsoft\Windows\Explorer", "DisableSearchBoxSuggestions") == 1 else "enabled",
        "enable_script": """
Remove-ItemProperty -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer" -Name "DisableSearchBoxSuggestions" -ErrorAction SilentlyContinue
Stop-Process -Name explorer -Force
        """.strip(),
        "disable_script": """
if (!(Test-Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer")) { New-Item -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer" -Force }
Set-ItemProperty -Path "HKCU:\\Software\\Policies\\Microsoft\\Windows\\Explorer" -Name "DisableSearchBoxSuggestions" -Value 1 -Type DWord -Force
Stop-Process -Name explorer -Force
        """.strip()
    },
    {
        "id": "cortana",
        "category": "System",
        "title": "Cortana",
        "description": "Microsoft's virtual assistant.",
        "icon": "Mic",
        "status_logic": lambda: "disabled" if read_reg(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Policies\Microsoft\Windows\Windows Search", "AllowCortana") == 0 else "enabled",
        "enable_script": """
Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" -Name "AllowCortana" -ErrorAction SilentlyContinue
        """.strip(),
        "disable_script": """
if (!(Test-Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search")) { New-Item -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" -Force }
Set-ItemProperty -Path "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search" -Name "AllowCortana" -Value 0 -Type DWord -Force
        """.strip()
    },
    {
        "id": "dark_mode",
        "category": "System",
        "title": "Dark Mode (System & Apps)",
        "description": "Force Windows and Apps to use Dark Theme.",
        "icon": "Moon",
        "status_logic": lambda: "enabled" if read_reg(winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize", "AppsUseLightTheme") == 0 else "disabled",
        "enable_script": """
Set-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" -Name "AppsUseLightTheme" -Value 0 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" -Name "SystemUsesLightTheme" -Value 0 -Type DWord -Force
        """.strip(),
        "disable_script": """
Set-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" -Name "AppsUseLightTheme" -Value 1 -Type DWord -Force
Set-ItemProperty -Path "HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" -Name "SystemUsesLightTheme" -Value 1 -Type DWord -Force
        """.strip()
    },
    {
        "id": "sticky_keys",
        "category": "System",
        "title": "Sticky Keys Prompt",
        "description": "The annoying prompt that appears when you press Shift 5 times.",
        "icon": "Keyboard",
        "status_logic": lambda: "disabled" if str(read_reg(winreg.HKEY_CURRENT_USER, r"Control Panel\Accessibility\StickyKeys", "Flags")) == "506" else "enabled",
        "enable_script": """
Set-ItemProperty -Path "HKCU:\\Control Panel\\Accessibility\\StickyKeys" -Name "Flags" -Value "510" -Type String -Force
        """.strip(),
        "disable_script": """
Set-ItemProperty -Path "HKCU:\\Control Panel\\Accessibility\\StickyKeys" -Name "Flags" -Value "506" -Type String -Force
        """.strip()
    }
]

def get_all_tweaks():
    if not is_windows(): return []
    results = []
    for t in TWEAKS:
        try:
            status = t["status_logic"]()
        except Exception:
            status = "unknown"
            
        results.append({
            "id": t["id"],
            "category": t["category"],
            "title": t["title"],
            "description": t["description"],
            "icon": t["icon"],
            "status": status,
            "enable_script": t["enable_script"],
            "disable_script": t["disable_script"]
        })
    return results

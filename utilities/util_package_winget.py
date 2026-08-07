import subprocess
import os
from utilities.util_stream import run_cmd_single as run_winget_cmd


def is_winget_installed() -> bool:
    """Checks whether winget is available on the system PATH."""
    out = run_winget_cmd("winget --version")
    return bool(out and "v" in out.lower())


def install_winget() -> tuple[bool, str]:
    """Winget ships with Windows 10/11 App Installer — open the Store page."""
    cmd = 'start ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1'
    try:
        subprocess.Popen(cmd, shell=True)
        return True, "Opened the Microsoft Store page for App Installer (winget)."
    except Exception as e:
        return False, str(e)


def _get_winget_updates() -> dict:
    """Returns {package_id: new_version} for all upgradable winget packages."""
    out = run_winget_cmd("winget upgrade")
    upgradable = {}
    parsing = False

    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("---") or "Version" in line:
            parsing = True
            continue
        if parsing:
            parts = [p.strip() for p in line.split('  ') if p.strip()]
            if len(parts) >= 4:
                upgradable[parts[1]] = parts[3]
    return upgradable


def list_installed() -> tuple[bool, list]:
    """Returns all installed winget packages with outdated status."""
    upgradable = _get_winget_updates()
    out = run_winget_cmd("winget list")

    apps = []
    parsing = False

    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("---") or "Id" in line:
            parsing = True
            continue

        if parsing:
            parts = [p.strip() for p in line.split('  ') if p.strip()]
            if len(parts) >= 3:
                pkg_id = parts[1]
                is_outdated = pkg_id in upgradable
                apps.append({
                    "name": parts[0],
                    "id": pkg_id,
                    "version": parts[2],
                    "is_outdated": is_outdated,
                    "new_version": upgradable.get(pkg_id, ""),
                })

    apps.sort(key=lambda x: (not x['is_outdated'], x['name'].lower()))
    return bool(apps), apps


def search_winget(query: str) -> tuple[bool, list]:
    """Returns structured search results as list of dicts."""
    if not query:
        return False, []
    out = run_winget_cmd(f'winget search "{query}"')
    if not out or "No package found" in out:
        return False, []

    results = []
    parsing = False
    for line in out.splitlines():
        line_s = line.strip()
        if not line_s:
            continue
        if line_s.startswith("---"):
            parsing = True
            continue
        if parsing:
            # winget pads columns with spaces; split on 2+ spaces
            parts = [p.strip() for p in line_s.split('  ') if p.strip()]
            if len(parts) >= 2:
                results.append({
                    "name": parts[0],
                    "id": parts[1] if len(parts) > 1 else parts[0],
                    "version": parts[2] if len(parts) > 2 else "Unknown",
                    "source": parts[-1] if len(parts) > 3 else "winget",
                })
    return True, results


def install_package(pkg_id: str) -> tuple[bool, str]:
    """Installs a single winget package by ID, accepting all agreements."""
    result = run_winget_cmd(
        f'winget install --id "{pkg_id}" -e --accept-package-agreements --accept-source-agreements'
    )
    if "Successfully installed" in result or "No newer package" in result:
        return True, result
    return False, result


def install_packages(pkg_ids: list[str]) -> tuple[bool, str]:
    """Installs multiple packages sequentially."""
    logs = []
    all_ok = True
    for pkg_id in pkg_ids:
        ok, log = install_package(pkg_id)
        logs.append(log)
        if not ok:
            all_ok = False
    return all_ok, "\n\n".join(logs)


def uninstall_package(pkg_id: str) -> tuple[bool, str]:
    """Uninstalls a winget package by ID."""
    result = run_winget_cmd(f'winget uninstall --id "{pkg_id}" -e')
    if "Successfully uninstalled" in result:
        return True, result
    return False, result


def update_package(pkg_id: str) -> tuple[bool, str]:
    """Updates a single winget package."""
    result = run_winget_cmd(
        f'winget upgrade --id "{pkg_id}" -e --accept-package-agreements --accept-source-agreements'
    )
    success = "Successfully installed" in result or "No applicable update" in result
    return success, result


def upgrade_all() -> tuple[bool, str]:
    """Upgrades all eligible installed winget packages to their latest versions."""
    result = run_winget_cmd(
        "winget upgrade --all --accept-package-agreements --accept-source-agreements"
    )
    if "No applicable update found" in result:
        return False, "No applicable update found."
    return True, result
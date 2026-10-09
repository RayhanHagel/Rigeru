import subprocess
import os
from typing import Any
from utilities.core.util_stream import run_cmd_single as run_winget_cmd


def is_winget_installed() -> bool:
    """

            Check whether Windows Package Manager (winget.exe) is available on PATH.

            Returns:
                bool: True if winget is available, False otherwise.
            
    """
    out = run_winget_cmd("winget --version")
    return bool(out and "v" in out.lower())


def install_winget() -> tuple[bool, str]:
    """

            Launch the Microsoft Store page to install or update Windows App Installer.

            Returns:
                tuple[bool, str]: Success flag and action status message.
            
    """
    cmd = 'start ms-windows-store://pdp/?ProductId=9NBLGGH4NNS1'
    try:
        subprocess.Popen(cmd, shell=True)
        return True, "Opened the Microsoft Store page for App Installer (winget)."
    except Exception as e:
        return False, str(e)


def _get_winget_updates() -> dict[str, str]:
    """

            Parse available WinGet upgrades across installed software.

            Returns:
                dict[str, str]: Mapping of package IDs to new available version strings.
            
    """
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


def list_installed() -> tuple[bool, list[dict[str, Any]]]:
    """

            Enumerate all software installed on the system via WinGet.

            Returns:
                tuple[bool, list[dict[str, Any]]]: Success flag and list of package dictionaries.
            
    """
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
                from utilities.system_network.util_package_base import normalize_package_item
                apps.append(normalize_package_item(
                    parts[0],
                    pkg_id,
                    parts[2],
                    upgradable.get(pkg_id, "")
                ))

    from utilities.system_network.util_package_base import sort_packages
    apps = sort_packages(apps)
    return bool(apps), apps


def search_winget(query: str) -> tuple[bool, list[dict[str, Any]]]:
    """

            Query Microsoft Windows Package Manager repositories for matching software.

            Args:
                query (str): Search keyword query.

            Returns:
                tuple[bool, list[dict[str, Any]]]: Success flag and structured list of results.
            
    """
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
    """

            Install a package using WinGet accepting source and package agreements.

            Args:
                pkg_id (str): WinGet package identifier.

            Returns:
                tuple[bool, str]: Success flag and terminal output.
            
    """
    result = run_winget_cmd(
        f'winget install --id "{pkg_id}" -e --accept-package-agreements --accept-source-agreements'
    )
    if "Successfully installed" in result or "No newer package" in result:
        return True, result
    return False, result


def install_packages(pkg_ids: list[str]) -> tuple[bool, str]:
    """

            Install multiple WinGet packages sequentially.

            Args:
                pkg_ids (list[str]): List of package identifiers.

            Returns:
                tuple[bool, str]: Combined success boolean and concatenated log output.
            
    """
    logs = []
    all_ok = True
    for pkg_id in pkg_ids:
        ok, log = install_package(pkg_id)
        logs.append(log)
        if not ok:
            all_ok = False
    return all_ok, "\n\n".join(logs)


def uninstall_package(pkg_id: str) -> tuple[bool, str]:
    """

            Uninstall a package by ID using WinGet.

            Args:
                pkg_id (str): Package identifier to uninstall.

            Returns:
                tuple[bool, str]: Success flag and terminal output.
            
    """
    result = run_winget_cmd(f'winget uninstall --id "{pkg_id}" -e')
    if "Successfully uninstalled" in result:
        return True, result
    return False, result


def update_package(pkg_id: str) -> tuple[bool, str]:
    """

            Upgrade a specific software package to its latest version via WinGet.

            Args:
                pkg_id (str): Package identifier to upgrade.

            Returns:
                tuple[bool, str]: Success flag and terminal output.
            
    """
    result = run_winget_cmd(
        f'winget upgrade --id "{pkg_id}" -e --accept-package-agreements --accept-source-agreements'
    )
    success = "Successfully installed" in result or "No applicable update" in result
    return success, result


def upgrade_all() -> tuple[bool, str]:
    """

            Upgrade all eligible installed packages on the system using WinGet.

            Returns:
                tuple[bool, str]: Success flag and terminal output.
            
    """
    result = run_winget_cmd(
        "winget upgrade --all --accept-package-agreements --accept-source-agreements"
    )
    if "No applicable update found" in result:
        return False, "No applicable update found."
    return True, result

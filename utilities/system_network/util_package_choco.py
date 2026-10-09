import os
from typing import Any
from utilities.core.util_stream import run_cmd as run_choco_cmd


def is_choco_installed() -> bool:
    """

            Check whether Chocolatey CLI is present and executable on PATH.

            Returns:
                bool: True if choco is available, False otherwise.
            
    """
    out, _ = run_choco_cmd("choco --version")
    return bool(out and out[0].isdigit())


def install_choco() -> tuple[bool, str]:
    """

            Execute the official Chocolatey bootstrap PowerShell script (requires administrator privileges).

            Returns:
                tuple[bool, str]: Success boolean flag and terminal execution output.
            
    """
    cmd = (
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "'
        "Set-ExecutionPolicy Bypass -Scope Process -Force; "
        "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; "
        "iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))\""
    )
    out, err = run_choco_cmd(cmd)
    success = is_choco_installed()
    return success, out or err


def get_choco_outdated() -> dict[str, str]:
    """

            Parse Chocolatey outdated packages and their upstream versions.

            Returns:
                dict[str, str]: Mapping of package names to latest available versions.
            
    """
    out, _ = run_choco_cmd("choco outdated --limit-output --no-color")
    outdated = {}
    for line in out.splitlines():
        parts = line.strip().split('|')
        if len(parts) >= 3:
            pkg_name = parts[0].strip().lower()
            new_ver = parts[2].strip()
            outdated[pkg_name] = new_ver
    return outdated


def list_installed() -> tuple[bool, list[dict[str, Any]]]:
    """

            Query installed Chocolatey packages and correlate with outdated update status.

            Returns:
                tuple[bool, list[dict[str, Any]]]: Success boolean flag and list of normalized package dictionaries.
            
    """
    outdated = get_choco_outdated()
    from utilities.system_network.util_package_base import normalize_package_item, sort_packages
    out, _ = run_choco_cmd("choco list --limit-output --no-color")

    apps = []
    for line in out.splitlines():
        parts = line.strip().split('|')
        if len(parts) >= 2:
            name = parts[0].strip()
            version = parts[1].strip()
            name_lower = name.lower()
            new_ver = outdated.get(name_lower, "")
            apps.append(normalize_package_item(name, name, version, new_ver))

    apps = sort_packages(apps)
    return bool(apps), apps


def search_choco(query: str) -> tuple[bool, list[dict[str, Any]]]:
    """

            Search Chocolatey online package community repository for matching packages.

            Args:
                query (str): Keyword package query string.

            Returns:
                tuple[bool, list[dict[str, Any]]]: Success flag and list of search results.
            
    """
    if not query:
        return False, []
    out, _ = run_choco_cmd(f"choco search {query} --limit-output --no-color")
    if not out:
        return False, []

    results = []
    for line in out.splitlines():
        parts = line.strip().split('|')
        if len(parts) >= 2:
            results.append({
                "name": parts[0].strip(),
                "id": parts[0].strip(),
                "version": parts[1].strip(),
            })
    return bool(results), results


def install_package(pkg: str) -> tuple[bool, str]:
    """

            Install a single Chocolatey package by identifier.

            Args:
                pkg (str): Chocolatey package name.

            Returns:
                tuple[bool, str]: Success flag and terminal output.
            
    """
    out, err = run_choco_cmd(f"choco install {pkg} -y --no-color")
    success = "successfully installed" in out.lower() or "already installed" in out.lower()
    return success, out or err


def install_packages(pkgs: list[str]) -> tuple[bool, str]:
    """

            Install multiple Chocolatey packages sequentially.

            Args:
                pkgs (list[str]): List of package identifiers to install.

            Returns:
                tuple[bool, str]: Success flag and combined execution output.
            
    """
    if not pkgs:
        return False, "No packages selected."
    out, err = run_choco_cmd(f"choco install {' '.join(pkgs)} -y --no-color")
    success = "successfully installed" in out.lower()
    return success, out or err


def uninstall_package(pkg: str) -> tuple[bool, str]:
    """

            Remove a Chocolatey package from the host system.

            Args:
                pkg (str): Package identifier to uninstall.

            Returns:
                tuple[bool, str]: Success flag and command output.
            
    """
    out, err = run_choco_cmd(f"choco uninstall {pkg} -y --no-color")
    success = "successfully uninstalled" in out.lower()
    return success, out or err


def update_package(pkg: str) -> tuple[bool, str]:
    """

            Upgrade a specific Chocolatey package to its latest available release.

            Args:
                pkg (str): Package identifier to upgrade.

            Returns:
                tuple[bool, str]: Success flag and command output.
            
    """
    out, err = run_choco_cmd(f"choco upgrade {pkg} -y --no-color")
    success = "successfully installed" in out.lower() or "already up to date" in out.lower()
    return success, out or err


def upgrade_all() -> tuple[bool, str]:
    """

            Upgrade all installed Chocolatey packages to latest upstream versions.

            Returns:
                tuple[bool, str]: Success flag and command output.
            
    """
    out, err = run_choco_cmd("choco upgrade all -y --no-color")
    success = "successfully installed" in out.lower() or "nothing to upgrade" in out.lower()
    return success, out or err

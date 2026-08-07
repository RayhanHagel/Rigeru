import os
from utilities.util_stream import run_cmd as run_choco_cmd


def is_choco_installed() -> bool:
    """Checks whether choco is available on PATH."""
    out, _ = run_choco_cmd("choco --version")
    return bool(out and out[0].isdigit())


def install_choco() -> tuple[bool, str]:
    """Runs the official Chocolatey bootstrap script via PowerShell (requires admin)."""
    cmd = (
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "'
        "Set-ExecutionPolicy Bypass -Scope Process -Force; "
        "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; "
        "iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))\""
    )
    out, err = run_choco_cmd(cmd)
    success = is_choco_installed()
    return success, out or err


def get_choco_outdated() -> dict:
    """Returns {pkg_name: new_version} for all outdated choco packages."""
    out, _ = run_choco_cmd("choco outdated --limit-output --no-color")
    outdated = {}
    for line in out.splitlines():
        parts = line.strip().split('|')
        if len(parts) >= 3:
            pkg_name = parts[0].strip().lower()
            new_ver = parts[2].strip()
            outdated[pkg_name] = new_ver
    return outdated


def list_installed() -> tuple[bool, list]:
    """Returns all installed chocolatey packages with outdated status."""
    outdated = get_choco_outdated()
    out, _ = run_choco_cmd("choco list --limit-output --no-color")

    apps = []
    for line in out.splitlines():
        parts = line.strip().split('|')
        if len(parts) >= 2:
            name = parts[0].strip()
            version = parts[1].strip()
            name_lower = name.lower()
            is_outdated = name_lower in outdated
            apps.append({
                "name": name,
                "id": name,
                "version": version,
                "new_version": outdated.get(name_lower, ""),
                "is_outdated": is_outdated,
            })

    apps.sort(key=lambda x: (not x['is_outdated'], x['name'].lower()))
    return bool(apps), apps


def search_choco(query: str) -> tuple[bool, list]:
    """Returns structured search results for a choco query."""
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
    """Installs a single chocolatey package by name."""
    out, err = run_choco_cmd(f"choco install {pkg} -y --no-color")
    success = "successfully installed" in out.lower() or "already installed" in out.lower()
    return success, out or err


def install_packages(pkgs: list[str]) -> tuple[bool, str]:
    """Installs multiple chocolatey packages sequentially."""
    if not pkgs:
        return False, "No packages selected."
    out, err = run_choco_cmd(f"choco install {' '.join(pkgs)} -y --no-color")
    success = "successfully installed" in out.lower()
    return success, out or err


def uninstall_package(pkg: str) -> tuple[bool, str]:
    """Uninstalls a chocolatey package by name."""
    out, err = run_choco_cmd(f"choco uninstall {pkg} -y --no-color")
    success = "successfully uninstalled" in out.lower()
    return success, out or err


def update_package(pkg: str) -> tuple[bool, str]:
    """Upgrades a specific chocolatey package to the latest version."""
    out, err = run_choco_cmd(f"choco upgrade {pkg} -y --no-color")
    success = "successfully installed" in out.lower() or "already up to date" in out.lower()
    return success, out or err


def upgrade_all() -> tuple[bool, str]:
    """Upgrades all currently installed chocolatey packages."""
    out, err = run_choco_cmd("choco upgrade all -y --no-color")
    success = "successfully installed" in out.lower() or "nothing to upgrade" in out.lower()
    return success, out or err
import os
import json
from typing import Any
from utilities.core.util_stream import run_cmd


def is_scoop_installed() -> bool:
    """

            Check whether Scoop CLI is installed and available on PATH.

            Returns:
                bool: True if Scoop is available, False otherwise.
            
    """
    out, _ = run_cmd("scoop --version")
    return bool(out and "scoop" in out.lower())


def install_scoop() -> tuple[bool, str]:
    """

            Run the official Scoop package manager bootstrap script via PowerShell.

            Returns:
                tuple[bool, str]: Success flag and terminal output.
            
    """
    cmd = (
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "'
        'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; '
        "iwr -useb get.scoop.sh | iex\""
    )
    out, err = run_cmd(cmd)
    success = is_scoop_installed()
    return success, out or err


def get_scoop_outdated() -> dict[str, str]:
    """

            Query Scoop status for available package updates.

            Returns:
                dict[str, str]: Mapping of app names to new available versions.
            
    """
    out, _ = run_cmd("scoop status")
    outdated = {}
    parsing = False
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("----"):
            parsing = True
            continue
        if parsing:
            parts = line.split()
            if len(parts) >= 3:
                outdated[parts[0]] = parts[2]
    return outdated


def list_installed() -> tuple[bool, list[dict[str, Any]]]:
    """

            Scan installed Scoop applications and parse manifest versions.

            Returns:
                tuple[bool, list[dict[str, Any]]]: Success flag and sorted list of package items.
            
    """
    outdated = get_scoop_outdated()
    scoop_dir = os.environ.get(
        'SCOOP',
        os.path.join(os.environ.get('USERPROFILE', os.path.expanduser('~')), 'scoop')
    )
    apps_dir = os.path.join(scoop_dir, 'apps')

    apps = []
    if not os.path.exists(apps_dir):
        return False, apps

    for app_name in os.listdir(apps_dir):
        if app_name.lower() == "scoop":
            continue

        manifest_path = os.path.join(apps_dir, app_name, 'current', 'manifest.json')
        if os.path.exists(manifest_path):
            try:
                with open(manifest_path, 'r', encoding='utf-8') as f:
                    manifest = json.load(f)
                if not manifest: continue
                desc = manifest.get('description', 'No description provided.')
                if isinstance(desc, list):
                    desc = " ".join(desc)

                new_ver = outdated.get(app_name, "")
                from utilities.system_network.util_package_base import normalize_package_item, sort_packages
                apps.append(normalize_package_item(
                    app_name,
                    app_name,
                    manifest.get('version', 'Unknown'),
                    new_ver,
                    description=desc
                ))
            except Exception:
                pass

    from utilities.system_network.util_package_base import sort_packages
    apps = sort_packages(apps)
    return True, apps


def search_scoop(query: str) -> tuple[bool, list[dict[str, Any]]]:
    """

            Query configured Scoop buckets for matching applications.

            Args:
                query (str): Search keyword query.

            Returns:
                tuple[bool, list[dict[str, Any]]]: Success flag and list of package results.
            
    """
    if not query:
        return False, []
    out, err = run_cmd(f"scoop search {query}")
    if not out:
        return False, []

    results = []
    in_results = False
    for line in out.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("----"):
            in_results = True
            continue
        if in_results:
            parts = line.split()
            if len(parts) >= 2:
                results.append({
                    "name": parts[0],
                    "id": parts[0],
                    "version": parts[1] if len(parts) > 1 else "Unknown",
                    "bucket": parts[2] if len(parts) > 2 else "main",
                })

    return True, results


def install_package(pkg: str) -> tuple[bool, str]:
    """

            Install a single Scoop application by name.

            Args:
                pkg (str): Scoop package name.

            Returns:
                tuple[bool, str]: Success flag and execution output.
            
    """
    out, err = run_cmd(f"scoop install {pkg}")
    if "was installed successfully!" in out or "is already installed" in out:
        return True, out
    return False, out or err


def install_packages(pkgs: list[str]) -> tuple[bool, str]:
    """

            Install multiple Scoop packages concurrently or in one execution.

            Args:
                pkgs (list[str]): List of Scoop package names.

            Returns:
                tuple[bool, str]: Success flag and execution output.
            
    """
    if not pkgs:
        return False, "No packages selected."
    out, err = run_cmd(f"scoop install {' '.join(pkgs)}")
    success = all(name in out for name in pkgs) or "installed successfully" in out
    return success, out or err


def uninstall_package(pkg: str) -> tuple[bool, str]:
    """

            Uninstall a Scoop application by name.

            Args:
                pkg (str): Package identifier.

            Returns:
                tuple[bool, str]: Success flag and execution output.
            
    """
    out, err = run_cmd(f"scoop uninstall {pkg}")
    if "was uninstalled" in out:
        return True, out
    return False, out or err


def update_package(pkg: str) -> tuple[bool, str]:
    """

            Update a specific Scoop package to the latest version.

            Args:
                pkg (str): Package identifier.

            Returns:
                tuple[bool, str]: Success flag and command output.
            
    """
    out, err = run_cmd(f"scoop update {pkg}")
    success = "was updated" in out or "latest version" in out
    return success, out or err


def update_scoop() -> tuple[bool, str]:
    """

            Update local Scoop bucket manifests.

            Returns:
                tuple[bool, str]: Success flag and command output.
            
    """
    out, err = run_cmd("scoop update")
    if err and "failed" in err.lower():
        return False, err
    return True, out


def update_all() -> tuple[bool, str]:
    """

            Update all installed Scoop packages.

            Returns:
                tuple[bool, str]: Success flag and command output.
            
    """
    out, err = run_cmd("scoop update *")
    return True, out or err


def cleanup_scoop() -> tuple[bool, str]:
    """

            Remove old and outdated versions of installed Scoop packages.

            Returns:
                tuple[bool, str]: Success flag and command output.
            
    """
    out, err = run_cmd("scoop cleanup *")
    return True, out or err

import subprocess
import os
import json
from utilities.util_json import load_json


def run_cmd(cmd: str) -> tuple[str, str]:
    """Runs a terminal command silently and returns (stdout, stderr)."""
    startupinfo = None
    if os.name == 'nt':
        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW

    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True,
            startupinfo=startupinfo, encoding='utf-8', errors='ignore'
        )
        return result.stdout.strip(), result.stderr.strip()
    except Exception as e:
        return "", str(e)


def is_scoop_installed() -> bool:
    """Checks whether scoop is available on PATH."""
    out, _ = run_cmd("scoop --version")
    return bool(out and "scoop" in out.lower())


def install_scoop() -> tuple[bool, str]:
    """Runs the official Scoop bootstrap script via PowerShell."""
    cmd = (
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "'
        'Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force; '
        "iwr -useb get.scoop.sh | iex\""
    )
    out, err = run_cmd(cmd)
    success = is_scoop_installed()
    return success, out or err


def get_scoop_outdated() -> dict:
    """Returns {app_name: new_version} for all outdated scoop packages."""
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


def list_installed() -> tuple[bool, list]:
    """Returns installed scoop apps with outdated status."""
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
                manifest = load_json(manifest_path, lambda: {})
                if not manifest: continue
                desc = manifest.get('description', 'No description provided.')
                if isinstance(desc, list):
                    desc = " ".join(desc)

                is_outdated = app_name in outdated
                apps.append({
                    "name": app_name,
                    "version": manifest.get('version', 'Unknown'),
                    "new_version": outdated.get(app_name, ""),
                    "description": desc,
                    "is_outdated": is_outdated,
                })
            except Exception:
                pass

    apps.sort(key=lambda x: (not x['is_outdated'], x['name'].lower()))
    return True, apps


def search_scoop(query: str) -> tuple[bool, list]:
    """
    Returns structured search results as a list of dicts with name/version/bucket.
    Uses --limit-output for machine-readable output.
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
                    "version": parts[1] if len(parts) > 1 else "Unknown",
                    "bucket": parts[2] if len(parts) > 2 else "main",
                })

    return True, results


def install_package(pkg: str) -> tuple[bool, str]:
    out, err = run_cmd(f"scoop install {pkg}")
    if "was installed successfully!" in out or "is already installed" in out:
        return True, out
    return False, out or err


def install_packages(pkgs: list[str]) -> tuple[bool, str]:
    """Installs multiple packages in one scoop call."""
    if not pkgs:
        return False, "No packages selected."
    out, err = run_cmd(f"scoop install {' '.join(pkgs)}")
    success = all(name in out for name in pkgs) or "installed successfully" in out
    return success, out or err


def uninstall_package(pkg: str) -> tuple[bool, str]:
    out, err = run_cmd(f"scoop uninstall {pkg}")
    if "was uninstalled" in out:
        return True, out
    return False, out or err


def update_package(pkg: str) -> tuple[bool, str]:
    """Updates a single scoop package."""
    out, err = run_cmd(f"scoop update {pkg}")
    success = "was updated" in out or "latest version" in out
    return success, out or err


def update_scoop() -> tuple[bool, str]:
    """Updates scoop manifests only."""
    out, err = run_cmd("scoop update")
    if err and "failed" in err.lower():
        return False, err
    return True, out


def update_all() -> tuple[bool, str]:
    """Updates all installed packages."""
    out, err = run_cmd("scoop update *")
    return True, out or err


def cleanup_scoop() -> tuple[bool, str]:
    """Removes old versions of installed packages."""
    out, err = run_cmd("scoop cleanup *")
    return True, out or err
import os
from typing import List, Dict, Any, Tuple
from utilities.core.util_stream import run_cmd, run_cmd_single

def normalize_package_item(
    name: str,
    pkg_id: str,
    version: str,
    new_version: str = "",
    description: str = ""
) -> Dict[str, Any]:
    """

            Format package metadata into a consistent data structure for frontend display.

            Args:
                name (str): Package display name.
                pkg_id (str): Unique package manager identifier.
                version (str): Currently installed version string.
                new_version (str, optional): Available upstream version string. Defaults to "".
                description (str, optional): Package summary description. Defaults to "".

            Returns:
                Dict[str, Any]: Normalized package record dictionary.
            
    """
    is_outdated = bool(new_version and new_version != version)
    return {
        "name": name,
        "id": pkg_id or name,
        "version": version,
        "new_version": new_version if is_outdated else "",
        "is_outdated": is_outdated,
        "description": description
    }

def sort_packages(apps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """

            Sort packages prioritizing outdated packages first, followed by alphabetical order.

            Args:
                apps (List[Dict[str, Any]]): List of package record dictionaries.

            Returns:
                List[Dict[str, Any]]: Sorted list of package dictionaries.
            
    """
    return sorted(apps, key=lambda x: (not x.get('is_outdated', False), str(x.get('name', '')).lower()))

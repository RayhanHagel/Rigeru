import platform
import subprocess
import re
import psutil
from typing import Dict, List, Optional, Tuple

DNS_PRESETS = {
    "Cloudflare": {"primary": "1.1.1.1", "secondary": "1.0.0.1", "ipv6_primary": "2606:4700:4700::1111"},
    "Google": {"primary": "8.8.8.8", "secondary": "8.8.4.4", "ipv6_primary": "2001:4860:4860::8888"},
    "Quad9": {"primary": "9.9.9.9", "secondary": "149.112.112.112", "ipv6_primary": "2620:fe::fe"},
    "OpenDNS": {"primary": "208.67.222.222", "secondary": "208.67.220.220", "ipv6_primary": "2620:119:35::35"}
}

def get_dns_presets() -> list[str]:
    """
    Return a list of available DNS preset provider names.

    Returns:
        list[str]: Preset provider name labels.
    """
    return list(DNS_PRESETS.keys())

# OPTIMIZED: Moved regex compilations to global scope to prevent recompilation in loops
RE_WIN_AVG = re.compile(r'(?:Average|Rata-rata)[^\d]*(\d+)', re.IGNORECASE)
RE_WIN_TIME = re.compile(r'time[=<](\d+)', re.IGNORECASE)
RE_NIX_AVG = re.compile(r'min/avg/max/mdev = [\d.]+/(.+?)/')

def get_network_interfaces() -> list[str]:
    """
    Retrieve names of all active, non-loopback network interface adapters.

    Returns:
        list[str]: Names of active network adapters.
    """
    try:
        stats = psutil.net_if_stats()
        # Filter for interfaces that are up and not loopback
        return [name for name, stat in stats.items() if stat.isup and 'Loopback' not in name]
    except Exception:
        return []

def run_ping(host: str, count: int = 4, ipv6: bool = False) -> tuple[bool, str]:
    """
    Execute ICMP ping against a target host and return standard process output.

    Args:
        host (str): Destination hostname or IP address.
        count (int, optional): Number of ICMP packets to transmit. Defaults to 4.
        ipv6 (bool, optional): Whether to use IPv6 protocol. Defaults to False.

    Returns:
        tuple[bool, str]: Success boolean flag and console stdout/stderr output string.
    """
    os_type = platform.system().lower()
    
    # Base command structure
    if os_type == 'windows':
        command = ['ping', '-n', str(count)]
        if ipv6:
            command.append('-6')
    else:
        command = ['ping6' if ipv6 else 'ping', '-c', str(count)]
        
    command.append(host)
    
    try:
        output = subprocess.run(command, capture_output=True, text=True, timeout=20)
        if output.returncode == 0:
            return True, output.stdout
        else:
            return False, f"Ping failed:\n{output.stderr or output.stdout}"
    except subprocess.TimeoutExpired:
        return False, "Request timed out after 20 seconds."
    except Exception as e:
        return False, f"An error occurred: {str(e)}"

def get_ping_latency(host: str, ipv6: bool = False) -> float:
    """
    Execute quick ICMP probe and parse round-trip average latency in milliseconds.

    Args:
        host (str): Destination target address.
        ipv6 (bool, optional): Use IPv6 probe. Defaults to False.

    Returns:
        float: Average latency in milliseconds or float('inf') on failure.
    """
    success, stdout = run_ping(host, count=2, ipv6=ipv6)
    if not success: 
        return float('inf')
    
    try:
        if platform.system().lower() == 'windows':
            match = RE_WIN_AVG.search(stdout)
            if match:
                return float(match.group(1))
            matches = RE_WIN_TIME.findall(stdout)
            if matches:
                return sum(float(m) for m in matches) / len(matches)
        else:
            match = RE_NIX_AVG.search(stdout)
            if match: 
                return float(match.group(1))
    except Exception:
        pass
        
    return float('inf')

def check_all_dns_speeds(preset_names: list[str] | None = None) -> dict[str, dict[str, float]]:
    """
    Benchmark round-trip response latency for preset DNS resolvers across IPv4 and IPv6.

    Args:
        preset_names (list[str] | None, optional): Optional subset of DNS provider names to test. Defaults to None.

    Returns:
        dict[str, dict[str, float]]: Mapping of provider name to latency records in ms (-1 if unreachable).
    """
    results = {}
    for name, ips in DNS_PRESETS.items():
        if preset_names and name not in preset_names:
            continue
        lat_v4 = get_ping_latency(ips["primary"])
        lat_v6 = get_ping_latency(ips["ipv6_primary"], ipv6=True)
        # Replace float('inf') with a large sentinel (-1) since Infinity is not valid JSON
        results[name] = {
            "ipv4": -1.0 if lat_v4 == float('inf') else float(lat_v4),
            "ipv6": -1.0 if lat_v6 == float('inf') else float(lat_v6)
        }
    return results


def set_windows_dns(interface_name: str, primary: str, secondary: str) -> tuple[bool, str]:
    """
    Configure static IPv4 DNS servers for a specific Windows network interface using netsh.

    Args:
        interface_name (str): Network adapter interface label.
        primary (str): Primary DNS server IP address.
        secondary (str): Secondary fallback DNS server IP address.

    Returns:
        tuple[bool, str]: Success flag and status or diagnostic error message.
    """
    if platform.system().lower() != 'windows':
        return False, "DNS changing is only implemented for Windows."
    
    try:
        cmd1 = f'netsh interface ipv4 set dns name="{interface_name}" static {primary}'
        res1 = subprocess.run(cmd1, capture_output=True, text=True, shell=True)
        if res1.returncode != 0:
            return False, f"Failed to set DNS. Try running Streamlit as Administrator. \nDetails: {res1.stdout}"
        
        if secondary:
            cmd2 = f'netsh interface ipv4 add dns name="{interface_name}" {secondary} index=2'
            subprocess.run(cmd2, capture_output=True, text=True, shell=True)
        
        return True, f"Successfully set DNS for '{interface_name}'"
    except Exception as e:
        return False, str(e)
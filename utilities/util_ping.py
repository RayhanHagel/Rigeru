import platform
import subprocess
import re
import psutil

DNS_PRESETS = {
    "Cloudflare": {"primary": "1.1.1.1", "secondary": "1.0.0.1", "ipv6_primary": "2606:4700:4700::1111"},
    "Google": {"primary": "8.8.8.8", "secondary": "8.8.4.4", "ipv6_primary": "2001:4860:4860::8888"},
    "Quad9": {"primary": "9.9.9.9", "secondary": "149.112.112.112", "ipv6_primary": "2620:fe::fe"},
    "OpenDNS": {"primary": "208.67.222.222", "secondary": "208.67.220.220", "ipv6_primary": "2620:119:35::35"}
}

def get_network_interfaces() -> list:
    """Returns a list of active network interface names."""
    try:
        stats = psutil.net_if_stats()
        # Filter for interfaces that are up and not loopback
        return [name for name, stat in stats.items() if stat.isup and 'Loopback' not in name]
    except Exception:
        return []

def run_ping(host: str, count: int = 4, ipv6: bool = False) -> tuple[bool, str]:
    """Pings a target host and returns the terminal output."""
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
    """Runs a quick ping and attempts to extract the average latency in ms."""
    success, stdout = run_ping(host, count=2, ipv6=ipv6)
    if not success: 
        return float('inf')
    
    try:
        if platform.system().lower() == 'windows':
            match = re.search(r'(?:Average|Rata-rata)[^\d]*(\d+)', stdout, re.IGNORECASE)
            if match:
                return float(match.group(1))
            matches = re.findall(r'time[=<](\d+)', stdout, re.IGNORECASE)
            if matches:
                return sum(float(m) for m in matches) / len(matches)
        else:
            match = re.search(r'min/avg/max/mdev = [\d.]+/(.+?)/', stdout)
            if match: 
                return float(match.group(1))
    except Exception:
        pass
        
    return float('inf')

def check_all_dns_speeds() -> dict:
    """Pings the primary IP of preset DNS servers and returns their latency for IPv4 and IPv6."""
    results = {}
    for name, ips in DNS_PRESETS.items():
        lat_v4 = get_ping_latency(ips["primary"])
        lat_v6 = get_ping_latency(ips["ipv6_primary"], ipv6=True)
        results[name] = {"ipv4": lat_v4, "ipv6": lat_v6}
    return results

def set_windows_dns(interface_name: str, primary: str, secondary: str) -> tuple[bool, str]:
    """Uses netsh to change the DNS server of a specific Windows network interface."""
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
import psutil
import json

def get_active_connections() -> list[dict]:
    """Scans for active, established external connections and maps them to apps."""
    connections = []
    
    # Needs to handle AccessDenied gracefully since some SYSTEM processes hide their PIDs
    for conn in psutil.net_connections(kind='inet'):
        if conn.status == 'ESTABLISHED' and conn.pid:
            try:
                proc = psutil.Process(conn.pid)
                app_name = proc.name()
                
                # Ignore generic local loopback to focus on real internet traffic
                if conn.raddr and conn.raddr.ip not in ('127.0.0.1', '::1'):
                    connections.append({
                        "app": app_name,
                        "pid": conn.pid,
                        "local_port": conn.laddr.port,
                        "remote_ip": conn.raddr.ip,
                        "remote_port": conn.raddr.port
                    })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
                
    # Sort and return a clean list
    return sorted(connections, key=lambda x: x['app'].lower())

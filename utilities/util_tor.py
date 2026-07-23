import socket
import time
import threading
import subprocess

def is_tor_running(port: int = 9050) -> bool:
    """Checks if the Tor SOCKS proxy is currently listening on the specified port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        try:
            return s.connect_ex(('127.0.0.1', port)) == 0
        except Exception:
            return False

def start_tor_background():
    """Starts Tor in a background thread and waits for it to bootstrap."""
    def run_tor():
        try:
            # We route stdout/stderr to DEVNULL to prevent Tor logs from spamming your Streamlit console
            subprocess.run(["tor"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except FileNotFoundError:
            print("ERROR: 'tor' executable not found in system PATH.")
    
    print("Tor not detected. Booting Tor in a background thread...")
    tor_thread = threading.Thread(target=run_tor, daemon=True)
    tor_thread.start()

    # Wait up to 15 seconds for Tor to establish its connection circuit
    for _ in range(15):
        if is_tor_running():
            print("Tor successfully connected and is ready!")
            return True
        time.sleep(1)
    
    print("Tor failed to start within the timeout period.")
    return False

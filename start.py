import os
import sys
import subprocess
import platform

def main():
    base_dir = os.path.abspath(os.path.dirname(__file__))
    frontend_dir = os.path.join(base_dir, "frontend")
    venv_dir = os.path.join(base_dir, ".venv")
    
    # 1. Setup Python venv
    if not os.path.exists(venv_dir):
        print("[SETUP] Virtual environment not found. Creating '.venv'...")
        subprocess.run([sys.executable, "-m", "venv", ".venv"], check=True)
        print("[SETUP] Installing Python dependencies...")
        
        if platform.system() == "Windows":
            pip_exe = os.path.join(venv_dir, "Scripts", "pip")
        else:
            pip_exe = os.path.join(venv_dir, "bin", "pip")
            
        subprocess.run([pip_exe, "install", "-r", "requirements.txt"], check=True)
        print("[SETUP] Python dependencies installed successfully.")
    
    # 2. Setup Node modules
    node_modules_dir = os.path.join(frontend_dir, "node_modules")
    if not os.path.exists(node_modules_dir):
        print("[SETUP] Node modules not found. Installing frontend dependencies...")
        # Use shell=True for npm to resolve correctly on Windows
        subprocess.run(["npm", "install"], cwd=frontend_dir, shell=True, check=True)
        print("[SETUP] Node dependencies installed successfully.")
        
    # 3. Setup Node modules for Playwright Scraper
    scraper_dir = os.path.join(base_dir, "utilities", "playwright_scraper")
    scraper_modules_dir = os.path.join(scraper_dir, "node_modules")
    if os.path.exists(scraper_dir) and not os.path.exists(scraper_modules_dir):
        print("[SETUP] Playwright scraper modules not found. Installing...")
        subprocess.run(["npm", "install"], cwd=scraper_dir, shell=True, check=True)
        # Install playwright browsers
        subprocess.run(["npx", "playwright", "install"], cwd=scraper_dir, shell=True, check=True)
        print("[SETUP] Playwright scraper dependencies installed successfully.")
        
    print("\n[START] Starting Next.js Frontend and FastAPI Backend...\n")
    
    if platform.system() == "Windows":
        python_exe = os.path.join(venv_dir, "Scripts", "python")
    else:
        python_exe = os.path.join(venv_dir, "bin", "python")
        
    # We use python -m uvicorn instead of uvicorn executable to avoid path issues
    backend_cmd = [python_exe, "-m", "uvicorn", "backend.main:app", "--reload", "--reload-dir", "backend", "--reload-dir", "utilities"]
    
    # Start processes
    backend_proc = subprocess.Popen(backend_cmd, cwd=base_dir)
    frontend_proc = subprocess.Popen(["npm", "run", "dev"], cwd=frontend_dir, shell=True)
    
    try:
        # Wait indefinitely until one of them exits or user interrupts
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Interrupted by user. Terminating processes...")
        try:
            backend_proc.terminate()
            frontend_proc.terminate()
            backend_proc.wait(timeout=5)
            frontend_proc.wait(timeout=5)
        except Exception:
            backend_proc.kill()
            frontend_proc.kill()
        print("[SHUTDOWN] Done.")

if __name__ == "__main__":
    main()

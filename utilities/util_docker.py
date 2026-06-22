import docker
import platform
import subprocess
import os


def get_docker_client() -> tuple[bool, docker.DockerClient | str]:
    """Attempts to connect to the local Docker environment."""
    try:
        client = docker.from_env()
        # Ping to ensure the daemon is actually reachable
        client.ping()
        return True, client
    except docker.errors.DockerException as e:
        return False, f"Could not connect to Docker. Is Docker running? ({str(e)})"
    except Exception as e:
        return False, str(e)

def start_docker_daemon() -> tuple[bool, str]:
    """Attempts to start Docker Desktop or the local Docker service."""
    try:
        current_os = platform.system()
        if current_os == "Windows":
            # Fix: Target the Docker Desktop app directly, not the CLI
            docker_desktop_path = r"C:\Program Files\Docker\Docker\Docker Desktop.exe"
            
            if os.path.exists(docker_desktop_path):
                # We use shell=False and pass the executable path to launch the UI/Daemon
                subprocess.Popen([docker_desktop_path])
                return True, "Launching Docker Desktop..."
            else:
                return False, "Docker Desktop executable not found at default location."
                
        elif current_os == "Darwin":
            subprocess.Popen(["open", "-a", "Docker"])
            return True, "Launching Docker Desktop..."
        else:
            # Linux fallback
            subprocess.Popen(["sudo", "systemctl", "start", "docker"])
            return True, "Attempting to start docker service via systemctl..."
    except Exception as e:
        return False, f"Failed to start Docker: {str(e)}"

def list_containers() -> tuple[bool, list | str]:
    """Retrieves a list of all containers (both running and stopped)."""
    success, client = get_docker_client()
    if not success:
        return False, client
        
    try:
        # Get all containers, not just running ones
        containers = client.containers.list(all=True)
        
        container_data = []
        for c in containers:
            if c.image.tags:
                image_display = ", ".join(c.image.tags)
            else:
                image_display = c.image.short_id

            container_data.append({
                "id": c.short_id,
                "name": c.name,
                "status": c.status, 
                "image": image_display,
                "ports": c.ports,
                "raw_obj": c
            })
            
        return True, container_data
    except Exception as e:
        return False, f"Failed to list containers: {str(e)}"

def container_action(container_id: str, action: str) -> tuple[bool, str]:
    """Performs start, stop, or restart actions on a specific container."""
    success, client = get_docker_client()
    if not success:
        return False, client
        
    try:
        container = client.containers.get(container_id)
        
        if action == "start":
            container.start()
            return True, f"Started container: {container.name}"
        elif action == "stop":
            container.stop()
            return True, f"Stopped container: {container.name}"
        elif action == "restart":
            container.restart()
            return True, f"Restarted container: {container.name}"
        else:
            return False, f"Unknown action: {action}"
            
    except docker.errors.NotFound:
        return False, f"Container {container_id} not found."
    except Exception as e:
        return False, f"Action '{action}' failed: {str(e)}"
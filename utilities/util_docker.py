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

            compose_project = c.labels.get('com.docker.compose.project') if c.labels else None
            compose_working_dir = c.labels.get('com.docker.compose.project.working_dir') if c.labels else None
            compose_config_files = c.labels.get('com.docker.compose.project.config_files') if c.labels else None

            container_data.append({
                "id": c.short_id,
                "name": c.name,
                "status": c.status, 
                "image": image_display,
                "ports": c.ports,
                "compose_project": compose_project,
                "compose_working_dir": compose_working_dir,
                "compose_config_files": compose_config_files,
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

def get_compose_file_path(project_name: str) -> tuple[bool, str]:
    success, data = list_containers()
    if not success:
        return False, data
        
    for c in data:
        if c.get("compose_project") == project_name:
            working_dir = c.get("compose_working_dir")
            config_files = c.get("compose_config_files")
            
            if working_dir and config_files:
                import os
                first_config = config_files.split(',')[0]
                
                if os.path.isabs(first_config):
                    path = first_config
                else:
                    path = os.path.join(working_dir, first_config)
                    
                if os.path.exists(path):
                    return True, path
                else:
                    return False, f"Compose file not found at {path}"
                    
    return False, f"Project '{project_name}' not found or has no compose labels."

def read_project_compose_file(project_name: str) -> tuple[bool, str]:
    success, path = get_compose_file_path(project_name)
    if not success:
        return False, path
        
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return True, f.read()
    except Exception as e:
        return False, f"Failed to read file: {str(e)}"
        
def save_project_compose_file(project_name: str, content: str) -> tuple[bool, str]:
    success, path = get_compose_file_path(project_name)
    if not success:
        return False, path
        
    try:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, "File saved successfully."
    except Exception as e:
        return False, f"Failed to write file: {str(e)}"

def compose_up_no_recreate(project_name: str) -> tuple[bool, str]:
    """Runs 'docker compose up -d --no-recreate' for the project."""
    success, path = get_compose_file_path(project_name)
    if not success:
        return False, f"Could not find compose file for project '{project_name}'. {path}"

    try:
        result = subprocess.run(
            ["docker", "compose", "-f", path, "up", "-d"],
            capture_output=True,
            text=True,
            timeout=120
        )
        output = result.stdout + result.stderr
        if result.returncode != 0:
            return False, output.strip() or "docker compose up failed."
        return True, output.strip() or "docker compose up -d completed."
    except Exception as e:
        return False, f"Failed to run docker compose up: {str(e)}"

def compose_down_v(project_name: str) -> tuple[bool, str]:
    """Runs 'docker compose down -v' for the project."""
    success, path = get_compose_file_path(project_name)
    if not success:
        return False, f"Could not find compose file for project '{project_name}'. {path}"

    try:
        result = subprocess.run(
            ["docker", "compose", "-f", path, "down", "-v"],
            capture_output=True,
            text=True,
            timeout=300
        )
        output = result.stdout + result.stderr
        if result.returncode != 0:
            return False, output.strip() or "docker compose down -v failed."
        return True, output.strip() or "docker compose down -v completed."
    except Exception as e:
        return False, f"Failed to run docker compose down -v: {str(e)}"
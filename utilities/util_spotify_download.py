import subprocess
import os

def download_playlist_cli(playlist_url: str, output_dir: str, audio_format: str, bitrate: str) -> bool:
    """Uses the spotDL CLI directly to avoid Python threading/asyncio conflicts."""
    
    # Construct the spotdl command
    # --format, --bitrate, and --output are standard spotDL CLI flags
    cmd = [
        "spotdl",
        playlist_url,
        "--format", audio_format,
        "--bitrate", bitrate,
        "--output", os.path.join(output_dir, "{artists} - {title}.{output-ext}")
    ]
    
    try:
        # Run the command and let it handle its own terminal output
        # shell=False for security, check=True raises an error if it fails
        subprocess.run(cmd, check=True)
        return True
    except subprocess.CalledProcessError:
        return False



def stream_spotdl_download(playlist_url: str, output_dir: str, audio_format: str, bitrate: str):
    """
    Executes spotDL as a subprocess and yields output lines for Streamlit to display.
    """
    cmd = [
        "spotdl", playlist_url,
        "--format", audio_format,
        "--bitrate", bitrate,
        "--output", os.path.join(output_dir, "{artists} - {title}.{output-ext}")
    ]
    
    # Run the process. 'bufsize=1' and 'universal_newlines=True' 
    # ensure we get text line-by-line in real-time.
    process = subprocess.Popen(
        cmd, 
        stdout=subprocess.PIPE, 
        stderr=subprocess.STDOUT, 
        text=True, 
        bufsize=1
    )
    
    # Yield output lines as they are produced
    for line in iter(process.stdout.readline, ''):
        yield line
        
    process.stdout.close()
    process.wait()
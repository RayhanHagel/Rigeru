import os
import asyncio
import json
import subprocess

# Global Path Management
CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")

def _ensure_paths():
    """Ensures that the cache temporary directory exists."""
    os.makedirs(TEMP_DIR, exist_ok=True)

NODE_SCRAPER_PATH = os.path.join(os.path.dirname(__file__), "playwright_scraper", "scraper.js")

def _run_node_scraper(payload: dict) -> dict:
    """Executes the Playwright Node.js scraper script with a JSON payload."""
    process = subprocess.Popen(
        ["node", NODE_SCRAPER_PATH],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8"
    )
    stdout, stderr = process.communicate(json.dumps(payload))
    if process.returncode != 0:
        raise RuntimeError(f"Node scraper failed: {stderr}")
    try:
        lines = stdout.strip().split('\n')
        return json.loads(lines[-1])
    except Exception as e:
        raise RuntimeError(f"Failed to parse Node scraper output: {stdout}. Error: {e}")

def run_headless_scraper(links: list, css_selector: str, headless: bool = True) -> tuple:
    """
    Uses Node Playwright to navigate to a list of URLs and extract text concurrently.
    """
    try:
        payload = {
            "action": "scrape",
            "links": links,
            "css_selector": css_selector,
            "headless": headless
        }
        res = _run_node_scraper(payload)
        if not res.get("success"):
            return False, res.get("error", "Unknown error in Node scraper")
            
        results = res.get("data", [])
        if not results:
            return False, "No valid links provided or no data could be extracted."
            
        return True, results

    except Exception as e:
        return False, f"Scraping engine error: {str(e)}."

def get_page_preview_image(url: str) -> tuple[bool, str]:
    """Takes a screenshot of the target URL using Playwright for preview purposes."""
    # Ensure static/temp exists
    static_temp = os.path.join(os.path.dirname(os.path.dirname(__file__)), "temp")
    os.makedirs(static_temp, exist_ok=True)
    output_path = os.path.join(static_temp, "preview_screenshot.png")
    
    try:
        payload = {
            "action": "preview",
            "url": url,
            "outputPath": output_path
        }
        res = _run_node_scraper(payload)
        if res.get("success"):
            return True, output_path
        else:
            return False, f"Failed to load preview: {res.get('error')}"
    except Exception as e:
        return False, f"Failed to load preview: {str(e)}"

# export_scraper_data removed as it was unused
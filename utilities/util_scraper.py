import os
import asyncio
from playwright.async_api import async_playwright
import pandas as pd

# Global Path Management
CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")

def _ensure_paths():
    os.makedirs(TEMP_DIR, exist_ok=True)

async def _fetch_url(context, url: str, css_selector: str) -> list:
    """Async worker handling a single URL."""
    clean_url = url.strip()
    if not clean_url:
        return []

    if not clean_url.startswith('http'):
        clean_url = 'https://' + clean_url

    page = await context.new_page()
    try:
        await page.goto(clean_url, wait_until="domcontentloaded", timeout=20000)
        await page.wait_for_timeout(1500)

        # O(1) JavaScript evaluation mapping in the browser engine directly
        extracted_texts = await page.locator(css_selector).evaluate_all(
            "els => els.map(el => el.innerText.trim()).filter(t => t !== '')"
        )

        await page.close()
        
        if extracted_texts:
            return [{"Target URL": clean_url, "Extracted Data": item} for item in extracted_texts]
        else:
            return [{"Target URL": clean_url, "Extracted Data": "[No matching elements found]"}]
            
    except Exception as e:
        await page.close()
        return [{"Target URL": clean_url, "Extracted Data": f"[Error: {str(e)}]"}]

async def _run_headless_scraper_async(links: list, css_selector: str):
    """Orchestrator for asynchronous Playwright."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        
        tasks = [_fetch_url(context, url, css_selector) for url in links]
        results_nested = await asyncio.gather(*tasks)
        
        await browser.close()
        
        # Flatten the nested results array
        return [item for sublist in results_nested for item in sublist]

def run_headless_scraper(links: list, css_selector: str) -> tuple:
    """
    Uses Playwright to navigate to a list of URLs and extract text concurrently.
    """
    try:
        results = asyncio.run(_run_headless_scraper_async(links, css_selector))
        
        if not results:
            return False, "No valid links provided or no data could be extracted."
            
        return True, pd.DataFrame(results)

    except Exception as e:
        return False, f"Scraping engine error: {str(e)}. (Did you run `playwright install`?)"

def get_page_preview_image(url: str, output_path: str) -> tuple[bool, str]:
    """Takes a screenshot of the target URL using Playwright for preview purposes."""
    _ensure_paths()
    from utilities.util_playwright import get_sync_page  # Assuming this remains standard for pure-sync UI actions
    
    try:
        with get_sync_page(headless=True, viewport={"width": 1280, "height": 800}) as page:
            if not url.startswith('http'):
                url = 'https://' + url

            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(2000) 
            page.screenshot(path=output_path, full_page=False)

        return True, output_path
    except Exception as e:
        return False, f"Failed to load preview: {str(e)}"

def export_scraper_data(df) -> bytes:
    import io
    output = io.BytesIO()
    df.to_csv(output, index=False)
    return output.getvalue()
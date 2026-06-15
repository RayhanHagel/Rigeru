import os
from utilities.util_playwright import get_sync_page

# Global Path Management
CACHE_DIR = os.path.join(".", "cache")
TEMP_DIR = os.path.join(CACHE_DIR, "temp")

def _ensure_paths():
    os.makedirs(TEMP_DIR, exist_ok=True)

def run_headless_scraper(links: list, css_selector: str) -> tuple:
    """
    Uses Playwright to navigate to a list of URLs and extract text from
    elements matching the provided CSS selector.
    """
    import pandas as pd
    results = []

    try:
        with get_sync_page(headless=True) as page:
            for url in links:
                clean_url = url.strip()
                if not clean_url:
                    continue

                if not clean_url.startswith('http'):
                    clean_url = 'https://' + clean_url

                try:
                    page.goto(clean_url, wait_until="domcontentloaded", timeout=20000)
                    page.wait_for_timeout(1500)

                    elements = page.locator(css_selector).all()

                    extracted_texts = []
                    for el in elements:
                        text = el.inner_text().strip()
                        if text:
                            extracted_texts.append(text)

                    if extracted_texts:
                        for item in extracted_texts:
                            results.append({"Target URL": clean_url, "Extracted Data": item})
                    else:
                        results.append({"Target URL": clean_url, "Extracted Data": "[No matching elements found]"})

                except Exception as e:
                    results.append({"Target URL": clean_url, "Extracted Data": f"[Error: {str(e)}]"})

        if not results:
            return False, "No valid links provided or no data could be extracted."

        return True, pd.DataFrame(results)

    except Exception as e:
        return False, f"Scraping engine error: {str(e)}. (Did you run `playwright install`?)"

def get_page_preview_image(url: str, output_path: str) -> tuple[bool, str]:
    """
    Takes a screenshot of the target URL using Playwright for preview purposes.
    Bypasses iframe X-Frame-Options blocking by rendering an actual image.
    """
    _ensure_paths()

    try:
        with get_sync_page(headless=True, viewport={"width": 1280, "height": 800}) as page:
            if not url.startswith('http'):
                url = 'https://' + url

            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(2000) # Let assets load before screenshot

            page.screenshot(path=output_path, full_page=False)

        return True, output_path

    except Exception as e:
        return False, f"Failed to load preview: {str(e)}"

def export_scraper_data(df) -> bytes:
    """Converts the scraped DataFrame to CSV bytes for downloading."""
    import io
    output = io.BytesIO()
    df.to_csv(output, index=False)
    return output.getvalue()
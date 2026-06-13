import os

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
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False, "Playwright is not installed. Run: `pip install playwright`"

    results = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = context.new_page()

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

            browser.close()

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
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False, "Playwright is not installed. Run: `pip install playwright`"

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )
            page = context.new_page()

            if not url.startswith('http'):
                url = 'https://' + url

            page.goto(url, wait_until="domcontentloaded", timeout=20000)
            page.wait_for_timeout(2000) # Let assets load before screenshot

            page.screenshot(path=output_path, full_page=False)
            browser.close()

        return True, output_path

    except Exception as e:
        return False, f"Failed to load preview: {str(e)}"

def export_scraper_data(df) -> bytes:
    """Converts the scraped DataFrame to CSV bytes for downloading."""
    import io
    output = io.BytesIO()
    df.to_csv(output, index=False)
    return output.getvalue()
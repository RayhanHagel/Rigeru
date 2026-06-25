from contextlib import asynccontextmanager, contextmanager

# Standardized User Agent to help bypass basic blocks
DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

@asynccontextmanager
async def get_async_stealth_page(headless: bool = True, viewport: dict = None):
    """
    Yields an asynchronous Playwright page injected with stealth scripts 
    and evasion arguments to bypass anti-bot systems.
    """
    try:
        from playwright.async_api import async_playwright
        from playwright_stealth import Stealth
    except ImportError:
        raise ImportError("Missing dependencies. Run: pip install playwright playwright-stealth")

    if viewport is None:
        viewport = {"width": 1920, "height": 1080}
        
    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(
            headless=headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                f'--window-size={viewport["width"]},{viewport["height"]}',
                '--disable-infobars'
            ]
        )

        context = await browser.new_context(
            user_agent=DEFAULT_UA,
            viewport=viewport,
            device_scale_factor=1,
            has_touch=False,
            ignore_https_errors=True
        )

        # Additional stealth override
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        page = await context.new_page()
        try:
            yield page
        finally:
            await browser.close()

@asynccontextmanager
async def get_async_stealth_browser(headless: bool = True, viewport: dict = None):
    """
    Yields the raw Playwright browser instance.
    This allows us to spin up isolated "Incognito" contexts for every item.
    """
    try:
        from playwright.async_api import async_playwright
        from playwright_stealth import Stealth
    except ImportError:
        raise ImportError("Missing dependencies. Run: pip install playwright playwright-stealth")

    if viewport is None:
        viewport = {"width": 1920, "height": 1080}
        
    async with Stealth().use_async(async_playwright()) as p:
        browser = await p.chromium.launch(
            headless=headless,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                f'--window-size={viewport["width"]},{viewport["height"]}',
                '--disable-infobars'
            ]
        )
        
        try:
            yield browser
        finally:
            await browser.close()

@contextmanager
def get_sync_page(headless: bool = True, viewport: dict = None):
    """
    Yields a standard, synchronous Playwright page for basic scraping tasks.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise ImportError("Missing dependencies. Run: pip install playwright")

    if viewport is None:
        viewport = {"width": 1280, "height": 800}
        
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(
            user_agent=DEFAULT_UA,
            viewport=viewport
        )
        page = context.new_page()
        try:
            yield page
        finally:
            browser.close()

async def smooth_scroll_to_bottom(page, distance: int = 800, delay_ms: int = 200):
    """
    Injects a JavaScript loop into the page to smoothly scroll to the bottom.
    Highly effective for triggering lazy-loaded images or infinite scrolling elements.
    """
    await page.evaluate(f"""async () => {{
        await new Promise((resolve) => {{
            let totalHeight = 0;
            const distance = {distance};
            const timer = setInterval(() => {{
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {{
                    clearInterval(timer);
                    resolve();
                }}
            }}, {delay_ms});
        }});
    }}""")
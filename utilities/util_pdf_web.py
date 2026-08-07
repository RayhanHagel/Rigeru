import asyncio

async def webpage_to_pdf(url: str) -> tuple[bool, bytes | str]:
    '''Uses Playwright to print a webpage to PDF.'''
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return False, "Missing dependency: playwright. Please install it."
        
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            if not url.startswith('http'):
                url = 'http://' + url
                
            await page.goto(url, wait_until='networkidle')
            
            pdf_bytes = await page.pdf(format='A4', print_background=True)
            
            await browser.close()
            return True, pdf_bytes
    except Exception as e:
        return False, f"Webpage to PDF failed: {str(e)}"

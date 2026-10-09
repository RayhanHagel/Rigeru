from typing import Any, Dict, List, Optional, Tuple
import asyncio

async def webpage_to_pdf(url: str) -> tuple[bool, bytes | str]:
    """

            Render a live webpage URL to an A4 PDF document using headless Playwright Chromium.

            Args:
                url (str): Remote webpage URL.

            Returns:
                tuple[bool, bytes | str]: Success flag and rendered PDF bytes or error message.
            
    """
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

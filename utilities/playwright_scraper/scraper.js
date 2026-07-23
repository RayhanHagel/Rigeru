const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { chromium: playwrightExtra } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
playwrightExtra.use(stealth);

async function main() {

    // Cloudflare DoH via Local State injection is disabled.
    // Chromium headless mode (chrome-headless-shell) completely ignores Local State DoH settings.
    // If DNS bypass is needed, please enable DNS-over-HTTPS at the Windows OS level.
    const userDataDir = path.join(__dirname, '.doh_profile');
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }

    const browserContext = await playwrightExtra.launchPersistentContext(userDataDir, {
        headless: false, // Run in headful mode to support DoH and improve Cloudflare bypass
        ignoreHTTPSErrors: true,
        args: [
            '--window-position=-32000,-32000', // Move window off-screen so it doesn't bother the user
            '--disable-blink-features=AutomationControlled',
        ]
    });

    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false
    });

    rl.on('line', async (line) => {
        if (!line.trim()) return;
        let data;
        try {
            data = JSON.parse(line);
        } catch(e) {
            console.error("Invalid JSON:", line);
            process.exit(1);
        }

        const action = data.action;
        try {
            if (action === 'scrape') {
                await handleScrape(browserContext, data);
            } else if (action === 'preview') {
                await handlePreview(browserContext, data);
            } else if (action === 'proxy') {
                await handleProxy(browserContext, data);
            } else if (action === 'manga_asura') {
                await handleMangaAsura(browserContext, data);
            } else if (action === 'price_monitor') {
                await handlePriceMonitor(browserContext, data);
            } else {
                console.error("Unknown action:", action);
            }
        } catch (e) {
            console.error("Error processing action:", e);
        } finally {
            try { await browserContext.close(); } catch(e) {}
            process.exit(0);
        }
    });
}

async function handleScrape(context, { url, css_selector }) {
    const page = await context.newPage();
    if (!url.startsWith('http')) url = 'https://' + url;
    
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1500);
        
        const extracted = await page.locator(css_selector).evaluateAll(els => 
            els.map(el => {
                let data = { tag: el.tagName.toLowerCase() };
                if (data.tag === 'table') {
                    let rows = [];
                    el.querySelectorAll('tr').forEach(tr => {
                        let rowData = [];
                        tr.querySelectorAll('th, td').forEach(cell => rowData.push(cell.innerText.trim()));
                        if (rowData.length > 0) rows.push(rowData);
                    });
                    data.table_data = rows;
                } else if (data.tag === 'ul' || data.tag === 'ol') {
                    let items = [];
                    el.querySelectorAll('li').forEach(li => items.push(li.innerText.trim()));
                    data.list_items = items;
                } else {
                    data.text = el.innerText.trim();
                }
                if (el.href) data.href = el.href;
                if (el.src) data.src = el.src;
                if (el.getAttribute('content')) data.content = el.getAttribute('content');
                return data;
            }).filter(d => (d.text && d.text !== '') || (d.table_data && d.table_data.length > 0) || (d.list_items && d.list_items.length > 0) || d.src || d.href || d.content)
        );
        console.log(JSON.stringify({ success: true, data: extracted }));
    } catch (e) {
        console.log(JSON.stringify({ success: false, error: e.message }));
    } finally {
        await page.close();
    }
}

async function handlePreview(context, { url, outputPath }) {
    const page = await context.newPage();
    if (!url.startsWith('http')) url = 'https://' + url;
    try {
        await page.goto(url);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: outputPath, fullPage: false });
        console.log(JSON.stringify({ success: true, path: outputPath }));
    } catch(e) {
        console.log(JSON.stringify({ success: false, error: e.message }));
    } finally {
        await page.close();
    }
}

async function handleProxy(context, { url }) {
    const page = await context.newPage();
    if (!url.startsWith('http')) url = 'https://' + url;
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        const html = await page.content();
        console.log(JSON.stringify({ success: true, html: html }));
    } catch(e) {
        console.log(JSON.stringify({ success: false, error: e.message }));
    } finally {
        await page.close();
    }
}

async function handleMangaAsura(context, { url }) {
    await context.route("**/*", route => {
        if (route.request().resourceType() === 'image') {
            route.abort();
        } else {
            route.continue();
        }
    });

    const page = await context.newPage();
    if (!url.startsWith('http')) url = 'https://' + url;
    
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 800;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200);
            });
        });
        await page.waitForTimeout(1500);
        const html = await page.content();
        console.log(JSON.stringify({ success: true, html: html }));
    } catch(e) {
        console.log(JSON.stringify({ success: false, error: e.message }));
    } finally {
        await context.unroute("**/*");
        await page.close();
    }
}

async function handlePriceMonitor(context, { url }) {
    await context.clearCookies();
    if (url.toLowerCase().includes("steampowered.com")) {
        try {
            await context.addCookies([
                {name: "birthtime", value: "283993201", domain: "store.steampowered.com", path: "/"},
                {name: "lastagecheckage", value: "1-January-1900", domain: "store.steampowered.com", path: "/"}
            ]);
        } catch(e) {}
    }
    
    const page = await context.newPage();
    try {
        let response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(e => e);
        if (response instanceof Error && (response.message.includes('Timeout') || response.message.includes('timeout'))) {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
        }
        
        await page.waitForTimeout(3000 + Math.random() * 2000);
        
        const domain = url.toLowerCase();
        let price_text = "";
        let original_price_text = "";
        let discount_text = "";
        
        if (domain.includes("amazon")) {
            let p = await page.$('.a-price .a-offscreen, #priceblock_ourprice');
            if (p) price_text = await p.innerText();
            let o = await page.$('.a-text-strike, .a-text-price .a-offscreen');
            if (o) original_price_text = await o.innerText();
        } else if (domain.includes("ebay")) {
            let p = await page.$('.x-price-primary, #prcIsum');
            if (p) price_text = await p.innerText();
            let o = await page.$('.ux-textspans--STRIKETHROUGH');
            if (o) original_price_text = await o.innerText();
        } else if (domain.includes("shopee")) {
            let p = await page.$('.pqTWkA, .p1N00a, div:has-text("Rp")');
            if (p) price_text = await p.innerText();
            let o = await page.$('div[style*="line-through"]');
            if (o) original_price_text = await o.innerText();
        } else if (domain.includes("tokopedia")) {
            let p = await page.$('[data-testid="lblPDPDetailProductPrice"], .price');
            if (p) price_text = await p.innerText();
            let o = await page.$('[data-testid="lblPDPDetailOriginalPrice"]');
            if (o) original_price_text = await o.innerText();
            let d = await page.$('[data-testid="lblPDPDetailDiscountPercentage"]');
            if (d) discount_text = await d.innerText();
        } else if (domain.includes("steampowered.com")) {
            let p = await page.$('.discount_final_price, .game_purchase_price');
            if (p) price_text = await p.innerText();
            let o = await page.$('.discount_original_price');
            if (o) original_price_text = await o.innerText();
            let d = await page.$('.discount_pct');
            if (d) discount_text = await d.innerText();
        } else {
            price_text = await page.innerText("body");
        }
        
        console.log(JSON.stringify({
            success: true,
            price_text,
            original_price_text,
            discount_text
        }));
    } catch(e) {
        console.log(JSON.stringify({ success: false, error: e.message }));
    } finally {
        await page.close();
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});

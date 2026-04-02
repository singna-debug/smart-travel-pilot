
import fetch from 'node-fetch';
import puppeteer from 'puppeteer';

const url = 'https://www.modetour.com/package/106173541';

async function audit() {
    console.log(`\n=== SPEED AUDIT START: ${url} ===\n`);
    const start = Date.now();

    // 1. HTTP FAST PATH TEST
    console.log('[1/3] Testing HTTP Fast Path...');
    const t1 = Date.now();
    try {
        const res = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            timeout: 10000
        });
        const html = await res.text();
        const hasNextData = html.includes('id="__NEXT_DATA__"');
        console.log(`      > Result: ${hasNextData ? 'FOUND' : 'NOT FOUND'}`);
        console.log(`      > Time: ${(Date.now() - t1) / 1000}s`);
    } catch (e) {
        console.log(`      > Error: ${e.message}`);
    }

    // 2. PUPPETEER EARLY EXIT TEST
    console.log('\n[2/3] Testing Puppeteer Early Exit...');
    const t2 = Date.now();
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        
        console.log('      > Navigating...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const hasNextData = await page.evaluate(() => !!document.querySelector('#__NEXT_DATA__'));
        console.log(`      > NextData Found: ${hasNextData}`);
        
        await browser.close();
        console.log(`      > Time: ${(Date.now() - t2) / 1000}s`);
    } catch (e) {
        console.log(`      > Error: ${e.message}`);
        if (browser) await browser.close();
    }

    // 3. PUPPETEER FULL SCAN (IF NEEDED)
    console.log('\n[3/3] Testing Full Scroll Scan (Old Bottleneck)...');
    const t3 = Date.now();
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        
        // Simulate the scroll/click loop
        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                window.scrollBy(0, 2000);
                await new Promise(r => setTimeout(r, 200));
            }
        });
        
        await browser.close();
        console.log(`      > Time: ${(Date.now() - t3) / 1000}s`);
    } catch (e) {
        console.log(`      > Error: ${e.message}`);
        if (browser) await browser.close();
    }

    console.log(`\n=== AUDIT COMPLETE. Total Potential Data Path: ${(Date.now() - start) / 1000}s ===\n`);
}

audit();


import fetch from 'node-fetch';
import puppeteer from 'puppeteer';

const url = 'https://www.modetour.com/package/106173541';

async function diagnostic() {
    console.log(`\n=== 69s LATENCY DIAGNOSTIC: ${url} ===\n`);
    const start = Date.now();

    // 1. HTTP FETCH LATENCY
    console.log('[1/3] Measuring Direct HTTP Fetch Latency...');
    const t1 = Date.now();
    try {
        const res = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
        });
        const html = await res.text();
        console.log(`      > Status: ${res.status}`);
        console.log(`      > Length: ${html.length}`);
        console.log(`      > Time: ${(Date.now() - t1) / 1000}s`);
    } catch (e) {
        console.log(`      > Error: ${e.message} (After ${(Date.now() - t1) / 1000}s)`);
    }

    // 2. NATIVE API LATENCY
    console.log('\n[2/3] Measuring Native API Latency...');
    const t2 = Date.now();
    try {
        const productNo = '106173541'; // From URL
        const apiUrl = `https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`;
        const res = await fetch(apiUrl, { timeout: 10000 });
        const json = await res.json();
        console.log(`      > Native Result OK: ${!!json}`);
        console.log(`      > Time: ${(Date.now() - t2) / 1000}s`);
    } catch (e) {
        console.log(`      > Error: ${e.message} (After ${(Date.now() - t2) / 1000}s)`);
    }

    // 3. PUPPETEER LATENCY
    console.log('\n[3/3] Measuring Puppeteer Latency...');
    const t3 = Date.now();
    let browser;
    try {
        browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await browser.close();
        console.log(`      > Time: ${(Date.now() - t3) / 1000}s`);
    } catch (e) {
        console.log(`      > Error: ${e.message} (After ${(Date.now() - t3) / 1000}s)`);
        if (browser) await browser.close();
    }

    const total = (Date.now() - start) / 1000;
    console.log(`\n=== DIAGNOSTIC COMPLETE. Total Serial Time: ${total}s ===\n`);
    
    if (total > 50) {
        console.log('!!! WARNING: Serial execution is indeed exceeding 50-60s limit.');
    }
}

diagnostic();

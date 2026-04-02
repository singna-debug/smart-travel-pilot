
const puppeteer = require('puppeteer');

async function testScrape(url) {
    console.log(`[TEST] Starting Scrape for: ${url}`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // [핵심] Stealth 설정: 자동화 도구 감지 회피
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // User-Agent 설정
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        console.log('[TEST] Navigating with Stealth...');
        const response = await page.goto(url, { waitUntil: 'load', timeout: 40000 });
        
        console.log(`[TEST] HTTP Status: ${response.status()}`);
        console.log(`[TEST] Final URL: ${page.url()}`);
        console.log(`[TEST] Document Title: ${await page.title()}`);

        // 초기 바디 길아 확인
        const initialLength = await page.evaluate(() => document.body.innerText.length);
        console.log(`[TEST] Initial Body Length: ${initialLength}`);

        // 핵심 위젯 대기
        console.log('[TEST] Waiting for .itinerary_wrap...');
        const found = await page.waitForSelector('.itinerary_wrap, .itinerary_list, .schedule_wrap, .schedule_detail', { timeout: 10000 }).catch(() => null);
        console.log(`[TEST] Selector found: ${!!found}`);

        // 스크롤 루프 재현
        console.log('[TEST] Starting Scroll Loop (4500px * 8)...');
        for (let i = 0; i < 8 ; i++) {
            await page.evaluate(() => window.scrollBy(0, 4500));
            await new Promise(r => setTimeout(r, 500));
            
            const currentLen = await page.evaluate(() => document.body.innerText.length);
            const hasItinerary = await page.evaluate(() => !!document.querySelector('.itinerary_wrap, .itinerary_list, .schedule_wrap, .schedule_detail'));
            console.log(`[TEST] Loop ${i+1}: TextLength=${currentLen}, hasItinerary=${hasItinerary}`);
        }

        const finalContent = await page.evaluate(() => document.body.innerText);
        const nextData = await page.evaluate(() => {
            const script = document.getElementById('__NEXT_DATA__');
            return script ? script.textContent : null;
        });

        console.log(`[TEST] Final Scraped Length: ${finalContent.length}`);
        console.log(`[TEST] NextData Found: ${!!nextData} (Length: ${nextData?.length || 0})`);
        
        if (nextData) {
            console.log(`[TEST] NextData Sample (First 500 chars):\n${nextData.substring(0, 500)}`);
        }
        
        if (finalContent.length < 1500 && !nextData) {
            console.log('[TEST] CRITICAL: Both text and __NEXT_DATA__ are missing. Truly BLOCKED.');
        } else {
            console.log('[TEST] SUCCESS: Data source captured.');
        }

    } catch (err) {
        console.error('[TEST] ERROR:', err.message);
    } finally {
        await browser.close();
    }
}

const targetUrl = process.argv[2] || 'https://www.modetour.com/package/100955975';
testScrape(targetUrl);

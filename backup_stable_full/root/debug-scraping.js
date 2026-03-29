
const puppeteer = require('puppeteer');

(async () => {
    const url = 'https://www.modetour.com/package/99693648';
    console.log(`Debug Scraping URL: ${url}`);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: true, // Use headless
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // 1. Desktop UA
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });

        // 2. Resource blocking (Allow stylesheets!)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'font', 'media'].includes(resourceType)) { // Block images/fonts but allow stylesheets
                req.abort();
            } else {
                req.continue();
            }
        });

        console.log('[Browser] Navigating (10s limit)...');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

        console.log('[Browser] Scrolling (Top 4000px)...');
        await page.evaluate(async () => {
            const maxScroll = 4000;
            const scrollStep = 1000;
            let currentScroll = 0;
            while (currentScroll < maxScroll && currentScroll < document.body.scrollHeight) {
                currentScroll += scrollStep;
                window.scrollTo(0, currentScroll);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });

        // Wait 1000ms
        await new Promise(resolve => setTimeout(resolve, 1000));

        const content = await page.evaluate(() => {
            const scripts = document.querySelectorAll('script, style, noscript');
            scripts.forEach(s => s.remove());
            return document.body.innerText;
        });

        console.log(`Extracted content length: ${content.length}`);

        const hasKeyPoints = content.includes('상품 POINT') || content.includes('상품포인트');
        console.log(`Has '상품 POINT'? ${hasKeyPoints}`);

        const keyPointIdx = content.indexOf('상품 POINT');
        if (keyPointIdx !== -1) {
            console.log(`'상품 POINT' context: ${content.substring(keyPointIdx, keyPointIdx + 500).replace(/\n/g, ' ')}`);
        }

        const hasNoOption = content.includes('노옵션') || content.includes('선택관광 없음');
        console.log(`Has '노옵션/선택관광 없음'? ${hasNoOption}`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();

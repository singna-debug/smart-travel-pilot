const puppeteer = require('puppeteer');

(async () => {
    console.log('Testing Puppeteer...');
    try {
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.goto('https://example.com');
        const text = await page.evaluate(() => document.body.innerText);
        console.log('Extracted:', text.substring(0, 50));
        await browser.close();
        console.log('Success!');
    } catch (e) {
        console.error('Error:', e);
    }
})();


import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

async function debugTargetUrl(url: string, suffix: string) {
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    if (!apiKey) {
        console.error('SCRAPINGBEE_API_KEY missing');
        return;
    }

    console.log(`[Debug] Fetching via ScrapingBee (Simple) [${suffix}]: ${url}`);

    // Minimal parameters to avoid 400 errors
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=5000&timeout=35000`;

    try {
        const response = await fetch(scrapingBeeUrl);
        const html = await response.text();
        console.log(`[Debug] [${suffix}] Received HTML length: ${html.length}`);

        fs.writeFileSync(`scrapingbee_raw_${suffix}.html`, html);

        // Also run the htmlToText logic
        const { htmlToText } = await import('./lib/url-crawler');
        const text = htmlToText(html);
        fs.writeFileSync(`scrapingbee_text_${suffix}.txt`, text);
        console.log(`[Debug] [${suffix}] Text output saved to scrapingbee_text_${suffix}.txt`);

    } catch (e) {
        console.error(`[Debug Error] [${suffix}]`, e);
    }
}

// 1. Kyushu 3-day (The one failing previously)
const kyrshuUrl = 'https://www.modetour.com/package/102840987';
// 2. Nha Trang (The one I just saw working in the debug log?)
const nhatrangUrl = 'https://www.modetour.com/package/103328574'; // I'll assume this is common

async function run() {
    await debugTargetUrl(kyrshuUrl, 'kyushu');
}
run();

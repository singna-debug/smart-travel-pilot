
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

async function debugTargetUrl(url: string, suffix: string) {
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    if (!apiKey) {
        console.error('SCRAPINGBEE_API_KEY missing');
        return;
    }

    console.log(`[Debug] Fetching via ScrapingBee (Clean Session) [${suffix}]: ${url}`);

    // Attempting to force a clean session and bypass any redirects
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=5000&timeout=35000&block_ads=true&block_resources=false`;

    try {
        const response = await fetch(scrapingBeeUrl);
        const html = await response.text();
        console.log(`[Debug] [${suffix}] Received HTML length: ${html.length}`);

        fs.writeFileSync(`scrapingbee_raw_clean_${suffix}.html`, html);

        const hasKyushu = html.includes('큐슈') || html.includes('후쿠오카');
        const hasNhatrang = html.includes('나트랑');

        console.log(`[Results] [${suffix}]
            Has Kyushu/Fukuoka: ${hasKyushu}
            Has Nha Trang: ${hasNhatrang}
        `);

        // Also run the htmlToText logic
        const { htmlToText } = await import('./lib/url-crawler');
        const text = htmlToText(html);
        fs.writeFileSync(`scrapingbee_text_clean_${suffix}.txt`, text);
        console.log(`[Debug] [${suffix}] Text output saved to scrapingbee_text_clean_${suffix}.txt`);

    } catch (e) {
        console.error(`[Debug Error] [${suffix}]`, e);
    }
}

const kyrshuUrl = 'https://www.modetour.com/package/102840987';
debugTargetUrl(kyrshuUrl, 'kyushu_clean');

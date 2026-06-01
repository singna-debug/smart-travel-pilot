
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

async function debugTargetUrl(url: string, suffix: string) {
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    if (!apiKey) {
        console.error('SCRAPINGBEE_API_KEY missing');
        return;
    }

    console.log(`[Debug] Fetching via ScrapingBee (Stealth/Premium) [${suffix}]: ${url}`);

    // Using premium proxy and steering to ensure it reaching the correct localized page
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=8000&timeout=40000&premium_proxy=true&country_code=kr&wait_browser=networkidle0`;

    try {
        const response = await fetch(scrapingBeeUrl);
        const html = await response.text();
        console.log(`[Debug] [${suffix}] Received HTML length: ${html.length}`);

        fs.writeFileSync(`scrapingbee_raw_final_${suffix}.html`, html);

        const hasKyushu = html.includes('큐슈') || html.includes('후쿠오카');
        const hasPrice = html.includes('799,000') || html.includes('799000');

        console.log(`[Results] [${suffix}]
            Has Kyushu/Fukuoka: ${hasKyushu}
            Has Price: ${hasPrice}
        `);

        // Also run the htmlToText logic
        const { htmlToText } = await import('./lib/url-crawler');
        const text = htmlToText(html);
        fs.writeFileSync(`scrapingbee_text_final_${suffix}.txt`, text);
        console.log(`[Debug] [${suffix}] Text output saved to scrapingbee_text_final_${suffix}.txt`);

    } catch (e) {
        console.error(`[Debug Error] [${suffix}]`, e);
    }
}

const kyrshuUrl = 'https://www.modetour.com/package/102840987';
debugTargetUrl(kyrshuUrl, 'kyushu_v2');

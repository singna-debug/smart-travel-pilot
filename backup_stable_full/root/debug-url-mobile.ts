
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

async function debugTargetUrl(url: string, suffix: string) {
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    if (!apiKey) {
        console.error('SCRAPINGBEE_API_KEY missing');
        return;
    }

    console.log(`[Debug] Fetching via ScrapingBee (Forward Headers) [${suffix}]: ${url}`);

    // Mobile User Agent
    const mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";

    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=5000&timeout=35000&forward_headers=true`;

    try {
        const response = await fetch(scrapingBeeUrl, {
            headers: {
                "User-Agent": mobileUA
            }
        });
        const html = await response.text();
        console.log(`[Debug] [${suffix}] Received HTML length: ${html.length}`);

        fs.writeFileSync(`scrapingbee_raw_mobile_${suffix}.html`, html);

        const hasKyushu = html.includes('큐슈') || html.includes('후쿠오카');
        const hasPrice = html.includes('799,000') || html.includes('799000');
        const hasAirline = html.includes('제주항공') || html.includes('7C1401');

        console.log(`[Results] [${suffix}]
            Has Kyushu/Fukuoka: ${hasKyushu}
            Has Price: ${hasPrice}
            Has Airline: ${hasAirline}
        `);

        // Also run the htmlToText logic
        const { htmlToText } = await import('./lib/url-crawler');
        const text = htmlToText(html);
        fs.writeFileSync(`scrapingbee_text_mobile_${suffix}.txt`, text);
        console.log(`[Debug] [${suffix}] Text output saved to scrapingbee_text_mobile_${suffix}.txt`);

    } catch (e) {
        console.error(`[Debug Error] [${suffix}]`, e);
    }
}

const kyrshuUrl = 'https://www.modetour.com/package/102840987';
debugTargetUrl(kyrshuUrl, 'kyushu_mobile');

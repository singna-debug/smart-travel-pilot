
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';

async function debugTargetUrl(url: string) {
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    if (!apiKey) {
        console.error('SCRAPINGBEE_API_KEY missing');
        return;
    }

    console.log(`[Debug] Fetching via ScrapingBee (Simple): ${url}`);

    // Minimal parameters to avoid 400 errors
    const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=5000&timeout=35000`;

    try {
        const response = await fetch(scrapingBeeUrl);
        const html = await response.text();
        console.log(`[Debug] Received HTML length: ${html.length}`);

        fs.writeFileSync('scrapingbee_raw_debug.html', html);

        const hasPrice = html.includes('799,000') || html.includes('799000');
        const hasAirline = html.includes('제주항공') || html.includes('7C1401');
        const hasDuration = html.includes('2박 3일') || html.includes('2박3일');

        console.log(`[Results] 
            Has Price: ${hasPrice}
            Has Airline: ${hasAirline}
            Has Duration: ${hasDuration}
        `);

        // Also run the htmlToText logic
        const { htmlToText } = await import('./lib/url-crawler');
        const text = htmlToText(html);
        fs.writeFileSync('scrapingbee_text_debug.txt', text);
        console.log('[Debug] Text output saved to scrapingbee_text_debug.txt');

    } catch (e) {
        console.error('[Debug Error]', e);
    }
}

const target = 'https://www.modetour.com/package/102840987';
debugTargetUrl(target);

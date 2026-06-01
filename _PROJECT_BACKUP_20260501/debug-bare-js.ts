import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const TARGET_URL = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';

async function testBareJS() {
    const key = process.env.SCRAPINGBEE_API_KEY;
    console.log("Testing Bare ScrapingBee...");

    const start = Date.now();
    const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${key}&url=${encodeURIComponent(TARGET_URL)}&render_js=true&timeout=15000`; // NO wait_browser, NO scenario

    const res = await fetch(sbUrl);
    const html = await res.text();
    const end = Date.now();

    console.log(`Time taken: ${(end - start) / 1000}s`);
    console.log(`Contains 799,000: ${html.includes('799,000') || html.includes('799000')}`);
    console.log(`Contains 제주항공: ${html.includes('제주항공')}`);
}
testBareJS().catch(console.error);

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const TARGET_URL = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';

async function testFastJS() {
    const key = process.env.SCRAPINGBEE_API_KEY;
    console.log("Testing ScrapingBee domcontentloaded...");

    // JS scenario is needed to scroll
    const jsScenario = {
        instructions: [
            { wait_for: ".title" }, // wait specifically for the title to appear
            { scroll_y: 5000 },
            { wait: 1000 }
        ]
    };

    const start = Date.now();
    const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${key}&url=${encodeURIComponent(TARGET_URL)}&render_js=true&wait_browser=domcontentloaded&js_scenario=${encodeURIComponent(JSON.stringify(jsScenario))}`;

    const res = await fetch(sbUrl);
    const html = await res.text();
    const end = Date.now();

    console.log(`Time taken: ${(end - start) / 1000}s`);
    console.log(`Contains 799,000: ${html.includes('799,000') || html.includes('799000')}`);

    const visiblePriceMatch = html.match(/(\d{1,3}(?:,\d{3})*)\s*원/);
    if (visiblePriceMatch) {
        console.log("Price Match Regex:", visiblePriceMatch[1]);
    } else {
        console.log("Price Match Regex: FAILED");
    }
}
testFastJS().catch(console.error);

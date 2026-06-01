/**
 * Test JS-rendered ScrapingBee + try calling ModeTour internal API
 */
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || '';
const TARGET_URL = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';

async function main() {
    // ===== Test 1: Try ModeTour internal API directly =====
    console.log('\n===== TEST 1: ModeTour Internal API =====');
    try {
        const apiUrl = 'https://api.modetour.com/FIT/PackageProduct/GetDetailProduct/100634999';
        const res = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const text = await res.text();
        console.log(`API Status: ${res.status}`);
        console.log(`API Response length: ${text.length}`);
        console.log(`First 500 chars: ${text.substring(0, 500)}`);
        if (text.length > 0) {
            fs.writeFileSync('debug-modetour-api.json', text.substring(0, 200000), 'utf-8');
        }
    } catch (e: any) {
        console.error('API call failed:', e.message);
    }

    // ===== Test 2: JS-rendered ScrapingBee with fixed params =====
    console.log('\n===== TEST 2: JS-Rendered ScrapingBee =====');
    try {
        const jsScenario = {
            instructions: [
                { scroll_y: 3000 },
                { wait: 2000 },
                { scroll_y: 6000 },
                { wait: 2000 }
            ]
        };

        const scenarioStr = JSON.stringify(jsScenario);
        const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${SCRAPINGBEE_API_KEY}&url=${encodeURIComponent(TARGET_URL)}&render_js=true&wait_browser=networkidle2&timeout=25000&js_scenario=${encodeURIComponent(scenarioStr)}`;

        const res = await fetch(sbUrl);
        const html = await res.text();
        console.log(`Status: ${res.status}`);
        console.log(`HTML length: ${html.length}`);
        console.log(`Starts with '<': ${html.startsWith('<')}`);
        console.log(`Starts with '{': ${html.startsWith('{')}`);

        if (html.startsWith('{')) {
            console.log('ERROR RESPONSE:', html.substring(0, 500));
        } else {
            fs.writeFileSync('debug-js-rendered.txt', html.substring(0, 200000), 'utf-8');

            // Search for price patterns
            const pricePatterns = [
                /(\d{3},\d{3})\s*원/g,
                /(\d{3},\d{3},\d{3})\s*원/g,
                /"price"\s*:\s*"?(\d+)"?/gi,
                /성인\s*[\d,]+\s*원/gi,
                /요금[^<]{0,30}[\d,]+\s*원/gi,
            ];

            for (const pattern of pricePatterns) {
                const matches = html.match(pattern);
                if (matches) {
                    console.log(`  Price pattern ${pattern}: ${matches.slice(0, 3).join(', ')}`);
                }
            }

            // Search for airline
            const airlineMatch = html.match(/(제주항공|대한항공|아시아나|진에어|티웨이|이스타|에어서울|에어부산)/);
            console.log(`  Airline: ${airlineMatch ? airlineMatch[0] : 'NOT FOUND'}`);

            // Search for departure airport
            const airportMatch = html.match(/(인천공항|인천|김포|부산|대구|청주)/);
            console.log(`  Airport: ${airportMatch ? airportMatch[0] : 'NOT FOUND'}`);
        }
    } catch (e: any) {
        console.error('ScrapingBee JS failed:', e.message);
    }

    console.log('\n===== DONE =====');
}

main().catch(console.error);

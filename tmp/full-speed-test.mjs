
import { crawlForConfirmation } from '../lib/crawlers/confirmation/index.js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = 'https://www.modetour.com/package/106173541';

async function test() {
    console.log(`\n[TEST] Starting Full Confirmation Crawl for: ${url}\n`);
    const start = Date.now();

    try {
        const result = await crawlForConfirmation(url);
        const end = Date.now();
        const duration = (end - start) / 1000;

        console.log(`\n[TEST] EXECUTION FINISHED!`);
        console.log(`      > Total Duration: ${duration}s`);
        
        if (result) {
            console.log(`      > Status: SUCCESS`);
            console.log(`      > Itinerary Days: ${result.itinerary?.length || 0}`);
            console.log(`      > Departure: ${result.departureDate} (${result.airline})`);
        } else {
            console.log(`      > Status: FAILED (null result)`);
        }

    } catch (e) {
        console.error(`\n[TEST] FATAL ERROR:`, e.name, e.message);
        console.error(e.stack);
    }
}

test();

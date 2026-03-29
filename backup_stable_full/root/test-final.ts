import { crawlTravelProduct } from './lib/url-crawler';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runTest() {
    process.env.VERCEL = '1'; // Force ScrapingBee Edge logic to test JS rendering
    const url = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';
    console.time('Crawl');
    const result = await crawlTravelProduct(url);
    console.timeEnd('Crawl');

    console.log("FINAL RESULT:", JSON.stringify({
        title: result.title,
        price: result.price,
        airline: result.airline,
        departureDate: result.departureDate,
        duration: result.duration
    }, null, 2));
}

runTest().catch(console.error);

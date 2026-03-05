import { crawlTravelProduct } from './lib/url-crawler';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testLocally() {
    process.env.VERCEL = '0'; // force local mode
    const url = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';
    console.time('Local Crawl');
    const result = await crawlTravelProduct(url);
    console.timeEnd('Local Crawl');
    console.log(JSON.stringify(result, null, 2));
}

testLocally().catch(console.error);

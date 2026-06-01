/**
 * End-to-end diagnostic of the actual Next.js API route logic
 */
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We need to import the actual functions used by the API route
// Since this is TypeScript, executing it directly might be tricky, so we'll test the core logic

import { scrapeWithScrapingBee, analyzeWithGemini, refineData } from './lib/url-crawler';

const TARGET_URL = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';

async function main() {
    console.log(`\n=== Starting API Route Diagnostic ===`);
    console.log(`Target URL: ${TARGET_URL}`);
    console.log(`ScrapingBee Key exists: ${!!process.env.SCRAPINGBEE_API_KEY}`);
    console.log(`Gemini Key exists: ${!!process.env.GEMINI_API_KEY}`);

    try {
        console.log('\n--- Calling scrapeWithScrapingBee ---');
        console.time('scrapeWithScrapingBee');
        const text = await scrapeWithScrapingBee(TARGET_URL);
        console.timeEnd('scrapeWithScrapingBee');

        if (!text) throw new Error("ScrapingBee failed to return text");

        console.time('analyzeWithGemini');
        const aiResult = await analyzeWithGemini(text, TARGET_URL);
        console.timeEnd('analyzeWithGemini');

        if (!aiResult) throw new Error("analyzeWithGemini failed");

        const result = refineData(aiResult, text, TARGET_URL);

        console.log('\n--- Result ---');
        console.log(JSON.stringify(result, null, 2));

        fs.writeFileSync('debug-api-result.json', JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error('API Diagnostic failed:', e.message);
    }
}

main().catch(console.error);

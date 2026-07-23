import * as fs from 'fs';
import * as path from 'path';
import { crawlTravelProduct } from './lib/url-crawler.ts';

// Load environment variables manually
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
    console.log('.env.local loaded');
}

async function runTest(url: string, name: string) {
    console.log(`\n========================================`);
    console.log(`Testing [${name}]: ${url}`);
    console.log(`========================================`);
    const startTime = Date.now();
    try {
        const result = await crawlTravelProduct(url);
        const duration = (Date.now() - startTime) / 1000;
        console.log(`Duration: ${duration}s`);
        if (!result) {
            console.error(`Failed to crawl ${name} (returned null)`);
            return;
        }
        console.log(`Crawl result for ${name}:`);
        console.log(`- Title: ${result.title}`);
        console.log(`- Destination: ${result.destination}`);
        console.log(`- Price: ${result.price}`);
        console.log(`- Airline: ${result.airline}`);
        console.log(`- Departure Date: ${result.departureDate}`);
        console.log(`- Return Date: ${result.returnDate}`);
        console.log(`- Duration: ${result.duration}`);
        console.log(`- Key Points Count: ${result.keyPoints?.length || 0}`);
        if (result.keyPoints) {
            console.log(`- Key Points:`, result.keyPoints.slice(0, 3));
        }
    } catch (e: any) {
        console.error(`Exception during crawling ${name}:`, e.message || e);
    }
}

async function main() {
    // 1. Very Good Tour URL
    const veryGoodTourUrl = 'https://www.verygoodtour.com/Product/PackageDetail?MasterCode=APP9163';
    await runTest(veryGoodTourUrl, 'Very Good Tour');

    // 2. Hanatour URL (User provided)
    const hanatourUrl = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=APP216260804TWC&prePage=major-products';
    await runTest(hanatourUrl, 'Hanatour Native API Crawler');
}

main().catch(console.error);

import * as fs from 'fs';
import * as path from 'path';
import { crawlForConfirmation } from './lib/crawlers/confirmation/index';

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

async function main() {
    const url = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=APP216260804TWC&prePage=major-products';
    console.log(`\n========================================`);
    console.log(`Testing Hanatour Deep/Confirmation Crawler: ${url}`);
    console.log(`========================================`);
    const startTime = Date.now();
    try {
        const result = await crawlForConfirmation(url);
        const duration = (Date.now() - startTime) / 1000;
        console.log(`\nDuration: ${duration}s`);
        if (!result) {
            console.error(`Failed to crawl Hanatour in confirmation mode (returned null)`);
            return;
        }
        console.log(`Crawl result for Hanatour (Confirmation Mode):`);
        console.log(`- Title: ${result.title}`);
        console.log(`- Destination: ${result.destination}`);
        console.log(`- Price: ${result.price}`);
        console.log(`- Airline: ${result.airline}`);
        console.log(`- Departure Date: ${result.departureDate}`);
        console.log(`- Return Date: ${result.returnDate}`);
        console.log(`- Duration: ${result.duration}`);
        console.log(`- Hotel Day 1: ${result.itinerary?.[0]?.hotel}`);
        console.log(`- Meals Day 1:`, result.itinerary?.[0]?.meals);
        console.log(`- Inclusions Count: ${result.inclusions?.length || 0}`);
        console.log(`- Exclusions Count: ${result.exclusions?.length || 0}`);
    } catch (e: any) {
        console.error(`Exception during confirmation crawling:`, e.message || e);
    }
}

main().catch(console.error);

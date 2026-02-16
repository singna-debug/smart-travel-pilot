
import * as fs from 'fs';
import * as path from 'path';
import { crawlTravelProduct } from './lib/url-crawler';

// Load environment variables manually
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
}

async function test() {
    const url = 'https://www.modetour.com/package/99693648';
    console.log(`Testing URL: ${url}`);
    const startTime = Date.now();

    try {
        const result = await crawlTravelProduct(url);
        const duration = (Date.now() - startTime) / 1000;
        console.log(`Duration: ${duration}s`);

        if (!result) {
            console.error('Failed to crawl product (null returned)');
            return;
        }

        console.log('Crawled Result:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('Error during test:', error);
    }
}

test();

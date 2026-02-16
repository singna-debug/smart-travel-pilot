
import * as fs from 'fs';
import * as path from 'path';
import { crawlTravelProduct, formatProductInfo } from './lib/url-crawler';

// Load environment variables
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

async function debug() {
    const url = 'https://www.modetour.com/package/105253592';
    console.log(`Debug URL: ${url}`);

    try {
        const result = await crawlTravelProduct(url);
        if (!result) { console.log('Result is null'); return; }

        const formatted = formatProductInfo(result);
        const debugOutput = {
            raw_title: result.title,
            keyPoints: result.keyPoints,
            features: result.features,
            hashtags: result.hashtags,
            formatted
        };

        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(
            path.join(process.cwd(), 'debug_result.json'),
            JSON.stringify(debugOutput, null, 2),
            'utf8'
        );
        console.log('Debug result saved to debug_result.json');

    } catch (e) {
        console.error(e);
    }
}

debug();

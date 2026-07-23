import * as fs from 'fs';
import * as path from 'path';
import { htmlToText, analyzeWithGemini } from './lib/crawler-base-utils.ts';

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

async function scrapeWithScrapingBee(url: string): Promise<string | null> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    if (!apiKey) {
        console.error('No ScrapingBee API Key found');
        return null;
    }

    try {
        console.log('[ScrapingBee] JS Rendering Attempt...');
        const jsScenario = {
            instructions: [
                { scroll_y: 2000 },
                { wait: 1500 },
                { scroll_y: 5000 },
                { wait: 1500 }
            ]
        };

        const scenarioStr = JSON.stringify(jsScenario);
        const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=6000&js_scenario=${encodeURIComponent(scenarioStr)}`;

        const response = await fetch(scrapingBeeUrl);
        if (response.ok) {
            const html = await response.text();
            console.log(`[ScrapingBee] Success! Raw HTML Length: ${html.length} chars`);
            fs.writeFileSync('hanatour-raw-html-scrapingbee.html', html, 'utf-8');
            return htmlToText(html, url);
        } else {
            console.error(`[ScrapingBee] Error: HTTP ${response.status} - ${await response.text()}`);
        }
    } catch (e: any) {
        console.error('[ScrapingBee] Failed:', e.message);
    }
    return null;
}

async function main() {
    const url = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=APP216260804TWC&prePage=major-products';
    console.log(`Starting ScrapingBee test for URL: ${url}`);
    
    const text = await scrapeWithScrapingBee(url);
    if (text) {
        console.log(`Cleaned Text Length: ${text.length} chars`);
        fs.writeFileSync('hanatour-text-scrapingbee.txt', text, 'utf-8');
        
        console.log('Analyzing with Gemini...');
        const result = await analyzeWithGemini(text, url, false);
        console.log('Gemini Analysis Result:');
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.error('ScrapingBee failed to return content');
    }
}

main().catch(console.error);

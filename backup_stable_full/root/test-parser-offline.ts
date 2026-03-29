
import * as fs from 'fs';
import * as path from 'path';
import { fallbackParse, formatProductInfo } from './lib/url-crawler';

async function test() {
    const filePath = path.join(process.cwd(), 'debug_clean_text.txt');
    if (!fs.existsSync(filePath)) {
        console.error('debug_clean_text.txt not found');
        return;
    }

    const text = fs.readFileSync(filePath, 'utf8');
    console.log(`Loaded text length: ${text.length}`);

    const url = 'https://www.modetour.com/package/99693648'; // Dummy URL
    const result = fallbackParse(text, url);

    console.log('--- Verification ---');
    console.log(`Title: ${result.title}`);
    console.log(`Features: ${result.features.join(', ')}`);
    console.log(`Hashtags: "${result.hashtags}"`);
    console.log(`KeyPoints Count: ${result.keyPoints.length}`);
    if (result.keyPoints.length > 0) {
        console.log(`First KeyPoint: ${result.keyPoints[0]}`);
    }

    const formatted = formatProductInfo(result);
    // Check if hashtags exist in formatted output
    const hasHashtags = formatted.includes('#');
    console.log(`Formatted has hashtags? ${hasHashtags}`);
    if (hasHashtags) {
        // Print the lines with hashtags
        const lines = formatted.split('\n');
        const tagLines = lines.filter(l => l.includes('#'));
        console.log(`Hashtag Lines: ${tagLines.join('\n')}`);
    }
}

test();

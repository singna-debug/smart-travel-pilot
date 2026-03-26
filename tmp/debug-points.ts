
import { fetchModeTourNative, fetchContent, analyzeWithGemini } from './lib/crawler-utils';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    const url = 'https://www.modetour.com/package/104941375'; // Example URL
    console.log(`Testing URL: ${url}`);
    
    console.log('--- fetchContent ---');
    const { text, nextData, nativeData } = await fetchContent(url, true);
    console.log('Native Data Found:', !!nativeData);
    if (nativeData) {
        console.log('Native KeyPoints:', nativeData.keyPoints);
    }
    
    console.log('Text Length:', text.length);
    console.log('NextData Length:', nextData?.length || 0);

    console.log('--- analyzeWithGemini (Normal Mode) ---');
    const context = `--- [Native API] ---\n${JSON.stringify(nativeData)}\n\n--- [HTML TEXT] ---\n${text}`;
    const result = await analyzeWithGemini(context, url, true, nextData);
    console.log('AI Result KeyPoints:', result?.keyPoints);
}

test();

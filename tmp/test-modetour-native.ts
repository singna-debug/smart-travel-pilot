
import { fetchModeTourNative } from './lib/crawler-utils';

async function test() {
    const url = 'https://www.modetour.com/package/105807354?MLoc=99&Pnum=';
    console.log('Testing URL:', url);
    const result = await fetchModeTourNative(url);
    console.log('Result:', JSON.stringify(result, null, 2));
}

test().catch(console.error);

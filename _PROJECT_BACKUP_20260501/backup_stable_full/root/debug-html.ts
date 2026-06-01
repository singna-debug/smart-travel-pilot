import * as fs from 'fs';
import { fetchContent } from './lib/url-crawler';

async function test() {
    const url = 'https://www.modetour.com/package/102840987?MLoc=99&Pnum=102840987&Sno=C117876&ANO=81440&thru=crs';
    const { text, nextData } = await fetchContent(url);
    fs.writeFileSync('fetched_raw_text.txt', text);
    console.log('Saved fetched_raw_text.txt, length:', text.length);
}

test().catch(console.error);

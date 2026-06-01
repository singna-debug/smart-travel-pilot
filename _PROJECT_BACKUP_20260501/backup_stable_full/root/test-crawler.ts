import { crawlForConfirmation } from './lib/url-crawler';
import * as fs from 'fs';

async function main() {
    const url = 'https://www.modetour.com/package/102840987?MLoc=99&Pnum=102840987&Sno=C117876&ANO=81440&thru=crs';
    const result = await crawlForConfirmation(url);
    fs.writeFileSync('crawler-debug.json', JSON.stringify(result, null, 2), 'utf-8');
    console.log('Done');
}

main().catch(console.error);

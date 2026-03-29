import * as path from 'path';
import * as fs from 'fs';
import { crawlForConfirmation } from './lib/crawlers/confirmation/index';

async function dumpPrompt() {
    process.env.DEBUG_CONFIRMATION_PROMPT = 'true';
    const url = 'https://www.modetour.com/package/105807354?sno=C117876&ano=81440&pnum=105807354';
    console.log(`Testing URL: ${url}`);
    
    // We modify lib/crawlers/confirmation/index.ts temporarily to dump the fullPrompt to a file
    await crawlForConfirmation(url);
}

dumpPrompt();

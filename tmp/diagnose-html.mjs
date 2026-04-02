
import fetch from 'node-fetch';
import fs from 'fs';

const url = 'https://www.modetour.com/package/106173541';

async function diagnose() {
    console.log(`\n[DIAGNOSE] Fetching: ${url}`);
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    console.log(`[DIAGNOSE] Status: ${res.status}`);
    console.log(`[DIAGNOSE] Length: ${html.length}`);
    
    fs.writeFileSync('tmp/diagnose_modetour.html', html);
    
    const hasNextData = html.includes('__NEXT_DATA__');
    console.log(`[DIAGNOSE] __NEXT_DATA__ present: ${hasNextData}`);
    
    if (hasNextData) {
        const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        console.log(`[DIAGNOSE] Regex Match success: ${!!match}`);
    }
}

diagnose();

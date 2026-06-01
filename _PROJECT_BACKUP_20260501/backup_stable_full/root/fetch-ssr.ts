import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runTest() {
    const url = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    const ssrUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=10000`;

    const response = await fetch(ssrUrl);
    const html = await response.text();

    const fs = require('fs');
    fs.writeFileSync('debug-modetour-ssr.txt', html, 'utf-8');
    console.log("Written SSR HTML to debug-modetour-ssr.txt");
}

runTest().catch(console.error);

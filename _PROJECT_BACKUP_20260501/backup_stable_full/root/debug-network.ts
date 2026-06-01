import puppeteer from 'puppeteer';
import * as fs from 'fs';

async function traceNetwork() {
    const url = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    page.on('response', async (response) => {
        const reqUrl = response.url();
        if (reqUrl.includes('modetour.com/api') || reqUrl.includes('graphql') || reqUrl.includes('.json')) {
            try {
                const text = await response.text();
                if (text.includes('79900') || text.includes('제주항공')) {
                    console.log(`\nBINGO! Found price in: ${reqUrl}`);
                    fs.appendFileSync('debug-network-bingo.txt', `URL: ${reqUrl}\nRES: ${text.substring(0, 1000)}\n\n`);
                }
            } catch (e) { }
        }
    });

    console.log("Navigating...");
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log("Done waiting.");
    await browser.close();
}

traceNetwork().catch(console.error);

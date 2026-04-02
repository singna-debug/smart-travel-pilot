
import puppeteer from 'puppeteer';
import fs from 'fs';

const url = 'https://www.modetour.com/package/106173541';

async function inspect() {
    console.log(`[INSPECT] Opening: ${url}`);
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait 5 seconds for hydration
        await new Promise(r => setTimeout(r, 5000));
        
        const html = await page.evaluate(() => document.documentElement.outerHTML);
        console.log(`[INSPECT] Total Length: ${html.length}`);
        
        const hasItinerary = html.includes('일정표') || html.includes('itinerary');
        console.log(`[INSPECT] '일정표' string found: ${hasItinerary}`);
        
        fs.writeFileSync('tmp/full_dom_inspection.html', html);
        
        // Check NEXT_DATA again
        const nextData = await page.evaluate(() => {
            const script = document.querySelector('#__NEXT_DATA__');
            return script ? script.innerHTML : null;
        });
        
        if (nextData) {
            fs.writeFileSync('tmp/hydrated_next_data.json', nextData);
            console.log(`[INSPECT] Hydrated NEXT_DATA Length: ${nextData.length}`);
        }
        
    } catch (e) {
        console.error('[INSPECT] Error:', e.message);
    } finally {
        await browser.close();
    }
}

inspect();

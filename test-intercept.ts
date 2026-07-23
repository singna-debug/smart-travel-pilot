import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    const url = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=FCP171260824ETA&prePage=major-products';
    console.log(`Launching Puppeteer to intercept network requests for: ${url}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    const interceptedResponses: any[] = [];

    // Listen to network responses
    page.on('response', async (response) => {
        const req = response.request();
        const reqUrl = response.url();
        const method = req.method();
        const contentType = response.headers()['content-type'] || '';

        // Capture only fetch/XHR requests or JSON responses
        if (reqUrl.includes('api') || contentType.includes('application/json') || req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
            try {
                // Skip tracking image, font, static assets
                if (reqUrl.match(/\.(png|jpg|jpeg|gif|css|js|woff|woff2|svg)/i)) return;

                console.log(`[Intercepted] ${method} ${reqUrl.substring(0, 100)}... (${contentType})`);
                
                let text = '';
                try {
                    text = await response.text();
                } catch (e) {}

                let json = null;
                if (text && (contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('['))) {
                    try {
                        json = JSON.parse(text);
                    } catch (e) {}
                }

                interceptedResponses.push({
                    url: reqUrl,
                    method,
                    status: response.status(),
                    contentType,
                    resourceType: req.resourceType(),
                    postData: req.postData(),
                    headers: req.headers(),
                    responsePayload: json || text.substring(0, 500)
                });
            } catch (err: any) {
                // Ignore parsing errors for aborted requests
            }
        }
    });

    try {
        console.log('Navigating to page...');
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        console.log('Page loaded (network idle). Waiting 5 more seconds...');
        await new Promise(r => setTimeout(r, 5000));
    } catch (e: any) {
        console.error('Navigation error:', e.message);
    } finally {
        await browser.close();
        console.log('Browser closed.');
    }

    // Save logs
    const outputPath = path.join(process.cwd(), 'hanatour-intercepted-apis.json');
    fs.writeFileSync(outputPath, JSON.stringify(interceptedResponses, null, 2), 'utf-8');
    console.log(`Saved ${interceptedResponses.length} API calls to ${outputPath}`);
}

main().catch(console.error);

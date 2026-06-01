import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { Request } from 'node-fetch';

async function testEdgeRoute() {
    const url = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';

    // We will formulate a dummy request and test the logic of POST handler.
    // However, since it's NextRequest, we might need a Next app to test it properly.
    // Let's just mock the data directly here to see if the Edge Route's JS rendering extract works.
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim() as string;
    const jsScenario = encodeURIComponent('{"instructions":[{"wait":1000},{"scroll_y":2000},{"wait":500},{"scroll_y":5000}]}');
    const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=2000&js_scenario=${jsScenario}&timeout=15000`;

    console.log('Fetching JS Render via ScrapingBee...');
    const res = await fetch(sbUrl);
    const html = await res.text();
    console.log(`Length: ${html.length}`);

    const fs = require('fs');
    fs.writeFileSync('debug-edge-html.txt', html);
    console.log('Saved to debug-edge-html.txt');
}

testEdgeRoute().catch(console.error);

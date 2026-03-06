const fs = require('fs');

async function run() {
    console.log("Starting analysis...");
    const url = "https://www.modetour.com/package/104409383?MLoc=99&Pnum=104409383&Sno=C117876&ANO=81440&thru=crs";

    try {
        const res = await fetch('http://localhost:3000/api/crawl-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, source: 'confirmation' })
        });

        const text = await res.text();
        fs.writeFileSync('debug-response.json', text, 'utf-8');
        console.log("Response saved to debug-response.json");
    } catch (e) {
        console.error("Error:", e);
    }
}

run();

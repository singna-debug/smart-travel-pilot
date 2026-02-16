const fs = require('fs');

async function test() {
    const url = 'https://www.modetour.com/package/97890872?MLoc=99&Pnum=97890872&Sno=C117876&ANO=81440&thru=crs';
    const logFile = 'reproduce_log.txt';

    fs.writeFileSync(logFile, `Testing API with URL: ${url}\n`);

    try {
        const response = await fetch('http://localhost:3000/api/analyze-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        fs.appendFileSync(logFile, `Status: ${response.status}\n`);
        const text = await response.text();
        fs.appendFileSync(logFile, `Response Preview: ${text.substring(0, 1000)}\n`);

    } catch (error) {
        fs.appendFileSync(logFile, `Fetch failed: ${error.message}\n`);
    }
}

test();

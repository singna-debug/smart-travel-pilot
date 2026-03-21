// node v18+ has built-in fetch
async function testApiFinal() {
    const url = 'https://www.modetour.com/package/102687063?MLoc=99&Pnum=102687063&ANO=81440&sno=C117876&thru=crs';
    
    console.log('Testing /api/crawl-analyze (FINAL)...');
    try {
        const res = await fetch('http://localhost:3000/api/crawl-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, mode: 'confirmation' })
        });
        const json = await res.json();
        console.log('Crawl-Analyze Success:', json.success);
        if (json.data && json.data.raw) {
            const fs = require('fs');
            fs.writeFileSync('output.json', JSON.stringify(json.data.raw.itinerary, null, 2), 'utf-8');
            console.log('Saved entire itinerary array to output.json');
        } else {
            console.log('No raw data found.');
        }
    } catch (e) {
        console.error('Error testing /api/crawl-analyze:', e);
    }
}

testApiFinal();

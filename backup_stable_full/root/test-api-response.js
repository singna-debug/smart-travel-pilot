// node v18+ has built-in fetch
async function testApi() {
    const url = 'https://www.modetour.com/package/102687063?MLoc=99&Pnum=102687063&ANO=81440&sno=C117876&thru=crs';
    
    console.log('Testing /api/crawl-analyze...');
    try {
        const res = await fetch('http://localhost:3000/api/crawl-analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, mode: 'confirmation' })
        });
        const json = await res.json();
        console.log('Crawl-Analyze Success:', json.success);
        if (json.data && json.data.raw) {
            console.log('Title:', json.data.raw.title);
            console.log('Airline:', json.data.raw.airline);
            console.log('Itinerary Days:', json.data.raw.itinerary ? json.data.raw.itinerary.length : 0);
        } else {
            console.log('No data.raw found');
            console.log('Full response keys:', Object.keys(json));
            if (json.data) console.log('Data keys:', Object.keys(json.data));
        }
    } catch (e) {
        console.error('Error testing /api/crawl-analyze:', e.message);
    }

    console.log('\nTesting /api/analyze-url...');
    try {
        const res = await fetch('http://localhost:3000/api/analyze-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, source: 'confirmation' })
        });
        const json = await res.json();
        console.log('Analyze-URL Success:', json.success);
        if (json.data && json.data.raw) {
            console.log('Title:', json.data.raw.title);
            console.log('Airline:', json.data.raw.airline);
            console.log('Itinerary Days:', json.data.raw.itinerary ? json.data.raw.itinerary.length : 0);
        } else {
            console.log('No data.raw found');
        }
    } catch (e) {
        console.error('Error testing /api/analyze-url:', e.message);
    }
}

testApi();

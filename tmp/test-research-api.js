const http = require('http');

async function testResearch() {
    const url = 'http://localhost:3000/api/confirmation/secondary-research';
    const payload = JSON.stringify({
        destination: '도쿄, 일본',
        travelMonth: '4월',
        airline: '대한항공',
        baggageNote: '23kg',
        customGuides: ['쇼핑', '지하철']
    });

    console.log('[Test/Research] Sending request to:', url);
    console.time('[Test/Research] Duration');

    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/confirmation/secondary-research',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.timeEnd('[Test/Research] Duration');
            try {
                const json = JSON.parse(data);
                if (json.success) {
                    console.log('[Test/Research] Success!');
                    console.log('[Weather Summary]:', json.data.weather?.summary);
                    console.log('[Customs Warning]:', json.data.customs?.warningTitle);
                    console.log('[Baggage Note]:', json.data.baggage?.checkedNote);
                } else {
                    console.error('[Test/Research] Failed:', json.error);
                }
            } catch (e) {
                console.error('[Test/Research] JSON Parse Error:', e.message);
                console.log('Raw output:', data.substring(0, 500));
            }
        });
    });

    req.on('error', (e) => {
        console.error(`[Test/Research] Request Error: ${e.message}`);
    });

    req.write(payload);
    req.end();
}

testResearch();

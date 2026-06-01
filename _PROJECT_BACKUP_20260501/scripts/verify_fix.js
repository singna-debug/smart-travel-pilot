
const http = require('http');

const data = JSON.stringify({
    url: "https://modeon.modetour.co.kr/pkg/Itinerary/?Pcode=AVP666&Pnum=104941375"
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/analyze-url',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        try {
            const parsed = JSON.parse(body);
            console.log("--------------------------------------------------");
            if (parsed.success) {
                console.log("TITLE:   " + parsed.data.raw.title);
                console.log("DATE:    " + parsed.data.raw.departureDate);
                console.log("AIRLINE: " + parsed.data.raw.airline);

                // Check formatted string for mapped airline name
                const airlineLine = parsed.data.formatted.split('\n').find(l => l.includes('* 항공 :'));
                console.log("FMT_AIR: " + (airlineLine || "Not Found"));

            } else {
                console.log("ERROR: " + parsed.error);
            }
            console.log("--------------------------------------------------");
        } catch (e) {
            console.log("PARSE ERROR: " + body);
        }
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();

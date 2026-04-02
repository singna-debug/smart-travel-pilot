
import fetch from 'node-fetch';

const stealthHeaders = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
};

async function checkTransport() {
    // 106173541 is the product from the user's screenshot
    const res = await fetch('https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=106173541', { headers: stealthHeaders });
    const json = await res.json();
    const d = json.result || json;

    console.log('--- Transport Info Check ---');
    // Look for Flight, Transport, Air
    for (const key in d) {
        if (key.toLowerCase().includes('transport') || key.toLowerCase().includes('air') || key.toLowerCase().includes('flight')) {
            console.log(`Key: ${key}, Value Type: ${typeof d[key]}`);
            if (typeof d[key] === 'object') {
                console.log(JSON.stringify(d[key], null, 2));
            } else {
                console.log(d[key]);
            }
        }
    }
}

checkTransport();

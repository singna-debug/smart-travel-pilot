
import fetch from 'node-fetch';

const stealthHeaders = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
};

async function testKeys() {
    const res = await fetch('https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=106173541', { headers: stealthHeaders });
    const json = await res.json();
    const d = json.result || json;

    console.log('--- ALL KEYS ---');
    console.log(Object.keys(d).join(', '));
    
    console.log('\n--- Transport Analysis ---');
    if (d.TransportList) {
        console.log('TransportList found:', JSON.stringify(d.TransportList, null, 2));
    }
}

testKeys();

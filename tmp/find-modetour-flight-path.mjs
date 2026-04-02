
import fetch from 'node-fetch';

const stealthHeaders = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
};

function findValueDeep(obj, target, path = '') {
    if (obj === target) return path;
    if (typeof obj === 'object' && obj !== null) {
        for (let key in obj) {
            const result = findValueDeep(obj[key], target, path + (path ? '.' : '') + key);
            if (result) return result;
        }
    }
    return null;
}

async function findFlightNumbers() {
    const res = await fetch('https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=106173541', { headers: stealthHeaders });
    const json = await res.json();
    const d = json.result || json;

    console.log('--- Searching for Flight patterns (LJ551, etc.) ---');
    const str = JSON.stringify(d);
    const flightMatch = str.match(/[A-Z]{2}[0-9]{3,4}/g);
    
    if (flightMatch) {
        const unique = [...new Set(flightMatch)];
        console.log('Found patterns:', unique);
        unique.forEach(m => {
            const path = findValueDeep(d, m);
            console.log(`Value: ${m}, Path: result.${path}`);
        });
    } else {
        console.log('No flight patterns found in JSON.');
    }
}

findFlightNumbers();

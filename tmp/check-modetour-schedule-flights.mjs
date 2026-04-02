
import fetch from 'node-fetch';

const stealthHeaders = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
};

async function checkScheduleDeep() {
    const res = await fetch('https://b2c-api.modetour.com/Package/GetScheduleList?productNo=106173541', { headers: stealthHeaders });
    const json = await res.json();
    const d = json.result || json;

    console.log('--- Searching in Schedule for LJ551 ---');
    const str = JSON.stringify(d);
    if (str.includes('LJ')) {
        const matches = str.match(/[A-Z]{2}[0-9]{3,4}/g);
        console.log('Found patterns in schedule:', matches);
        // Find path
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
        if (matches) matches.forEach(m => console.log(`Value: ${m}, Path: result.${findValueDeep(d, m)}`));
    } else {
        console.log('No LJ patterns in schedule either.');
    }
}

checkScheduleDeep();

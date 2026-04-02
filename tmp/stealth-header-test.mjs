
import fetch from 'node-fetch';

async function checkStealth() {
    const url = 'https://b2c-api.modetour.com/Package/GetScheduleList?productNo=106173541';
    
    const stealthHeaders = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Priority': 'u=1, i'
    };

    console.log(`[STEALTH TEST] Requesting with headers...`);
    try {
        const res = await fetch(url, { headers: stealthHeaders });
        console.log(`Status: ${res.status}`);
        if (res.status === 200) {
            const json = await res.json();
            console.log(`Success: ${!!json.result}`);
        } else {
            console.log(`Failed: ${res.statusText}`);
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

checkStealth();

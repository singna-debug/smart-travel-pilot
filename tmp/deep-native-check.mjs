
import fetch from 'node-fetch';

const productNo = '106173541';
const h = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function check() {
    const res = await fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers: h });
    const json = await res.json();
    console.log('Result Keys:', Object.keys(json.result || {}));
    
    // Check for common itinerary keys
    const list = json.result?.scheduleList || json.result?.dayList || json.result;
    if (Array.isArray(list)) {
        console.log('Days Found:', list.length);
        list.slice(0, 1).forEach(day => {
            console.log('Day 1:', day.title);
            console.log('Details (Timeline):', (day.ScheduleDetailList || []).length);
        });
    } else {
        console.log('List not found. RAW:', JSON.stringify(json.result).substring(0, 500));
    }
}
check();

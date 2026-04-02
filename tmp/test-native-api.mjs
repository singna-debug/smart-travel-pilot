
import fetch from 'node-fetch';

const productNo = '106173541';
const browserHeaders = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json, text/plain, */*',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

async function testNative() {
    console.log(`\n[NATIVE TEST] Fetching Schedule for: ${productNo}\n`);
    
    // Test Schedule List
    const scheduleUrl = `https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`;
    try {
        const res = await fetch(scheduleUrl, { headers: browserHeaders });
        const json = await res.json();
        console.log(`      > Schedule Status: ${res.status}`);
        console.log(`      > Schedule Result: ${json.isOK ? 'SUCCESS' : 'FAILED'}`);
        if (json.result) {
            console.log(`      > Days Found: ${json.result.length}`);
            if (json.result.length > 0) {
                console.log(`      > First Day Title: ${json.result[0].title}`);
            }
        } else {
            console.log(`      > Raw JSON: ${JSON.stringify(json).substring(0, 200)}`);
        }
    } catch (e) {
        console.error(`      > Error: ${e.message}`);
    }

    // Test Product Detail
    const detailUrl = `https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`;
    try {
        const res = await fetch(detailUrl, { headers: browserHeaders });
        const json = await res.json();
        console.log(`\n      > Detail Result: ${json.isOK ? 'SUCCESS' : 'FAILED'}`);
        if (json.result) {
            console.log(`      > Product Name: ${json.result.productName}`);
            console.log(`      > Price: ${json.result.sellingPriceAdultTotalAmount}`);
        }
    } catch (e) {}
}

testNative();

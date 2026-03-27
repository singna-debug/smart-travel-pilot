
async function test() {
    const productNo = '105807354';
    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json'
    };

    console.log(`[Test] Fetching for Product No: ${productNo}`);
    try {
        const res = await fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers });
        console.log(`[Test] Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            console.log('[Test] Data Result:', JSON.stringify(data, null, 2));
            
            const r = data.result || data;
            const depDate = r.departureDate || r.start_dt || r.dep_dt;
            const retDate = r.arrivalDate || r.end_dt || r.arr_dt;
            console.log(`[Test] Extracted: dep=${depDate}, ret=${retDate}`);
        } else {
            const text = await res.text();
            console.log('[Test] Error Body:', text);
        }
    } catch (e) {
        console.error('[Test] Exception:', e);
    }
}

test();

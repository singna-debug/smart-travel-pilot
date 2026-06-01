
import fetch from 'node-fetch';

async function testModetourAPI() {
    // 2026년 상품이나 2024년으로 나오고 있는 문제의 URL 정보
    const productNo = '105807354';
    const sno = 'C117876';
    const ano = '81440';
    const pnum = '105807354';

    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json'
    };

    const endpoints = [
        `https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}&sno=${sno}&pnum=${pnum}&ano=${ano}`,
        `https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}&sno=${sno}&pnum=${pnum}&ano=${ano}`
    ];

    console.log('--- [DEBUG] Testing with specific parameters (sno, ano, pnum) ---');
    
    for (const url of endpoints) {
        console.log(`\nFetching: ${url}`);
        try {
            const res = await fetch(url, { headers });
            const data = await res.json();
            
            if (data.result) {
                const r = data.result;
                // 날짜 정보 체크
                const depDate = r.departureDate || r.start_dt || r.dep_dt;
                const flight = r.DepartureFlightNo || r.CarrierFlightNoDepart || r.transportName;
                const itinerary = Array.isArray(r) ? r.length : (r.itinerary?.length || 0);
                
                console.log(`- Result Found: ${data.productName || r.productName || 'N/A'}`);
                console.log(`- Date extracted from API: ${depDate}`);
                console.log(`- Flight extracted from API: ${flight}`);
                
                if (url.includes('GetScheduleList')) {
                    const firstDay = Array.isArray(data.result) ? data.result[0] : null;
                    console.log(`- Schedule Day 1 Date: ${firstDay?.date}`);
                    console.log(`- Schedule Day 1 Flight: ${firstDay?.transport?.flightNo}`);
                }
            } else {
                console.log('- Result missing in JSON');
            }
        } catch (e) {
            console.error(`- Error: ${e.message}`);
        }
    }
}

testModetourAPI();

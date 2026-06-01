
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

    // sno, ano, pnum을 모두 쿼리 스트링에 포함
    const url = `https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}&sno=${sno}&pnum=${pnum}&ano=${ano}`;
    
    console.log(`[DEBUG] Fetching with full params: ${url}`);
    
    try {
        const res = await fetch(url, { headers });
        const data = await res.json();
        const r = data.result || data;

        console.log('--- API Response Summary ---');
        console.log(`- ProductName: ${data.productName || r.productName}`);
        console.log(`- DepartureDate: ${r.departureDate || r.start_dt}`);
        console.log(`- ArrivalDate: ${r.arrivalDate || r.end_dt}`);
        console.log(`- Flight (Depart): ${r.DepartureFlightNo || r.carrier_nm}`);
        console.log(`- Flight (Return): ${r.ArrivalFlightNo}`);
        console.log(`- Price: ${r.sellingPriceAdultTotalAmount || r.price}`);
        console.log(`- Itinerary Count: ${r.itinerary?.length || 0}`);
        
        if (r.itinerary && r.itinerary.length > 0) {
            console.log(`- Day 1 Activity: ${r.itinerary[0].title || r.itinerary[0].scheduleTitle}`);
        }
    } catch (e) {
        console.error(`Error: ${e.message}`);
    }
}

testModetourAPI();

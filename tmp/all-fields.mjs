const productNo = '106173541';
const headers = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'origin': 'https://www.modetour.com',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
};

async function test() {
    const res = await fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers });
    const json = await res.json();
    const d = json.result || json;
    
    console.log('--- ALL FIELDS from GetProductDetailInfo ---');
    console.log(JSON.stringify(d, null, 2));
}

test().catch(console.error);

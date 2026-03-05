async function testMinimalHeaders() {
    const url = 'https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=100634999';
    const modewebapireqheader = '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}';

    console.log('Testing with minimal headers...');
    const res = await fetch(url, {
        headers: {
            'modewebapireqheader': modewebapireqheader,
            'referer': 'https://www.modetour.com/',
            'accept': 'application/json'
        }
    });

    const data = await res.json();
    if (data.isOK) {
        console.log('SUCCESS with minimal headers!');
    } else {
        console.log('FAILED with minimal headers:', data.message);
    }
}

testMinimalHeaders().catch(console.error);

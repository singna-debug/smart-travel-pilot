const fs = require('fs');

async function testFetchWithHeaders() {
    const headers = JSON.parse(fs.readFileSync('api-headers.json', 'utf8'));
    const urlPoints = 'https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=100634999';
    const urlDetail = 'https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=100634999';

    console.log('Fetching Key Points...');
    const resPoints = await fetch(urlPoints, { headers });
    const dataPoints = await resPoints.json();
    fs.writeFileSync('debug-api-points.json', JSON.stringify(dataPoints, null, 2));

    console.log('Fetching Product Detail...');
    const resDetail = await fetch(urlDetail, { headers });
    const dataDetail = await resDetail.json();
    fs.writeFileSync('debug-api-detail.json', JSON.stringify(dataDetail, null, 2));

    console.log('Done. Check debug-api-*.json');
}

testFetchWithHeaders().catch(console.error);

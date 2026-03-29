const sbKey = "NCBDRI9PVKG7WU0X8S1HKRBA31HIF92SZ0L1OIUDZQLQSN946508EU88KDIBASHNVVPY1N7O2G5WLVOP";
const productNo = "104409383";
const headers = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json'
};

const proxyDetailUrl = `https://app.scrapingbee.com/api/v1/?api_key=${sbKey}&url=${encodeURIComponent(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`)}&render_js=false&forward_headers=true`;
const proxyPointsUrl = `https://app.scrapingbee.com/api/v1/?api_key=${sbKey}&url=${encodeURIComponent(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`)}&render_js=false&forward_headers=true`;

const proxyHeaders = {
    'Spb-modewebapireqheader': headers.modewebapireqheader,
    'Spb-referer': headers.referer,
    'Spb-accept': headers.accept
};

async function testProxy() {
    try {
        const [resDetail, resPoints] = await Promise.all([
            fetch(proxyDetailUrl, { headers: proxyHeaders }),
            fetch(proxyPointsUrl, { headers: proxyHeaders }),
        ]);
        const dataDetail = await resDetail.json();

        console.log("dataDetail.isOK:", dataDetail.isOK);
        if (dataDetail.isOK) {
            console.log("Title:", dataDetail.result.productName);
            console.log("Price:", dataDetail.result.priceAdult);
        } else {
            console.log("Error in dataDetail");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
testProxy();

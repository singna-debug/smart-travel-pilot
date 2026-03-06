const sbKey = "NCBDRI9PVKG7WU0X8S1HKRBA31HIF92SZ0L1OIUDZQLQSN946508EU88KDIBASHNVVPY1N7O2G5WLVOP";
const productNo = "100634999";
const headers = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json'
};

const proxyDetailUrl = `https://app.scrapingbee.com/api/v1/?api_key=${sbKey}&url=${encodeURIComponent(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`)}&render_js=false&forward_headers=true`;

async function testProxy() {
    console.log("Starting Proxy Request...");
    const start = Date.now();
    try {
        const res = await fetch(proxyDetailUrl, {
            headers: {
                'Spb-modewebapireqheader': headers.modewebapireqheader,
                'Spb-referer': headers.referer,
                'Spb-accept': headers.accept
            }
        });
        const text = await res.text();
        console.log(`Status: ${res.status}`);
        if (text.length < 500) {
            console.log("Response text:", text);
        } else {
            console.log("Response text:", text.slice(0, 500));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
testProxy();

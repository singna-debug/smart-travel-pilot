const sbKey = "NCBDRI9PVKG7WU0X8S1HKRBA31HIF92SZ0L1OIUDZQLQSN946508EU88KDIBASHNVVPY1N7O2G5WLVOP";
const productNo = "104409383";
const headers = {
    'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
    'referer': 'https://www.modetour.com/',
    'accept': 'application/json'
};

const proxyPointsUrl = `https://app.scrapingbee.com/api/v1/?api_key=${sbKey}&url=${encodeURIComponent(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`)}&render_js=false&forward_headers=true`;

const proxyHeaders = {
    'Spb-modewebapireqheader': headers.modewebapireqheader,
    'Spb-referer': headers.referer,
    'Spb-accept': headers.accept
};

async function testProxy() {
    try {
        const pResPoints = await fetch(proxyPointsUrl, { headers: proxyHeaders });
        const text = await pResPoints.text();
        console.log("Points API Response Length:", text.length);
        console.log("- Status:", pResPoints.status);
        if (text.length < 500) {
            console.log("Text:", text);
        } else {
            console.log("Starts with:", text.substring(0, 100));
        }

        let parsed = JSON.parse(text);
        if (typeof parsed === "string") parsed = JSON.parse(parsed);

        console.log("- Parsed Success, isOK:", parsed.isOK);

    } catch (e) {
        console.error("Caught Error:", e);
    }
}
testProxy();

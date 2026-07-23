import * as fs from 'fs';

async function testHanatourApi() {
    const pkgCd = 'APP216260804TWC';
    
    // 1. Itinerary API (getPkgProdItnrInfo)
    const itnrUrl = 'https://gw.hanatour.com/package/pkg/api/common/pkgcomprod/getPkgProdItnrInfo/v1.00?_siteId=hanatour';
    console.log(`Calling Itinerary API: ${itnrUrl}`);
    try {
        const res = await fetch(itnrUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'prgmid': 'CHPC0PKG0200M200',
                'referer': 'https://www.hanatour.com/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({ pkgCd })
        });
        
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            console.log('Itinerary API Success!');
            console.log(`- logKey: ${data.logKey}`);
            console.log(`- hasData: ${!!data.data}`);
            if (data.data) {
                console.log(`- meetInfo:`, data.data.meetInfoBcVo ? 'Present' : 'Not found');
                console.log(`- schdInfoList count:`, data.data.schdInfoList?.length || 0);
            }
            fs.writeFileSync('hanatour-api-itnr-response.json', JSON.stringify(data, null, 2), 'utf-8');
        } else {
            console.error('API Error response:', await res.text());
        }
    } catch (e: any) {
        console.error('Itinerary API Error:', e.message || e);
    }

    // 2. Product Info API (getPkgProdPerResPecn)
    const infoUrl = 'https://gw.hanatour.com/package/pkg/api/common/pkgcomres/getPkgProdPerResPecn/v1.00?_siteId=hanatour';
    console.log(`\nCalling Product Info API: ${infoUrl}`);
    try {
        const res = await fetch(infoUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'prgmid': 'CHPC0PKG0200M200',
                'referer': 'https://www.hanatour.com/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({ pkgCd })
        });
        
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            console.log('Product Info API Success!');
            console.log(`- logKey: ${data.logKey}`);
            console.log(`- hasData: ${!!data.data}`);
            if (data.data && data.data.resReports) {
                console.log(`- saleProdNm:`, data.data.resReports.saleProdNm);
                console.log(`- adtAmt:`, data.data.resReports.adtAmt);
                console.log(`- depDay:`, data.data.resReports.depDay);
            }
            fs.writeFileSync('hanatour-api-info-response.json', JSON.stringify(data, null, 2), 'utf-8');
        } else {
            console.error('API Error response:', await res.text());
        }
    } catch (e: any) {
        console.error('Product Info API Error:', e.message || e);
    }

    // 3. Main Product Info API (getPkgProdInfo)
    const pkgInfoUrl = 'https://gw.hanatour.com/package/pkg/api/common/pkgcomprod/getPkgProdInfo/v1.00?_siteId=hanatour';
    console.log(`\nCalling Main Product Info API: ${pkgInfoUrl}`);
    try {
        const res = await fetch(pkgInfoUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'prgmid': 'CHPC0PKG0200M200',
                'referer': 'https://www.hanatour.com/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                pkgCd,
                inpPathCd: 'DCP',
                smplYn: 'N',
                coopYn: 'N',
                resAcceptPtn: {},
                partnerYn: 'N'
            })
        });
        
        console.log(`Status: ${res.status}`);
        if (res.ok) {
            const data = await res.json();
            console.log('Main Product Info API Success!');
            console.log(`- logKey: ${data.logKey}`);
            console.log(`- hasData: ${!!data.data}`);
            if (data.data) {
                console.log(`- Title:`, data.data.saleProdNm);
                console.log(`- Total Price (adtTotlAmt):`, data.data.adtTotlAmt);
                console.log(`- Duration:`, `${data.data.trvlNgtCnt}박 ${data.data.trvlDayCnt}일`);
                console.log(`- Inclusions Count:`, data.data.trvlExpnInclList?.length || 0);
                console.log(`- Exclusions Count:`, data.data.trvlExpnNoneInclList?.length || 0);
            }
            fs.writeFileSync('hanatour-api-pkg-info-response.json', JSON.stringify(data, null, 2), 'utf-8');
        } else {
            console.error('API Error response:', await res.text());
        }
    } catch (e: any) {
        console.error('Main Product Info API Error:', e.message || e);
    }
}

testHanatourApi().catch(console.error);

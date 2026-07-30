async function inspectRealData() {
    const pkgCd = 'APP2382609017CB';
    const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    };

    const resInfo = await fetch('https://gw.hanatour.com/package/pkg/api/common/pkgcomprod/getPkgProdInfo/v1.00?_siteId=hanatour', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pkgCd, inpPathCd: 'DCP', smplYn: 'N', coopYn: 'N', resAcceptPtn: {}, partnerYn: 'N' })
    }).then(r => r.json());

    const resItnr = await fetch('https://gw.hanatour.com/package/pkg/api/common/pkgcomprod/getPkgProdItnrInfo/v1.00?_siteId=hanatour', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pkgCd })
    }).then(r => r.json());

    const info = resInfo.data || {};
    const itnr = resItnr.data || {};

    console.log('=== INFO KEYS ===', Object.keys(info));
    console.log('info sample:', JSON.stringify(info, null, 2).substring(0, 1500));
    console.log('=== ITNR KEYS ===', Object.keys(itnr));
    console.log('itnr sample:', JSON.stringify(itnr, null, 2).substring(0, 1500));
}

inspectRealData();

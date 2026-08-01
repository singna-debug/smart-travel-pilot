import type { DetailedProductInfo } from '../../types';

export function extractHanaTourPkgCd(url: string): string | null {
    try {
        const urlObj = new URL(url);
        const pkgCdQuery = urlObj.searchParams.get('pkgCd');
        if (pkgCdQuery) return pkgCdQuery;

        const pathMatch = url.match(/\/pkg\/([A-Z0-9]+)/i);
        if (pathMatch) return pathMatch[1];
    } catch (e) {}
    
    const directMatch = url.match(/pkgCd=([A-Z0-9]+)/i);
    if (directMatch) return directMatch[1];

    return null;
}

function formatDateStr(d: string): string {
    if (!d || d.length !== 8) return d || '';
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function cleanText(t: string): string {
    if (!t) return '';
    return t.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function analyzeHanaTourUrl(url: string): Promise<DetailedProductInfo | null> {
    const pkgCd = extractHanaTourPkgCd(url);
    if (!pkgCd) {
        console.warn(`[URL-Analysis/HanaTour] Failed to extract pkgCd from URL: ${url}`);
        return null;
    }

    console.log(`[URL-Analysis/HanaTour] Standalone native fetch for pkgCd: ${pkgCd}`);

    const headers = {
        'content-type': 'application/json',
        'accept': 'application/json',
        'origin': 'https://www.hanatour.com',
        'prgmid': 'CHPC0PKG0200M200',
        'referer': 'https://www.hanatour.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    let dataInfo: any = null;
    let dataItnr: any = null;

    try {
        const [resInfo, resItnr] = await Promise.all([
            fetch('https://gw.hanatour.com/package/pkg/api/common/pkgcomprod/getPkgProdInfo/v1.00?_siteId=hanatour', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    pkgCd,
                    inpPathCd: 'DCP',
                    smplYn: 'N',
                    coopYn: 'N',
                    resAcceptPtn: {},
                    partnerYn: 'N'
                })
            }).catch(() => null),
            fetch('https://gw.hanatour.com/package/pkg/api/common/pkgcomprod/getPkgProdItnrInfo/v1.00?_siteId=hanatour', {
                method: 'POST',
                headers,
                body: JSON.stringify({ pkgCd })
            }).catch(() => null)
        ]);

        if (resInfo && resInfo.ok) {
            const json = await resInfo.json();
            dataInfo = json?.data;
        }
        if (resItnr && resItnr.ok) {
            const json = await resItnr.json();
            dataItnr = json?.data;
        }
    } catch (e: any) {
        console.error(`[URL-Analysis/HanaTour] Error fetching APIs:`, e.message);
        return null;
    }

    if (!dataInfo && !dataItnr) {
        return null;
    }

    const info = dataInfo || {};
    const itnr = dataItnr || {};

    const rawTitle = info.saleProdNm || '';
    const priceNum = info.adtTotlAmt || info.adtAmt || 0;
    const priceStr = priceNum > 0 ? `${Number(priceNum).toLocaleString()}원` : '가격 정보 문의 (선착순 특가)';

    const duration = (info.trvlNgtCnt && info.trvlDayCnt) ? `${info.trvlNgtCnt}박 ${info.trvlDayCnt}일` : '';
    
    const schdInfoList = itnr.schdInfoList || [];
    const departureDate = formatDateStr(info.depDay || schdInfoList[0]?.strtDt || '');
    const returnDate = formatDateStr(info.arrDay || schdInfoList[schdInfoList.length - 1]?.strtDt || '');

    const flights = itnr.pkgAirSeqList || [];
    const firstDep = flights.find((f: any) => String(f.legSeq) === '1') || {};
    const airlineName = firstDep.airlNm || info.depAirClstNm || info.airlNm || '';

    let depAirport = '서울(ICN)';
    if (info.depCityNm) {
        if (info.depCityNm.includes('부산') || info.depCityNm.includes('김해')) depAirport = '부산(PUS)';
        else if (info.depCityNm.includes('대구')) depAirport = '대구(TAE)';
        else if (info.depCityNm.includes('청주')) depAirport = '청주(CJJ)';
        else if (info.depCityNm.includes('무안')) depAirport = '무안(MWX)';
    }

    // ─── Daily Itinerary Extraction ───
    const itinerary = schdInfoList.map((day: any, idx: number) => {
        const spots = (day.schdMainInfoList || []).map((item: any) => cleanText(item.cardNm || item.memoTitlNm || item.cardCntnt || '')).filter(Boolean);
        return {
            day: idx + 1,
            title: cleanText(day.schdTitlNm || `Day ${idx + 1}`),
            items: spots
        };
    });

    // ─── Keypoints Extraction ───
    const keyPoints: string[] = [];

    const coreList = info.prodCorePntList || [];
    coreList.forEach((p: any) => {
        const cont = cleanText(p.corePntCont || p.corePntTitlNm || '').trim();
        if (cont && cont.length > 3) {
            const clean = cont.replace(/^[①-⑳\d\.\)\:\-\s📌🏖️📸🏨🍝💆♀️]+/, '').trim();
            if (!keyPoints.includes(clean) && !clean.includes('배송비') && !clean.includes('관세')) {
                keyPoints.push(clean);
            }
        }
    });

    const inclusions = (info.trvlExpnInclList || []).map((x: any) => 
        cleanText(`${x.trvlExpnClstNm || ''} ${x.trvlExpnDesc || ''}`)
    ).filter(Boolean);

    const exclusions = (info.trvlExpnNoneInclList || []).map((x: any) => 
        cleanText(`${x.trvlExpnClstNm || ''} ${x.trvlExpnDesc || ''}`)
    ).filter(Boolean);

    const destination = info.destNm || firstDep.arrAptCityNm || '해외';

    return {
        title: cleanText(rawTitle),
        destination,
        price: priceStr,
        departureDate,
        returnDate,
        duration,
        airline: airlineName,
        departureFlightNumber: firstDep.flgtNm ? `${firstDep.airlCd || ''}${firstDep.flgtNm}` : '',
        returnFlightNumber: '',
        departureAirport: depAirport,
        url,
        keyPoints: keyPoints.slice(0, 8),
        inclusions,
        exclusions,
        itinerary,
        hotels: []
    } as any;
}

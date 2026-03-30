/**
 * ★ 확정서 모드 전용 Native API 유틸리티 ★
 * 
 * 이 파일은 확정서 모드만을 위한 독립 복사본입니다.
 * 노말 모드의 ../modetour-utils.ts와 완전히 분리되어 있습니다.
 * 확정서 관련 수정은 이 파일만 수정하세요.
 */

import type { DetailedProductInfo } from '../../../types';

export async function fetchConfirmationNative(url: string): Promise<DetailedProductInfo | null> {
    
    const urlObj = new URL(url);
    const sno = urlObj.searchParams.get('sno') || urlObj.searchParams.get('sNo') || '';
    const ano = urlObj.searchParams.get('ano') || urlObj.searchParams.get('aNo') || urlObj.searchParams.get('ANO') || '';
    const pnum = urlObj.searchParams.get('pnum') || urlObj.searchParams.get('Pnum') || '';
    const goodsNo = urlObj.searchParams.get('goodsNo') || '';
    
    // productNo는 반드시 순수 숫자여야 합니다.
    // sno는 'C117876' 같은 알파벳+숫자 코드 → productNo로 사용 불가
    // pnum이 항상 올바른 상품 번호
    const numericSno = /^\d+$/.test(sno) ? sno : '';
    const numericAno = /^\d+$/.test(ano) ? ano : '';
    let productNo = goodsNo || pnum || numericSno || numericAno || '';

    if (!productNo) {
        console.warn(`[Confirm/Native] Product No not found: ${url}`);
        return null;
    }
    
    console.log(`[Confirm/Native] Params: productNo=${productNo}, sno=${sno}, ano=${ano}, pnum=${pnum}`);

    const browserHeaders = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    let dataDetail: any = null;
    let dataPoints: any = null;
    let dataSchedule: any = null;

    try {
        const ts = Date.now();
        console.log(`[Confirm/Native] Fetching for productNo=${productNo}`);
        
        const baseParams = `productNo=${productNo}&sno=${sno}&ano=${ano}&pnum=${pnum}&_ts=${ts}`;
        const urls = [
            `https://b2c-api.modetour.com/Package/GetProductDetailInfo?${baseParams}`,
            `https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?${baseParams}`,
            `https://b2c-api.modetour.com/Package/GetScheduleList?${baseParams}`
        ];

        const fetchJSON = async (targetUrl: string) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
                const res = await fetch(targetUrl, { headers: browserHeaders, cache: 'no-store', signal: controller.signal });
                clearTimeout(timeout);
                if (!res.ok) return null;
                return await res.json();
            } catch {
                clearTimeout(timeout);
                return null;
            }
        };

        const results = await Promise.all(urls.map(u => fetchJSON(u)));
        dataDetail = results[0];
        dataPoints = results[1];
        dataSchedule = results[2];

        console.log(`[Confirm/Native] Detail:${!!dataDetail}, Points:${!!dataPoints}, Schedule:${!!dataSchedule}`);

        if (!dataDetail?.result) {
            const simpleUrl = `https://b2c-api.modetour.com/Package/GetProductSimpleDetail?productNo=${productNo}&_ts=${Date.now()}`;
            dataDetail = await fetchJSON(simpleUrl);
        }
    } catch (e: any) {
        console.error(`[Confirm/Native] Fetch Error: ${e.message}`);
    }

    if (dataDetail?.result || dataDetail?.isOK || dataDetail?.productName) {
        const d = dataDetail.result || dataDetail;
        
        const depDateRaw = d.departureDate || d.start_dt || d.dep_dt || '';
        const isHistorical = depDateRaw && depDateRaw.startsWith('2024');
        
        if (isHistorical) {
            console.warn(`[Confirm/Native] Historical data (2024) detected.`);
        }

        console.log(`[Confirm/Native] productName="${d.productName}", price=${d.sellingPriceAdultTotalAmount}`);
        
        let cleanTitle = d.productName || '';
        let destination = d.category2 ? `${d.category2}, ${d.category3 || ''}` : (d.category3 || '');
        
        // 목적지 오염 필터링 (노팁/노쇼핑 등)
        const forbiddenWords = ['노팁', '노쇼핑', '노옵션', '출발', '확정', '특가', '단독', '기획', '모객', '특전', '스마일', '명부터', '예약', '마감', '할인', '이벤트', '시그니처', '선착순', '베스트', '홈쇼핑'];
        if (destination && forbiddenWords.some(w => destination.includes(w))) {
            destination = '';
        }
        
        // Key Points 추출
        let keyPoints: string[] = [];
        if (dataPoints && (dataPoints.isOK || dataPoints.result || dataPoints.code === '200')) {
            const r = dataPoints.result || dataPoints;
            const findPoints = (obj: any): string[] => {
                let found: string[] = [];
                if (!obj || typeof obj !== 'object') return found;
                if (Array.isArray(obj)) {
                    obj.forEach(item => {
                        if (typeof item === 'string' && item.length > 5) found.push(item);
                        else if (item && typeof item === 'object') {
                            const val = item.title || item.name || item.content || item.text || item.summary;
                            if (typeof val === 'string' && val.length > 5) found.push(val);
                            else found = [...found, ...findPoints(item)];
                        }
                    });
                } else {
                    Object.values(obj).forEach(val => {
                        if (Array.isArray(val) || (val && typeof val === 'object')) found = [...found, ...findPoints(val)];
                    });
                }
                return found;
            };
            const extracted = findPoints(r);
            extracted.forEach(p => {
                const clean = p.replace(/\[특전\]/g, '').replace(/<[^>]+>/g, '').trim();
                if (clean.length > 2 && !keyPoints.includes(clean)) keyPoints.push(clean);
            });
        }

        const rawPrice = String(d.sellingPriceAdultTotalAmount || d.productPrice_Adult || d.salePrice || d.sellingPrice || d.price || '');
        
        // 호텔 정보
        const hotels: any[] = [];
        const rawHotels = Array.isArray(d.HotelList) ? d.HotelList : (Array.isArray(d.SummaryHotelList) ? d.SummaryHotelList : []);
        rawHotels.slice(0, 5).forEach((h: any) => {
            if (h && h.hotelName) hotels.push({ name: h.hotelName, address: h.hotelAddress || '' });
        });
        
        // 포함/불포함
        const inclusions: string[] = [];
        const exclusions: string[] = [];
        if (Array.isArray(d.InclusionList)) d.InclusionList.forEach((i: any) => {
            const val = i.content || i.title || (typeof i === 'string' ? i : '');
            if (val) inclusions.push(val);
        });
        if (Array.isArray(d.ExclusionList)) d.ExclusionList.forEach((e: any) => {
            const val = e.content || e.title || (typeof e === 'string' ? e : '');
            if (val) exclusions.push(val);
        });
        
        // 미팅 정보
        const meetingInfo: any[] = [];
        if (Array.isArray(d.SummaryMeetingList)) {
            d.SummaryMeetingList.forEach((m: any) => {
                meetingInfo.push({
                    type: m.title || '미팅안내',
                    location: m.place || '',
                    time: m.time || '',
                    description: m.content || ''
                });
            });
        }

        // 취소 규정
        let cancelPolicy = d.CancelRuleContent || d.CancelRuleInfo || '';
        if (!cancelPolicy && Array.isArray(d.CancelRuleList)) {
            cancelPolicy = d.CancelRuleList
                .filter((c: any) => c && typeof c === 'object')
                .map((c: any) => c.content || c.title || '')
                .join('\n');
        } else if (!cancelPolicy && typeof d.CancelRuleList === 'string') {
            cancelPolicy = d.CancelRuleList;
        }
        
        // 항공 상세
        const depFlight = d.DepartureFlightNo || d.CarrierFlightNoDepart || d.FlightNoDepart || '';
        const retFlight = d.ArrivalFlightNo || d.CarrierFlightNoReturn || d.FlightNoReturn || '';
        const depTime = d.DepartureTimeDepart || d.DepartureTime || '';
        const arrTime = d.ArrivalTimeDepart || d.ArrivalTime || '';
        const retDepTime = d.DepartureTimeReturn || '';
        const retArrTime = d.ArrivalTimeReturn || '';

        return {
            isProduct: true,
            title: cleanTitle,
            destination: destination,
            price: rawPrice.replace(/[^0-9]/g, ''),
            departureDate: depDateRaw,
            returnDate: d.arrivalDate || d.end_dt || d.arr_dt || '',
            departureAirport: d.departureCityName || d.departureCity || '인천',
            airline: isHistorical ? '' : (d.transportName || d.carrier_nm || ''),
            departureFlightNumber: isHistorical ? '' : depFlight,
            returnFlightNumber: isHistorical ? '' : retFlight,
            departureTime: isHistorical ? '' : depTime,
            arrivalTime: isHistorical ? '' : arrTime,
            returnDepartureTime: isHistorical ? '' : retDepTime,
            returnArrivalTime: isHistorical ? '' : retArrTime,
            duration: d.travelPeriod || d.prd_day_cnt || d.period || '',
            url: url,
            keyPoints: keyPoints,
            itinerary: (function() {
                if (isHistorical) return []; 
                const scheduleList = Array.isArray(dataSchedule?.result) ? dataSchedule.result : (Array.isArray(dataSchedule) ? dataSchedule : []);
                if (!Array.isArray(scheduleList)) return [];
                return scheduleList.map((day: any) => {
                    const dayNo = day?.day || day?.dayNo;
                    const dateStr = day?.date || '';
                    const title = day?.title || day?.scheduleTitle || '';
                    const details = Array.isArray(day?.ScheduleDetailList) ? day.ScheduleDetailList : [];
                    const timeline = Array.isArray(details) ? details.map((dt: any) => ({
                        type: (dt.title?.includes('미팅') || dt.title?.includes('집합')) ? 'default' : 'location',
                        title: dt.title || '',
                        description: dt.content || ''
                    })) : [];
                    return {
                        day: dayNo,
                        date: dateStr,
                        title: title,
                        transport: day?.transport || null,
                        timeline: timeline.length > 0 ? timeline : (day?.timeline || [])
                    };
                });
            })(),
            hotels: hotels,
            inclusions: inclusions,
            exclusions: exclusions,
            meetingInfo: meetingInfo,
            cancellationPolicy: cancelPolicy,
            features: []
        } as any;
    }
    return null;
}

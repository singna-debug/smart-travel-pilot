/**
 * ???뺤젙??紐⑤뱶 ?꾩슜 Native API ?좏떥由ы떚 ?? * 
 * ???뚯씪? ?뺤젙??紐⑤뱶留뚯쓣 ?꾪븳 ?낅┰ 蹂듭궗蹂몄엯?덈떎.
 * ?몃쭚 紐⑤뱶??../modetour-utils.ts? ?꾩쟾??遺꾨━?섏뼱 ?덉뒿?덈떎.
 * ?뺤젙??愿???섏젙? ???뚯씪留??섏젙?섏꽭??
 */

import type { DetailedProductInfo } from '../../../types';

export async function fetchConfirmationNative(url: string): Promise<DetailedProductInfo | null> {
    
    const urlObj = new URL(url);
    const sno = urlObj.searchParams.get('sno') || urlObj.searchParams.get('sNo') || '';
    const ano = urlObj.searchParams.get('ano') || urlObj.searchParams.get('aNo') || urlObj.searchParams.get('ANO') || '';
    const pnum = urlObj.searchParams.get('pnum') || urlObj.searchParams.get('Pnum') || '';
    const goodsNo = urlObj.searchParams.get('goodsNo') || '';
    
    // productNo??諛섎뱶???쒖닔 ?レ옄?ъ빞 ?⑸땲??
    // sno??'C117876' 媛숈? ?뚰뙆踰??レ옄 肄붾뱶 ??productNo濡??ъ슜 遺덇?
    // pnum????긽 ?щ컮瑜??곹뭹 踰덊샇
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
        
        // 紐⑹쟻吏 ?ㅼ뿼 ?꾪꽣留?(?명똻/?몄눥????
        const forbiddenWords = ['?명똻', '?몄눥??, '?몄샃??, '異쒕컻', '?뺤젙', '?밴?', '?⑤룆', '湲고쉷', '紐④컼', '?뱀쟾', '?ㅻ쭏??, '紐낅???, '?덉빟', '留덇컧', '?좎씤', '?대깽??, '?쒓렇?덉쿂', '?좎갑??, '踰좎뒪??, '?덉눥??];
        if (destination && forbiddenWords.some(w => destination.includes(w))) {
            destination = '';
        }
        
        // Key Points 異붿텧
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
                const clean = p.replace(/\[?뱀쟾\]/g, '').replace(/<[^>]+>/g, '').trim();
                if (clean.length > 2 && !keyPoints.includes(clean)) keyPoints.push(clean);
            });
        }

        const rawPrice = String(d.sellingPriceAdultTotalAmount || d.productPrice_Adult || d.salePrice || d.sellingPrice || d.price || '');
        
        // ?명뀛 ?뺣낫
        const hotels: any[] = [];
        const rawHotels = Array.isArray(d.HotelList) ? d.HotelList : (Array.isArray(d.SummaryHotelList) ? d.SummaryHotelList : []);
        rawHotels.slice(0, 5).forEach((h: any) => {
            if (h && h.hotelName) hotels.push({ name: h.hotelName, address: h.hotelAddress || '' });
        });
        
        // ?ы븿/遺덊룷??        const inclusions: string[] = [];
        const exclusions: string[] = [];
        if (Array.isArray(d.InclusionList)) d.InclusionList.forEach((i: any) => {
            const val = i.content || i.title || (typeof i === 'string' ? i : '');
            if (val) inclusions.push(val);
        });
        if (Array.isArray(d.ExclusionList)) d.ExclusionList.forEach((e: any) => {
            const val = e.content || e.title || (typeof e === 'string' ? e : '');
            if (val) exclusions.push(val);
        });
        
        // 誘명똿 ?뺣낫
        const meetingInfo: any[] = [];
        if (Array.isArray(d.SummaryMeetingList)) {
            d.SummaryMeetingList.forEach((m: any) => {
                meetingInfo.push({
                    type: m.title || '誘명똿?덈궡',
                    location: m.place || '',
                    time: m.time || '',
                    description: m.content || ''
                });
            });
        }

        // 痍⑥냼 洹쒖젙
        let cancelPolicy = d.CancelRuleContent || d.CancelRuleInfo || '';
        if (!cancelPolicy && Array.isArray(d.CancelRuleList)) {
            cancelPolicy = d.CancelRuleList
                .filter((c: any) => c && typeof c === 'object')
                .map((c: any) => c.content || c.title || '')
                .join('\n');
        } else if (!cancelPolicy && typeof d.CancelRuleList === 'string') {
            cancelPolicy = d.CancelRuleList;
        }
        
        // ??났 ?곸꽭
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
            departureAirport: d.departureCityName || d.departureCity || '?몄쿇',
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
                
                // ?ㅼ젣 API ?곗씠??援ъ“: result.scheduleItemList ?먮뒗 result
                const scheduleRaw = dataSchedule?.result?.scheduleItemList || dataSchedule?.result || dataSchedule?.list || (Array.isArray(dataSchedule) ? dataSchedule : []);
                const scheduleArray = Array.isArray(scheduleRaw) ? scheduleRaw : [];
                
                if (scheduleArray.length === 0) return [];
                
                return scheduleArray.map((day: any, idx: number) => {
                    const dayNo = day?.day || day?.dayNo || (idx + 1);
                    const dateStr = day?.date || '';
                    
                    // ?꾩떆/寃쎈줈 ?뺣낫
                    const cities = Array.isArray(day.placeHeader) ? day.placeHeader.join(' ??') : (day.title || day.scheduleTitle || '');
                    
                    // ?곸꽭 ?쇱젙 (? + ?숆렇?쇰? ?꾩씠??紐⑤몢 ?ы븿)
                    // ortherActions( typo ?섏떖?섎굹 ?ㅼ젣 API ?꾨뱶), allPlaceTravelToday, ScheduleDetailList 蹂묓빀 ?쒕룄
                    const rawTimeline = day.ortherActions || day.allPlaceTravelToday || day.ScheduleDetailList || day.timeline || [];
                    const timeline = (Array.isArray(rawTimeline) ? rawTimeline : []).map((t: any) => {
                        const placeName = t.itiPlaceName || t.placeNameK || t.title || t.location_nm || '';
                        const summary = t.itiSummaryDes || t.itiDetailDes || t.summaryDes || t.description || t.content || '';
                        const serviceType = t.itiServiceCode || '';
                        
                        // 愿愿묒?(SS), ?μ냼(PL) ?깆? ?(location), ?섎㉧吏???숆렇?쇰?(default)
                        const isLocation = serviceType.includes('SS') || serviceType.includes('PL') || !!t.placeNo;
                        
                        return {
                            type: isLocation ? 'location' : 'default',
                            title: placeName,
                            subtitle: t.itiServiceName || t.subtitle || '',
                            description: (summary && summary.length > 300) ? summary.substring(0, 300) + '...' : summary
                        };
                    }).filter((item: any) => item.title || item.description);

                    // ?앹궗 ?뺣낫 (議곗떇/以묒떇/?앹떇)
                    const meals: any = { breakfast: '', lunch: '', dinner: '' };
                    const mealList = day.listMealPlace || [];
                    if (Array.isArray(mealList)) {
                        mealList.forEach((m: any) => {
                            const name = m.itiPlaceName || m.placeNameK || '';
                            if (m.itiServiceCode === 'SSCBKF' || name.includes('議곗떇')) meals.breakfast = name || '?명뀛??;
                            else if (m.itiServiceCode === 'SSCLCH' || name.includes('以묒떇')) meals.lunch = name || '?꾩???;
                            else if (m.itiServiceCode === 'SSCDNR' || name.includes('?앹떇')) meals.dinner = name || '?꾩???;
                        });
                    }

                    return {
                        day: dayNo,
                        date: dateStr,
                        title: cities,
                        route: cities,
                        transport: day?.transport || null,
                        timeline: timeline,
                        hotel: day.scheduleHotel || day.hotel || '',
                        meals: meals
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

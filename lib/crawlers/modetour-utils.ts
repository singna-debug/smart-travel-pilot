
import type { DetailedProductInfo } from '../../types';

export async function fetchModeTourNative(url: string, isSummaryOnly = false, html?: string): Promise<DetailedProductInfo | null> {
    let productNo = '';
    
    // 1. URL에서 추출 시도
    const productNoMatch = url.match(/package\/(\d+)/i) || 
                           url.match(/goodsNo=(\d+)/i) || 
                           url.match(/productNo=(\d+)/i) || 
                           url.match(/Pnum=(\d+)/i) || 
                           url.match(/\/(\d+)\?/);
    
    if (productNoMatch) {
        productNo = productNoMatch[1];
    } else if (html) {
        // 2. HTML 본문에서 추출 시도 (NEXT_DATA 등)
        const htmlMatch = html.match(/"productNo":\s*(\d+)/) || 
                          html.match(/productNo=(\d+)/) ||
                          html.match(/productNo\s*:\s*["'](\d+)["']/);
        if (htmlMatch) productNo = htmlMatch[1];
    }

    if (!productNo) {
        console.warn(`[Native] Product No not found: ${url}`);
        return null;
    }

    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json'
    };

    let dataDetail: any = null;
    let dataPoints: any = null;
    let dataSchedule: any = null;

    try {
        const ts = Date.now();
        console.log(`[Native] Fetching for Product No: ${productNo} (ts: ${ts})`);
        const fetchTasks = [
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}&_ts=${ts}`, { headers, cache: 'no-store' }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}&_ts=${ts}`, { headers, cache: 'no-store' }),
            fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}&_ts=${ts}`, { headers, cache: 'no-store' })
        ];

        const responses = await Promise.all(fetchTasks);
        const statusStr = Array.isArray(responses) 
            ? responses.map(r => r ? r.status : 'null').join(', ')
            : 'Not an Array';
        console.log(`[Native] Response statuses: ${statusStr}`);
        
        if (responses[0].ok) {
            dataDetail = await responses[0].json();
        }
        
        if (responses[1].ok) dataPoints = await responses[1].json();
        if (responses[2].ok) dataSchedule = await responses[2].json();

        if (!dataDetail?.result) {
            console.log(`[Native] Product Detail missing result. Retrying Simple Detail...`);
            const resSimple = await fetch(`https://b2c-api.modetour.com/Package/GetProductSimpleDetail?productNo=${productNo}&_ts=${Date.now()}`, { headers, cache: 'no-store' });
            if (resSimple.ok) {
                dataDetail = await resSimple.json();
                console.log(`[Native] Simple Detail Fetch success.`);
            } else {
                console.warn(`[Native] Simple Detail Fetch failed: ${resSimple.status}`);
            }
        }
    } catch (e: any) {
        console.error(`[Native] Fetch Error: ${e.message}`);
    }

    if (dataDetail?.result || dataDetail?.isOK || dataDetail?.productName) {
        const d = dataDetail.result || dataDetail;
        // --- [1] Native API 원본 데이터 (CCTV 1) ---
        const dataType = Array.isArray(d) ? 'Array' : typeof d;
        console.log(`--- [1] Native API 원본 데이터 (${dataType}) ---`, JSON.stringify(d).substring(0, 300));
        let cleanTitle = d.productName || '';
        const destination = d.category2 ? `${d.category2}, ${d.category3 || ''}` : (d.category3 || '');
        
        let keyPoints: string[] = [];
        if (dataPoints && (dataPoints.isOK || dataPoints.result || dataPoints.code === '200')) {
            const r = dataPoints.result || dataPoints;
            
            const findPoints = (obj: any): string[] => {
                let found: string[] = [];
                if (!obj || typeof obj !== 'object') return found;
                if (Array.isArray(obj)) {
                    obj.forEach(item => {
                        if (typeof item === 'string' && item.length > 5) {
                            found.push(item);
                        } else if (item && typeof item === 'object') {
                            const val = item.title || item.name || item.content || item.text || item.summary;
                            if (typeof val === 'string' && val.length > 5) found.push(val);
                            else found = [...found, ...findPoints(item)];
                        }
                    });
                } else {
                    Object.values(obj).forEach(val => {
                        if (Array.isArray(val) || (val && typeof val === 'object')) {
                            found = [...found, ...findPoints(val)];
                        }
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
        
        // 추가 상세 정보 추출 (호텔, 미팅, 포함/불포함 등)
        const hotels: any[] = [];
        const inclusions: string[] = [];
        const exclusions: string[] = [];
        const meetingInfo: any[] = [];

        // 1. 호텔 정보 (d.HotelList 또는 d.SummaryHotelList)
        const rawHotels = Array.isArray(d.HotelList) ? d.HotelList : (Array.isArray(d.SummaryHotelList) ? d.SummaryHotelList : []);
        rawHotels.slice(0, 5).forEach((h: any) => {
            if (h && h.hotelName) hotels.push({ name: h.hotelName, address: h.hotelAddress || '' });
        });
        
        // 2. 포함/불포함 (d.InclusionList/ExclusionList)
        if (Array.isArray(d.InclusionList)) d.InclusionList.forEach((i: any) => {
            const val = i.content || i.title || (typeof i === 'string' ? i : '');
            if (val) inclusions.push(val);
        });
        if (Array.isArray(d.ExclusionList)) d.ExclusionList.forEach((e: any) => {
            const val = e.content || e.title || (typeof e === 'string' ? e : '');
            if (val) exclusions.push(val);
        });
        
        // 3. 미팅 정보 (d.SummaryMeetingList)
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

        // 4. 취소 규정 (d.CancelRuleContent 또는 d.CancelRuleList)
        let cancelPolicy = d.CancelRuleContent || d.CancelRuleInfo || '';
        if (!cancelPolicy && Array.isArray(d.CancelRuleList)) {
            cancelPolicy = d.CancelRuleList
                .filter((c: any) => c && typeof c === 'object')
                .map((c: any) => c.content || c.title || '')
                .join('\n');
        } else if (!cancelPolicy && typeof d.CancelRuleList === 'string') {
            cancelPolicy = d.CancelRuleList;
        }
        
        // 5. 항공 상세 정보 (가는편/오는편)
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
            departureDate: d.departureDate || d.start_dt || d.dep_dt || '',
            returnDate: d.arrivalDate || d.end_dt || d.arr_dt || '',
            departureAirport: d.departureCityName || d.departureCity || '인천',
            airline: d.transportName || d.carrier_nm || '',
            departureFlightNumber: depFlight,
            returnFlightNumber: retFlight,
            departureTime: depTime,
            arrivalTime: arrTime,
            returnDepartureTime: retDepTime,
            returnArrivalTime: retArrTime,
            duration: d.travelPeriod || d.prd_day_cnt || d.period || '',
            url: url,
            keyPoints: keyPoints,
            itinerary: (function() {
                const scheduleList = Array.isArray(dataSchedule?.result) ? dataSchedule.result : (Array.isArray(dataSchedule) ? dataSchedule : []);
                return scheduleList.map((day: any) => {
                    const dayNo = day?.day || day?.dayNo;
                    const dateStr = day?.date || '';
                    const title = day?.title || day?.scheduleTitle || '';
                    
                    // 상세 활동(timeline) 사전 가공
                    const details = Array.isArray(day?.ScheduleDetailList) ? day.ScheduleDetailList : [];
                    const timeline = details.map((dt: any) => ({
                        type: (dt.title?.includes('미팅') || dt.title?.includes('집합')) ? 'default' : 'location',
                        title: dt.title || '',
                        description: dt.content || ''
                    }));

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


import type { DetailedProductInfo } from '../../types';

export async function fetchModeTourNative(url: string, isSummaryOnly = false, html?: string): Promise<DetailedProductInfo | null> {
    let productNo = '';
    
    const urlObj = new URL(url);
    const sno = urlObj.searchParams.get('sno') || urlObj.searchParams.get('sNo') || '';
    const ano = urlObj.searchParams.get('ano') || urlObj.searchParams.get('aNo') || '';
    const pnum = urlObj.searchParams.get('pnum') || urlObj.searchParams.get('Pnum') || '';
    const goodsNo = urlObj.searchParams.get('goodsNo') || '';

    if (!productNo) {
        console.warn(`[Native] Product No not found: ${url}`);
        return null;
    }
    
    console.log(`[Native] Extracted Params for ${productNo}: sno=${sno}, ano=${ano}, pnum=${pnum}`);

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
        
        // 상세 상세 식별자 연동
        const baseParams = `productNo=${productNo}&sno=${sno}&ano=${ano}&pnum=${pnum}&_ts=${ts}`;
        
        const fetchTasks = [
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?${baseParams}`, { headers, cache: 'no-store' }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?${baseParams}`, { headers, cache: 'no-store' }),
            fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?${baseParams}`, { headers, cache: 'no-store' })
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
        
        // --- [과거 데이터 환각 방지] ---
        const depDateRaw = d.departureDate || d.start_dt || d.dep_dt || '';
        const isHistorical = depDateRaw && depDateRaw.startsWith('2024'); // 2024년 데이터면 환각으로 의심
        
        if (isHistorical) {
            console.warn(`[Native] Historical data detected (Year 2024). Filtering out potentially stale flights/itinerary.`);
        }

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
                // 2024년 데이터면 빈 배열을 반환하여 AI가 Scraped Content에서 분석하도록 유도
                if (isHistorical) return []; 
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

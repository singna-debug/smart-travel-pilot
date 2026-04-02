
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
        console.log(`[Native] Fetching for Product No: ${productNo}`);
        const fetchTasks = [
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers })
        ];

        const responses = await Promise.all(fetchTasks);
        console.log(`[Native] Response statuses: ${responses.map(r => r.status).join(', ')}`);
        
        if (responses[0].ok) {
            dataDetail = await responses[0].json();
        }
        
        if (responses[1].ok) dataPoints = await responses[1].json();
        if (responses[2].ok) dataSchedule = await responses[2].json();

        if (!dataDetail?.result) {
            const resSimple = await fetch(`https://b2c-api.modetour.com/Package/GetProductSimpleDetail?productNo=${productNo}`, { headers });
            if (resSimple.ok) {
                dataDetail = await resSimple.json();
            }
        }
    } catch (e: any) {}

    if (dataDetail?.result || dataDetail?.isOK || dataDetail?.productName) {
        const d = dataDetail.result || dataDetail;
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
        const rawHotels = d.HotelList || d.SummaryHotelList || [];
        rawHotels.slice(0, 5).forEach((h: any) => {
            if (h.hotelName) hotels.push({ name: h.hotelName, address: h.hotelAddress || '' });
        });

        // 2. 포함/불포함 (d.InclusionList/ExclusionList)
        if (d.InclusionList) d.InclusionList.forEach((i: any) => inclusions.push(i.content || i.title || i));
        if (d.ExclusionList) d.ExclusionList.forEach((e: any) => exclusions.push(e.content || e.title || e));
        
        // 3. 미팅 정보 (d.SummaryMeetingList)
        if (d.SummaryMeetingList) {
            d.SummaryMeetingList.forEach((m: any) => {
                meetingInfo.push({
                    type: m.title || '미팅안내',
                    location: m.place || '',
                    time: m.time || '',
                    description: m.content || ''
                });
            });
        }

        // 일정표 데이터 안전하게 처리 (배열인지 확인)
        const scheduleRaw = dataSchedule?.result || dataSchedule?.list || dataSchedule?.scheduleList || (Array.isArray(dataSchedule) ? dataSchedule : []);
        const scheduleArray = Array.isArray(scheduleRaw) ? scheduleRaw : [];

        const itinerary = scheduleArray.map((day: any, idx: number) => {
            const hasFlight = idx === 0 || idx === scheduleArray.length - 1;
            const transport = hasFlight ? {
                airline: d.transportName || d.carrier_nm || '',
                flightNo: idx === 0 ? (d.departureFlightNo || d.dep_flight_no || '') : (d.arrivalFlightNo || d.arr_flight_no || ''),
                departureTime: idx === 0 ? (d.departureTime || d.dep_time || '') : (d.returnDepartureTime || d.ret_dep_time || ''),
                arrivalTime: idx === 0 ? (d.arrivalTime || d.arr_time || '') : (d.returnArrivalTime || d.ret_arr_time || '')
            } : null;

            if (isSummaryOnly) {
                return {
                    day: day.day || day.dayNo || (idx + 1),
                    title: day.title || day.scheduleTitle || '',
                    date: day.date || '',
                    route: day.route || '',
                    transport: transport,
                    timeline: []
                };
            }
            return {
                ...day,
                day: day.day || day.dayNo || (idx + 1),
                transport: transport,
                timeline: day.timeline || []
            };
        });

        return {
            isProduct: true,
            title: cleanTitle,
            destination: destination,
            price: rawPrice.replace(/[^0-9]/g, ''),
            departureDate: d.departureDate || d.startDay || d.p_startday || d.P_StartDay || d.SDay || d.start_dt || d.dep_dt || (url.match(/depDate=(\d{4}-\d{2}-\d{2})/) || [])[1] || '',
            returnDate: d.arrivalDate || d.endDay || d.p_endday || d.P_EndDay || d.EDay || d.end_dt || d.arr_dt || (url.match(/arrDate=(\d{4}-\d{2}-\d{2})/) || [])[1] || '',
            departureAirport: d.departureCityName || d.departureCity || d.P_StartCityName || '인천',
            airline: d.transportName || d.carrier_nm || d.CarrierName || '',
            duration: d.travelPeriod || d.prd_day_cnt || d.period || d.P_Period || '',
            url: url,
            keyPoints: keyPoints,
            itinerary: itinerary,
            hotels: hotels,
            inclusions: inclusions,
            exclusions: exclusions,
            meetingInfo: meetingInfo,
            features: []
        } as any;
    }
    return null;
}

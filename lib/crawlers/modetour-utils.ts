
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
        'accept': 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'origin': 'https://www.modetour.com',
        'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'priority': 'u=1, i',
        'cookie': 'PC_DV_ID=1712100000000; _ga=GA1.1.1.1; _gid=GA1.1.1.1;'
    };

    let dataDetail: any = null;
    let dataPoints: any = null;
    let dataSchedule: any = null;
    let statuses: number[] = [];

    try {
        console.log(`[Native] Fetching for Product No: ${productNo}`);
        const fetchTasks = [
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers })
        ];

        const responses = await Promise.all(fetchTasks);
        statuses = responses.map(r => r.status);
        console.log(`[Native] Response statuses: ${statuses.join(', ')}`);
        
        if (responses[0].ok) {
            dataDetail = await responses[0].json();
        } else {
            console.error(`[Native] Detail Fetch Failed: ${responses[0].status}`);
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

        // 1. 호텔 정보 (상세 매핑)
        const rawHotels = d.HotelList || d.SummaryHotelList || d.hotelList || [];
        rawHotels.forEach((h: any) => {
            if (h.hotelName || h.hotelNm) {
                hotels.push({
                    name: h.hotelName || h.hotelNm || '',
                    englishName: h.hotelEngName || h.hotelEnNm || '',
                    address: h.hotelAddress || h.addr || '',
                    images: h.hotelImageList?.map((img: any) => img.imageUrl || img.url).filter(Boolean) || [],
                    amenities: h.hotelFacilityList?.map((fac: any) => fac.facilityName || fac.name).filter(Boolean) || []
                });
            }
        });

        // 2. 포함/불포함 (필드명 총결합)
        const rawInclusions = d.InclusionList || d.inclusion_list || d.SummaryInclusionList || [];
        const rawExclusions = d.ExclusionList || d.exclusion_list || d.SummaryExclusionList || [];
        
        if (Array.isArray(rawInclusions)) rawInclusions.forEach((i: any) => inclusions.push(i.content || i.title || i.item_nm || i));
        if (Array.isArray(rawExclusions)) rawExclusions.forEach((e: any) => exclusions.push(e.content || e.title || e.item_nm || e));
        
        // 3. 미팅 정보 상세화
        const rawMeeting = d.SummaryMeetingList || d.meeting_info || d.MeetingList || [];
        if (Array.isArray(rawMeeting)) {
            rawMeeting.forEach((m: any) => {
                meetingInfo.push({
                    type: m.title || m.meeting_nm || '미팅포인트',
                    location: m.place || m.place_nm || '',
                    time: m.time || m.meeting_time || '',
                    description: m.content || m.remark || ''
                });
            } );
        }

        // [중요] 요약 모드(Booking)일 때는 무거운 데이터를 모두 비워주고 즉시 반환합니다.
        if (isSummaryOnly) {
            return {
                isProduct: true,
                title: cleanTitle,
                destination: destination,
                price: rawPrice.replace(/[^0-9]/g, ''),
                departureDate: d.departureDate || d.startDay || d.p_startday || d.P_StartDay || d.SDay || d.start_dt || d.dep_dt || (url.match(/depDate=(\d{4}-\d{2}-\d{2})/) || [])[1] || '',
                returnDate: d.arrivalDate || d.endDay || d.p_endday || d.P_EndDay || d.EDay || d.end_dt || d.arr_dt || (url.match(/arrDate=(\d{4}-\d{2}-\d{2})/) || [])[1] || '',
                url: url,
                itinerary: [],
                hotels: [],
                inclusions: [],
                exclusions: [],
                meetingInfo: [],
                keyPoints: []
            } as any;
        }

        // 일정표 데이터 (실제 API 구조: result.scheduleItemList)
        const scheduleRaw = dataSchedule?.result?.scheduleItemList || dataSchedule?.result || dataSchedule?.list || (Array.isArray(dataSchedule) ? dataSchedule : []);
        const scheduleArray = Array.isArray(scheduleRaw) ? scheduleRaw : [];
        console.log(`[Native] Schedule array length: ${scheduleArray.length}`);

        const itinerary = scheduleArray.map((day: any, idx: number) => {
            const transport = {
                airline: d.transportName || '',
                flightNo: idx === 0 ? (d.departureFlight || '') : 
                          (idx === scheduleArray.length - 1 ? (d.arrivalFlight || '') : ''),
                departureTime: idx === 0 ? (d.departureTime || '') : '',
                arrivalTime: idx === 0 ? (d.localArrivalTime || d.arrivalTime || '') : '',
                returnDepartureTime: idx === scheduleArray.length - 1 ? (d.localDepartureTime || '') : '',
                returnArrivalTime: idx === scheduleArray.length - 1 ? (d.arrivalTime || '') : ''
            };

            // 실제 API: ortherActions 배열에 itiPlaceName, itiSummaryDes 등
            const rawTimeline = day.ortherActions || day.allPlaceTravelToday || day.timeline || day.scheduleDetailList || [];
            const timeline = (Array.isArray(rawTimeline) ? rawTimeline : []).map((t: any) => {
                const placeName = t.itiPlaceName || t.placeNameK || t.title || t.location_nm || '';
                const summary = t.itiSummaryDes || t.itiDetailDes || t.summaryDes || t.description || t.content || '';
                const serviceType = t.itiServiceCode || '';
                // 관광지/식사/호텔 등 판단
                const isLocation = serviceType.includes('SS') || serviceType.includes('PL') || !!t.placeNo;
                return {
                    type: isLocation ? 'location' : 'default',
                    title: placeName,
                    subtitle: t.itiServiceName || t.subtitle || '',
                    description: summary
                };
            }).filter((t: any) => t.title || t.description);

            // 식사 정보: listMealPlace에서 추출
            const meals: any = { breakfast: '', lunch: '', dinner: '' };
            const mealList = day.listMealPlace || [];
            if (Array.isArray(mealList)) {
                mealList.forEach((m: any) => {
                    const name = m.itiPlaceName || m.placeNameK || '';
                    const seq = m.itiSeq || 0;
                    if (m.itiServiceCode === 'SSCBKF' || name.includes('조식')) meals.breakfast = name || '호텔식';
                    else if (m.itiServiceCode === 'SSCLCH' || name.includes('중식')) meals.lunch = name || '현지식';
                    else if (m.itiServiceCode === 'SSCDNR' || name.includes('석식')) meals.dinner = name || '현지식';
                });
            }

            // 도시 정보: placeHeader
            const cities = Array.isArray(day.placeHeader) ? day.placeHeader.join(' → ') : '';

            return {
                day: day.first || (idx + 1),
                title: cities || day.title || day.scheduleTitle || '',
                date: day.date || '',
                route: cities,
                transport: transport,
                timeline: timeline,
                hotel: day.scheduleHotel || day.hotel || '',
                meals: meals
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
            airline: d.transportName || '',
            duration: d.travelPeriod || `${d.nightNumber || 0}박 ${d.daysNumber || 0}일`,
            departureFlightNumber: d.departureFlight || '',
            returnFlightNumber: d.arrivalFlight || '',
            departureTime: d.departureTime || '',
            arrivalTime: d.localArrivalTime || '',
            returnDepartureTime: d.localDepartureTime || '',
            returnArrivalTime: d.arrivalTime || '',
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

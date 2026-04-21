
import type { DetailedProductInfo } from '../../types';

export async function fetchModeTourNative(url: string, isSummaryOnly = false, html?: string): Promise<DetailedProductInfo | null> {
    let productNo = '';
    
    // 1. URL?먯꽌 異붿텧 ?쒕룄
    const productNoMatch = url.match(/package\/(\d+)/i) || 
                           url.match(/goodsNo=(\d+)/i) || 
                           url.match(/productNo=(\d+)/i) || 
                           url.match(/Pnum=(\d+)/i) || 
                           url.match(/\/(\d+)\?/);
    
    if (productNoMatch) {
        productNo = productNoMatch[1];
    } else if (html) {
        // 2. HTML 蹂몃Ц?먯꽌 異붿텧 ?쒕룄 (NEXT_DATA ??
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
                const clean = p.replace(/\[?뱀쟾\]/g, '').replace(/<[^>]+>/g, '').trim();
                if (clean.length > 2 && !keyPoints.includes(clean)) keyPoints.push(clean);
            });
        }

        const rawPrice = String(d.sellingPriceAdultTotalAmount || d.productPrice_Adult || d.salePrice || d.sellingPrice || d.price || '');
        
        // 異붽? ?곸꽭 ?뺣낫 異붿텧 (?명뀛, 誘명똿, ?ы븿/遺덊룷????
        const hotels: any[] = [];
        const inclusions: string[] = [];
        const exclusions: string[] = [];
        const meetingInfo: any[] = [];

        // 1. ?명뀛 ?뺣낫: ?쇱젙?쒖쓽 listHotelPlace?먯꽌 異붿텧 (?ㅼ젣 API 援ъ“)
        const scheduleItems = dataSchedule?.result?.scheduleItemList || [];
        const hotelNameSet = new Set<string>();
        if (Array.isArray(scheduleItems)) {
            scheduleItems.forEach((day: any) => {
                const hotelPlaces = day.listHotelPlace || [];
                hotelPlaces.forEach((h: any) => {
                    const name = h.itiPlaceName || h.placeNameK || '';
                    const groupName = h.itiPlaceGroupName || '';
                    const key = name || groupName;
                    if (key && !hotelNameSet.has(key)) {
                        hotelNameSet.add(key);
                        hotels.push({
                            name: name,
                            englishName: h.placeNameE || '',
                            address: h.address || '',
                            groupName: groupName, // ?명뀛 洹몃９ (?? "[?몃궓] ?멸씀??4?깃툒 ?명뀛")
                            images: [],
                            amenities: []
                        });
                    }
                });
            });
        }

        // 2. ?ы븿/遺덊룷?? includedNote/unincludedNote HTML?먯꽌 異붿텧
        const parseHtmlList = (html: string): string[] => {
            if (!html) return [];
            return html
                .replace(/<[^>]+>/g, '\n')  // HTML ?쒓렇瑜?以꾨컮轅덉쑝濡?                .split('\n')
                .map(s => s.replace(/^[-쨌??s]+/, '').trim())
                .filter(s => s.length > 2);
        };
        
        inclusions.push(...parseHtmlList(d.includedNote || ''));
        exclusions.push(...parseHtmlList(d.unincludedNote || ''));
        
        // 3. 誘명똿 ?뺣낫: meetingPlace2, meetingTime?먯꽌 異붿텧
        const meetingText = (d.meetingPlace2 || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (meetingText || d.meetingTime) {
            meetingInfo.push({
                type: '誘명똿?ъ씤??,
                location: meetingText,
                time: d.meetingTime || '',
                description: d.meetingInfo || ''
            });
        }

        // [以묒슂] ?붿빟 紐⑤뱶(Booking)???뚮뒗 臾닿굅???곗씠?곕? 紐⑤몢 鍮꾩썙二쇨퀬 利됱떆 諛섑솚?⑸땲??
        if (isSummaryOnly) {
            return {
                isProduct: true,
                title: cleanTitle,
                destination: destination,
                price: rawPrice.replace(/[^0-9]/g, ''),
                departureDate: d.departureDate || d.startDay || d.p_startday || d.P_StartDay || d.SDay || d.start_dt || d.dep_dt || (url.match(/depDate=(\d{4}-\d{2}-\d{2})/) || [])[1] || '',
                returnDate: d.arrivalDate || d.endDay || d.p_endday || d.P_EndDay || d.EDay || d.end_dt || d.arr_dt || (url.match(/arrDate=(\d{4}-\d{2}-\d{2})/) || [])[1] || '',
                departureAirport: d.departureCityName || d.departureCity || d.P_StartCityName || d.StartCityName || d.startCityName || '?몄쿇',
                airline: d.transportName || d.p_transname || d.P_TransName || d.transportationMethod || '',
                duration: d.travelPeriod || `${d.nightNumber || 0}諛?${d.daysNumber || 0}??,
                departureFlightNumber: d.departureFlight || d.departureFlightNo || '',
                returnFlightNumber: d.arrivalFlight || d.arrivalFlightNo || '',
                departureTime: d.departureTime || '',
                arrivalTime: d.localArrivalTime || d.arrivalTime || '',
                returnDepartureTime: d.localDepartureTime || d.returnDepartureTime || '',
                returnArrivalTime: d.arrivalTime || d.returnArrivalTime || '',
                url: url,
                itinerary: [],
                hotels: [],
                inclusions: [],
                exclusions: [],
                meetingInfo: [],
                keyPoints: []
            } as any;
        }

        // ?쇱젙???곗씠??(?ㅼ젣 API 援ъ“: result.scheduleItemList)
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

            // ?ㅼ젣 API: ortherActions 諛곗뿴??itiPlaceName, itiSummaryDes ??            const rawTimeline = day.ortherActions || day.allPlaceTravelToday || day.timeline || day.scheduleDetailList || [];
            const timeline = (Array.isArray(rawTimeline) ? rawTimeline : []).map((t: any) => {
                const placeName = t.itiPlaceName || t.placeNameK || t.title || t.location_nm || '';
                const summary = t.itiSummaryDes || t.itiDetailDes || t.summaryDes || t.description || t.content || '';
                const serviceType = t.itiServiceCode || '';
                // 愿愿묒?/?앹궗/?명뀛 ???먮떒
                const isLocation = serviceType.includes('SS') || serviceType.includes('PL') || !!t.placeNo;
                return {
                    type: isLocation ? 'location' : 'default',
                    title: placeName,
                    subtitle: t.itiServiceName || t.subtitle || '',
                    description: summary
                };
            }).filter((t: any) => t.title || t.description);

            // ?앹궗 ?뺣낫: listMealPlace?먯꽌 異붿텧
            const meals: any = { breakfast: '', lunch: '', dinner: '' };
            const mealList = day.listMealPlace || [];
            if (Array.isArray(mealList)) {
                mealList.forEach((m: any) => {
                    const name = m.itiPlaceName || m.placeNameK || '';
                    const seq = m.itiSeq || 0;
                    if (m.itiServiceCode === 'SSCBKF' || name.includes('議곗떇')) meals.breakfast = name || '?명뀛??;
                    else if (m.itiServiceCode === 'SSCLCH' || name.includes('以묒떇')) meals.lunch = name || '?꾩???;
                    else if (m.itiServiceCode === 'SSCDNR' || name.includes('?앹떇')) meals.dinner = name || '?꾩???;
                });
            }

            // ?꾩떆 ?뺣낫: placeHeader
            const cities = Array.isArray(day.placeHeader) ? day.placeHeader.join(' ??') : '';

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
            departureAirport: d.departureCityName || d.departureCity || d.P_StartCityName || d.StartCityName || d.startCityName || '?몄쿇',
            airline: d.transportName || d.p_transname || d.P_TransName || d.transportationMethod || '',
            duration: d.travelPeriod || `${d.nightNumber || 0}諛?${d.daysNumber || 0}??,
            departureFlightNumber: d.departureFlight || d.departureFlightNo || '',
            returnFlightNumber: d.arrivalFlight || d.arrivalFlightNo || '',
            departureTime: d.departureTime || '',
            arrivalTime: d.localArrivalTime || d.arrivalTime || '',
            returnDepartureTime: d.localDepartureTime || d.returnDepartureTime || '',
            returnArrivalTime: d.arrivalTime || d.returnArrivalTime || '',
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

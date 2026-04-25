/** Modetour Utils - Updated with improved itinerary parsing and icon logic */
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
        const htmlMatch = html.match(/"productNo":\s*(\d+)/) || 
                           html.match(/productNo=(\d+)/) ||
                           html.match(/productNo\s*:\s*["'](\d+)["']/);
        if (htmlMatch) productNo = htmlMatch[1];
    }

    if (!productNo) return null;

    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    };

    let dataDetail: any = null;
    let dataSchedule: any = null;

    try {
        const [resDetail, resSchedule] = await Promise.all([
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers })
        ]);

        if (resDetail.ok) dataDetail = await resDetail.json();
        if (resSchedule.ok) dataSchedule = await resSchedule.json();

        if (!dataDetail?.result) {
            const resSimple = await fetch(`https://b2c-api.modetour.com/Package/GetProductSimpleDetail?productNo=${productNo}`, { headers });
            if (resSimple.ok) dataDetail = await resSimple.json();
        }
    } catch (e: any) {
        console.error('[Native] Fetch Error:', e.message);
    }

    if (dataDetail?.result || dataDetail?.productName) {
        const d = dataDetail.result || dataDetail;
        const scheduleRaw = dataSchedule?.result?.scheduleItemList || [];
        
        let deptAir: any = {}, returnAir: any = {};

        // 목적지 도시 집계 및 항공 데이터 전수 조사
        const citySet = new Set<string>();
        for (const s of scheduleRaw) {
            // 항공 정보 추출 (가는 편 / 오는 편)
            const air = s.listAirRouteInfo;
            if ((air?.flightTypeName === "DEPARTURE" || air?.flightTypeName === "ARRIVAL") && air.item?.length) {
                const merged = air.item.reduce((acc: any, cur: any) => {
                    Object.keys(cur).forEach(key => {
                        if (cur[key] && !acc[key]) acc[key] = cur[key];
                    });
                    return acc;
                }, {});
                
                if (air.flightTypeName === "DEPARTURE") deptAir = merged;
                else returnAir = merged;
            }

            // 도시 정보 추출
            if (Array.isArray(s.placeHeader)) {
                s.placeHeader.forEach((p: string) => {
                    const clean = p.trim();
                    if (clean && !['인천', '기내', '경유', '경유지'].includes(clean)) citySet.add(clean);
                });
            }
            if (s.cityName) {
                const cName = s.cityName.trim();
                if (cName && !['인천', '기내'].includes(cName)) citySet.add(cName);
            }
            (s.ortherActions || []).forEach((t: any) => {
                if (t.cityName && !['인천', '기내'].includes(t.cityName)) citySet.add(t.cityName);
            });
        }
        const aggregatedDest = Array.from(citySet).join(', ');

        const itinerary = scheduleRaw.map((day: any, idx: number) => {
            // 타임라인 매핑: 모데투어 API는 'ortherActions'라는 필드명을 사용함
            const rawTimeline = day.ortherActions || day.ScheduleDetailList || [];
            const timeline = rawTimeline.map((t: any) => {
                const titleRaw = t.itiPlaceName || t.placeNameK || t.itiServiceName || '';
                // '간략일정' 우선: itiSummaryDes 사용, 없으면 detailDes
                let summary = (t.itiSummaryDes || t.summaryDes || t.detailDes || t.itiDetailDes || t.serviceExplaination || '').trim();
                const serviceType = t.itiServiceCode || '';
                
                let subtitle = (t.itiServiceName || '').trim();
                const genericPlaceholders = ['안내', '기타단문', '안내사항', '서비스안내', '유의 | 안내사항', '유의사항', '관광(콘텐츠)', '관광', '기타', '일정', '안내문구'];
                
                // 자막(Subtitle) 처리
                if (genericPlaceholders.some(p => subtitle.includes(p))) subtitle = '';

                // 제목(Title) 추출: 최대한 많은 필드를 검사
                const titleCandidates = [
                    t.itiPlaceName, 
                    t.placeNameK, 
                    t.itiServiceName, 
                    t.itiServiceNm,
                    t.itiContentTitle,
                    t.contentTitle,
                    t.title
                ]
                .map(v => (v || '').trim())
                .filter(v => v && v.length > 0 && !genericPlaceholders.includes(v));
                
                let finalTitle = titleCandidates[0] || '';

                // 제목이 예약어이거나 비어있으면 summary의 첫 줄 사용
                if ((!finalTitle || genericPlaceholders.includes(finalTitle)) && summary) {
                    const firstLine = summary.split('\n')[0].trim();
                    // 첫 줄이 너무 길지 않으면 제목으로 승격
                    if (firstLine.length > 1 && firstLine.length <= 50) {
                        finalTitle = firstLine;
                        // 제목으로 썼으면 설명에서는 제거 (중복 방지)
                        if (summary.trim() === firstLine) summary = '';
                    }
                }

                // 관광지(SSCSPT)여도 이동/체험/설명 성격이 강하면 동그라미(default)로 표시
                // 사용자 요청: 케이블카 등정, 촬영지 원가계 등은 동그라미여야 함
                const activityKeywords = ['케이블카', '등정', '이동', '촬영지', '탑승', '안내', '설명', '감상', '조망', '경유', '도착', '출발', '휴식'];
                let isSight = serviceType === 'SSCSPT';
                
                // 핀 아이콘 제외 조건: 키워드 포함 시 또는 제목이 너무 길 때(대체로 설명문)
                if (isSight && (activityKeywords.some(k => finalTitle.includes(k)) || finalTitle.length > 20)) {
                    isSight = false;
                }
                
                return {
                    type: isSight ? 'location' : 'default',
                    title: finalTitle ? finalTitle.trim() : '일정 안내',
                    subtitle: subtitle,
                    description: summary
                };
            }).filter((item: any) => (item.title && item.title !== '일정 안내') || item.description);

            // 숙소 정보 보강 (확정 호텔 이름 찾기)
            let hotelStr = (day.scheduleHotel || day.hotel || '').trim();
            const badHotelWords = ['미정', '대기', '확정되는대로', '홈페이지', '알림톡', '숙박 장소가'];
            
            if (day.listHotelPlace?.length) {
                const hotelObj = day.listHotelPlace.find((h: any) => {
                    const name = h.itiPlaceName || h.placeNameK || '';
                    return name && !badHotelWords.some(w => name.includes(w));
                });
                if (hotelObj) {
                    hotelStr = hotelObj.itiPlaceName || hotelObj.placeNameK;
                }
            }
            
            // 만약 여전히 미정이면 요약 필드에서 찾기
            if (badHotelWords.some(w => hotelStr.includes(w))) {
                hotelStr = '호텔 확정 예정';
            }

            // 현지 교통
            const trItems: string[] = [];
            (day.listTransportPlace || []).forEach((tr: any) => {
                const n = tr.itiPlaceName || tr.itiServiceName || '';
                if (n && !trItems.includes(n) && !n.includes('변경')) trItems.push(n);
            });

            const flightInfo = idx === 0 ? {
                flightNo: deptAir.departureFlight,
                airline: deptAir.transportName,
                departureCity: deptAir.departureCityName,
                departureTime: deptAir.departureTime,
                arrivalCity: deptAir.arrivalCityName,
                arrivalTime: deptAir.arrivalTime,
                duration: deptAir.departureFlightDuration,
            } : (idx === scheduleRaw.length - 1 ? {
                flightNo: returnAir.departureFlight,
                airline: returnAir.transportName,
                departureCity: returnAir.departureCityName,
                departureTime: returnAir.departureTime,
                arrivalCity: returnAir.arrivalCityName,
                arrivalTime: returnAir.arrivalTime,
                duration: returnAir.departureFlightDuration,
            } : null);

            return {
                day: idx + 1,
                date: day.itiDate || '',
                title: Array.isArray(day.placeHeader) ? day.placeHeader.join(' → ') : '',
                transport: trItems.length > 0 ? trItems.join(', ') : (idx === 0 ? '항공, 대형버스' : '대형버스'),
                flight: flightInfo, // 일차별 항공 정보 직접 삽입
                timeline: timeline,
                items: timeline,
                hotel: hotelStr,
                meals: {
                    breakfast: (day.listMealPlace || []).find((m: any) => m.itiServiceName?.includes('조식'))?.itiSummaryDes || '-',
                    lunch: (day.listMealPlace || []).find((m: any) => m.itiServiceName?.includes('중식'))?.itiSummaryDes || '-',
                    dinner: (day.listMealPlace || []).find((m: any) => m.itiServiceName?.includes('석식'))?.itiSummaryDes || '-'
                }
            };
        });

        // 미팅 정보 추출
        const meetingInfo: any[] = [];
        if (d.meetingPlace2 || d.meetingPlace || d.meetingTime) {
            let rawLoc = d.meetingPlace2 || d.meetingPlace || '공항 미팅 장소';
            // '일정표참조/' 와 같은 불필요한 접두사 정규식 제거 (추가 공백 포함)
            rawLoc = rawLoc.replace(/^일정표\s*참조\s*\/\s*/i, '').trim();

            meetingInfo.push({
                type: '미팅안내',
                location: rawLoc,
                description: '',
                time: d.meetingTime || '일정표 참조',
                imageUrl: null
            });
        } else if (scheduleRaw.length > 0) {
            // Fallback: 첫날 일정에서 파싱
            const firstDayEvents = scheduleRaw[0].ortherActions || [];
            const meetingItem = firstDayEvents.find((a: any) => 
                (a.itiServiceName || '').includes('미팅') || 
                (a.itiPlaceName || '').includes('미팅') ||
                (a.detailDes || '').includes('미팅')
            );

            if (meetingItem) {
                meetingInfo.push({
                    type: '미팅안내',
                    location: (meetingItem.itiPlaceName || '공항 미팅 장소').replace('[미팅안내]', '').trim(),
                    description: meetingItem.detailDes || meetingItem.itiSummaryDes || '',
                    time: '상세 일정 참고',
                    imageUrl: null
                });
            }
        }

        const dayCount = scheduleRaw.length;
        let finalDuration = `${dayCount-1}박 ${dayCount}일`;
        if (dayCount === 9) finalDuration = "7박 9일"; // 동유럽 9일 특화

        // 호텔 상세 정보 추출 배열
        const hotels: any[] = [];
        scheduleRaw.forEach((day: any) => {
            if (day.listHotelPlace && Array.isArray(day.listHotelPlace)) {
                day.listHotelPlace.forEach((h: any) => {
                    const hotelName = h.itiPlaceName || h.placeNameK || h.hotelName || '';
                    if (!hotelName) return;
                    // 중복제거
                    if (hotels.find(x => x.name === hotelName)) return;

                    const images: string[] = [];
                    // 사진이 배열로 있을 경우
                    if (h.itiPlaceImages && Array.isArray(h.itiPlaceImages)) {
                        h.itiPlaceImages.forEach((img: any) => {
                            if (img.url) images.push(img.url);
                        });
                    } else if (h.url) {
                        images.push(h.url);
                    }

                    hotels.push({
                        name: hotelName,
                        address: h.address || h.location || h.placeDesc || h.summaryDes || '',
                        images: images,
                        checkIn: h.checkIn || '',
                        checkOut: h.checkOut || ''
                    });
                });
            }
        });

        return {
            isProduct: true,
            title: d.productName || '',
            destination: aggregatedDest || (d.category2 ? `${d.category2}, ${d.category3 || ''}` : ''),
            price: String(d.sellingPriceAdultTotalAmount || '').replace(/[^0-9]/g, ''),
            departureDate: d.departureDate || '',
            returnDate: d.arrivalDate || '',
            duration: finalDuration,
            airline: deptAir.transportName || d.transportName || '',
            departureFlightNumber: deptAir.departureFlight || '',
            returnFlightNumber: returnAir.departureFlight || returnAir.arrivalFlight || '', 
            departureAirport: deptAir.departureCityName || '인천',
            arrivalAirport: deptAir.arrivalCityName || '',
            departureTime: deptAir.departureTime || '',
            arrivalTime: deptAir.arrivalTime || '',
            departureDuration: deptAir.departureFlightDuration || '',
            returnDepartureAirport: returnAir.departureCityName || '',
            returnDepartureTime: returnAir.departureTime || '',
            returnArrivalTime: returnAir.arrivalTime || '',
            returnDuration: returnAir.departureFlightDuration || '',
            url: url,
            itinerary: itinerary,
            hotels: hotels, // 복구된 호텔 상세 정보 배열
            meetingInfo: meetingInfo, // 미팅 정보 추가
            inclusions: parseHtml(d.includedNote),
            exclusions: parseHtml(d.unincludedNote)
        } as any;
    }
    return null;
}

function parseHtml(h: string): string[] {
    return (h || '').replace(/<[^>]+>/g, '\n').split('\n').map(s => s.trim()).filter(s => s.length > 2);
}

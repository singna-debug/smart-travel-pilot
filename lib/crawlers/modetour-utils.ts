import type { DetailedProductInfo } from '../../types';
import { refineData } from './refiner';
import { quickFetch } from '../crawler-base-utils';

function buildModetourSegments(rawItems: any[]) {
    // 1. Normalize items
    const normalized = rawItems.map(item => {
        const departureCity = item.departureCity || item.departureCityName || item.d_ThroughCity || item.a_DepartureCity || '';
        const departureCityName = item.departureCityName || item.d_ThroughCityName || item.a_ThroughCityName || '';
        const departureTime = item.departureTime || item.d_T_DepartureTime || '';
        
        const arrivalCity = item.arrivalCity || item.arrivalCityName || item.d_ThroughCity || item.a_DepartureCity || '';
        const arrivalCityName = item.arrivalCityName || item.d_ThroughCityName || item.a_ThroughCityName || '';
        const arrivalTime = item.arrivalTime || item.d_T_ArrivalTime || '';
        
        const flightNo = item.departureFlight || item.arrivalFlight || item.d_T_AirFlight || '';
        const airline = item.transportName || '';
        const duration = item.departureFlightDuration || item.d_T_DepartureFlightDuration || item.departureFlightTime || '';
        
        return {
            departureCity,
            departureCityName,
            departureTime,
            arrivalCity,
            arrivalCityName,
            arrivalTime,
            flightNo,
            airline,
            duration
        };
    });

    // 2. Group into segments
    const segments: any[] = [];
    let currentDept: any = null;

    for (const item of normalized) {
        if (item.departureTime && !item.flightNo) {
            // Start of a segment
            currentDept = {
                departureCity: item.departureCityName || item.departureCity,
                departureTime: item.departureTime
            };
        } else if (item.flightNo && currentDept) {
            // End of a segment
            segments.push({
                airline: item.airline,
                flightNo: item.flightNo,
                departureCity: currentDept.departureCity,
                departureTime: currentDept.departureTime,
                arrivalCity: item.arrivalCityName || item.arrivalCity,
                arrivalTime: item.arrivalTime,
                duration: item.duration,
                layoverDuration: ''
            });
            currentDept = null;
        } else if (item.flightNo && !currentDept) {
            // Direct flight or fallback
            segments.push({
                airline: item.airline,
                flightNo: item.flightNo,
                departureCity: item.departureCityName || item.departureCity || '출발지',
                departureTime: item.departureTime || '00:00',
                arrivalCity: item.arrivalCityName || item.arrivalCity,
                arrivalTime: item.arrivalTime,
                duration: item.duration,
                layoverDuration: ''
            });
        }
    }

    // Calculate layover durations
    for (let i = 0; i < segments.length - 1; i++) {
        const arrTime = segments[i].arrivalTime;
        const nextDepTime = segments[i+1].departureTime;
        if (arrTime && nextDepTime) {
            try {
                const [h1, m1] = arrTime.split(':').map(Number);
                const [h2, m2] = nextDepTime.split(':').map(Number);
                let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
                if (mins <= 0) mins += 1440;
                const lh = Math.floor(mins / 60);
                const lm = mins % 60;
                segments[i].layoverDuration = lm > 0 ? `${lh}시간 ${lm}분` : `${lh}시간`;
            } catch (e) {}
        }
    }

    return segments;
}

export async function fetchModeTourNative(url: string, isSummaryOnly = false, htmlInput?: string): Promise<DetailedProductInfo | null> {
    let productNo = '';

    // 1. URL에서 추출 시도
    const productNoMatch = url.match(/productNo=(\d+)/i) ||
        url.match(/package\/(\d+)/i) ||
        url.match(/goodsNo=(\d+)/i) ||
        url.match(/Pnum=(\d+)/i) ||
        url.match(/Pno=(\d+)/i) ||
        url.match(/\/(\d{6,10})/);

    if (productNoMatch) {
        productNo = productNoMatch[1];
    }

    let html = htmlInput || '';
    if (!productNo && !html) {
        const fetchRes = await quickFetch(url);
        html = typeof fetchRes === 'string' ? fetchRes : (fetchRes?.html || '');
    }

    if (html && !productNo) {
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2초 초고속 타임아웃

        const [resDetail, resSchedule] = await Promise.all([
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers, signal: controller.signal }).catch(() => null),
            fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers, signal: controller.signal }).catch(() => null)
        ]);
        clearTimeout(timeoutId);

        if (resDetail && resDetail.ok) dataDetail = await resDetail.json().catch(() => null);
        if (resSchedule && resSchedule.ok) dataSchedule = await resSchedule.json().catch(() => null);

        if (!dataDetail?.result) {
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), 1500);
            const resSimple = await fetch(`https://b2c-api.modetour.com/Package/GetProductSimpleDetail?productNo=${productNo}`, { headers, signal: controller2.signal }).catch(() => null);
            clearTimeout(timeoutId2);
            if (resSimple && resSimple.ok) dataDetail = await resSimple.json().catch(() => null);
        }
    } catch (e: any) {
        console.error('[Modetour Native] API Fetch Error:', e.message);
    }

    if (!dataDetail?.result && html) {
        const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
        const priceMatch = html.match(/([\d,]{4,10})\s*원/) || html.match(/sellingPrice["']?\s*:\s*["']?([\d,]+)/i);
        const durationMatch = html.match(/(\d+\s*박\s*\d+\s*일)/);
        const depDateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);

        if (titleMatch) {
            const rawTitle = titleMatch[1].replace(/- 모두투어.*/, '').trim();
            const pStr = priceMatch ? priceMatch[1].replace(/,/g, '') : '';
            const priceFormatted = pStr && parseInt(pStr, 10) > 10000 ? parseInt(pStr, 10).toLocaleString() + '원' : '';

            const fallbackResult: DetailedProductInfo = {
                title: rawTitle,
                destination: '해외',
                price: priceFormatted,
                departureDate: depDateMatch ? depDateMatch[1] : '',
                returnDate: '',
                duration: durationMatch ? durationMatch[1] : '',
                airline: '',
                departureAirport: '인천',
                url: url,
                keyPoints: [],
                features: [],
                courses: [],
                specialOffers: [],
                inclusions: [],
                exclusions: [],
                itinerary: [],
                hashtags: '',
                hasNoOption: false,
                hasFreeSchedule: false
            };
            return refineData(fallbackResult, html, url);
        }
    }

    if (dataDetail?.result || dataDetail?.productName) {
        const d = dataDetail.result || dataDetail;
        const scheduleRaw = dataSchedule?.result?.scheduleItemList || [];
        let deptAir: any = {}, returnAir: any = {};
        const deptRawItems: any[] = [];
        const returnRawItems: any[] = [];

        // 목적지 도시 집계 및 항공 데이터 전수 조사
        const citySet = new Set<string>();
        for (const s of scheduleRaw) {
            const air = s.listAirRouteInfo;
            if (air?.item?.length) {
                if (air.flightTypeName === "DEPARTURE") {
                    deptRawItems.push(...air.item);
                } else if (air.flightTypeName === "ARRIVAL") {
                    returnRawItems.push(...air.item);
                }
            }

            // 도시 정보 추출 (한국 출발지 공항/도시 및 기내/경유 단어 제외)
            const koreanExclusions = ['인천', '김포', '서울', '김해', '부산', '대구', '청주', '제주', '무안', '양양', '광주', '기내', '경유', '경유지'];
            if (Array.isArray(s.placeHeader)) {
                s.placeHeader.forEach((p: string) => {
                    const clean = p.trim();
                    if (clean && !koreanExclusions.includes(clean)) citySet.add(clean);
                });
            }
            if (s.cityName) {
                const cName = s.cityName.trim();
                if (cName && !koreanExclusions.includes(cName)) citySet.add(cName);
            }
            (s.ortherActions || []).forEach((t: any) => {
                if (t.cityName && !koreanExclusions.includes(t.cityName)) citySet.add(t.cityName);
            });
        }

        // Build segments globally
        const departureSegments = buildModetourSegments(deptRawItems);
        const returnSegments = buildModetourSegments(returnRawItems);

        // Construct deptAir
        if (departureSegments.length > 0) {
            const fSeg = departureSegments[0];
            const lSeg = departureSegments[departureSegments.length - 1];
            const airlines = Array.from(new Set(departureSegments.map(s => s.airline).filter(Boolean))).join(' / ');
            const flightNos = departureSegments.map(s => s.flightNo).filter(Boolean).join(' / ');
            const hasRealLayover = departureSegments.length > 1;

            deptAir = {
                transportName: hasRealLayover ? `${airlines} (경유)` : fSeg.airline,
                departureFlight: hasRealLayover ? flightNos : fSeg.flightNo,
                departureCityName: fSeg.departureCity,
                departureTime: fSeg.departureTime,
                arrivalCityName: lSeg.arrivalCity,
                arrivalTime: lSeg.arrivalTime,
                departureFlightDuration: hasRealLayover ? '' : fSeg.duration,
                segments: hasRealLayover ? departureSegments : [],
            };
        }

        // Construct returnAir
        if (returnSegments.length > 0) {
            const fSeg = returnSegments[0];
            const lSeg = returnSegments[returnSegments.length - 1];
            const airlines = Array.from(new Set(returnSegments.map(s => s.airline).filter(Boolean))).join(' / ');
            const flightNos = returnSegments.map(s => s.flightNo).filter(Boolean).join(' / ');
            const hasRealLayover = returnSegments.length > 1;

            returnAir = {
                transportName: hasRealLayover ? `${airlines} (경유)` : fSeg.airline,
                departureFlight: hasRealLayover ? flightNos : fSeg.flightNo,
                departureCityName: fSeg.departureCity,
                departureTime: fSeg.departureTime,
                arrivalCityName: lSeg.arrivalCity,
                arrivalTime: lSeg.arrivalTime,
                departureFlightDuration: hasRealLayover ? '' : fSeg.duration,
                segments: hasRealLayover ? returnSegments : [],
            };
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
                segments: deptAir.segments,
            } : (idx === scheduleRaw.length - 1 ? {
                flightNo: returnAir.departureFlight,
                airline: returnAir.transportName,
                departureCity: returnAir.departureCityName,
                departureTime: returnAir.departureTime,
                arrivalCity: returnAir.arrivalCityName,
                arrivalTime: returnAir.arrivalTime,
                duration: returnAir.departureFlightDuration,
                segments: returnAir.segments,
            } : null);

            return {
                day: idx + 1,
                date: day.itiDate || '',
                title: Array.isArray(day.placeHeader) ? day.placeHeader.join(' → ') : '',
                transport: trItems.length > 0 ? trItems.join(', ') : ((idx === 0 || idx === scheduleRaw.length - 1) ? '항공' : '-'),
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

        // 미팅 정보 및 이미지 자동 추출
        const meetingInfo: any[] = [];
        let meetingImgUrl = d.meetingPlaceImg || d.meetingPlaceImage || d.meetingMap || d.meetingFileUrl || d.meetingImg || d.meetingMapUrl || d.meetingImgUrl || d.meetingFile || null;

        if (d.meetingPlace2 || d.meetingPlace || d.meetingTime) {
            let rawLoc = d.meetingPlace2 || d.meetingPlace || '공항 미팅 장소';
            rawLoc = rawLoc.replace(/^일정표\s*참조\s*\/\s*/i, '').trim();

            if (meetingImgUrl && typeof meetingImgUrl === 'string') {
                if (meetingImgUrl.startsWith('//')) {
                    meetingImgUrl = `https:${meetingImgUrl}`;
                } else if (meetingImgUrl.startsWith('/')) {
                    meetingImgUrl = `https://img.modetour.com${meetingImgUrl}`;
                }
            }

            if (!meetingImgUrl) {
                const locText = (rawLoc || '').toLowerCase();
                if (locText.includes('제2여객터미널') || locText.includes('t2') || locText.includes('2터미널')) {
                    meetingImgUrl = 'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?q=80&w=1000&auto=format&fit=crop';
                } else {
                    // 모두투어 인천공항 1터미널 3층 14번 출구 (N카운터 옆) 약도
                    meetingImgUrl = 'https://img.modetour.com/tourinfo/meeting/icn_t1_mode.jpg';
                }
            }

            meetingInfo.push({
                type: '미팅안내',
                location: rawLoc,
                description: d.meetingDetail || '',
                time: d.meetingTime || '일정표 참조',
                imageUrl: meetingImgUrl
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
                let itemImg = meetingItem.imageUrl || meetingItem.imgUrl || meetingItem.fileUrl || meetingItem.photoUrl || null;
                const locStr = (meetingItem.itiPlaceName || '공항 미팅 장소').replace('[미팅안내]', '').trim();

                if (!itemImg) {
                    const locText = locStr.toLowerCase();
                    if (locText.includes('제2여객터미널') || locText.includes('t2') || locText.includes('2터미널')) {
                        itemImg = 'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?q=80&w=1000&auto=format&fit=crop';
                    } else if (locText.includes('인천') || locText.includes('공항') || locText.includes('터미널')) {
                        itemImg = 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=1000&auto=format&fit=crop';
                    }
                }

                meetingInfo.push({
                    type: '미팅안내',
                    location: locStr,
                    description: meetingItem.detailDes || meetingItem.itiSummaryDes || '',
                    time: '상세 일정 참고',
                    imageUrl: itemImg
                });
            }
        }

        const dayCount = scheduleRaw.length;
        let finalDuration = `${dayCount - 1}박 ${dayCount}일`;
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

        let rawPrice = String(d.sellingPriceAdultTotalAmount || d.sellingPrice || d.price || '').replace(/[^0-9]/g, '');
        let formattedPrice = rawPrice ? parseInt(rawPrice, 10).toLocaleString() + '원' : '';

        // 모두투어 개조식 상품 포인트 (HTML 앤티티 &nbsp; 및 약관글 전면 제거, 부족 시 일정 자동 채움)
        const cleanBullets: string[] = [];

        // 1. 원문 포인트 소스 수집
        const rawHtmlSource = [d.productPoint, d.promotionText, d.promotionNote, d.travelRecommendNote]
            .filter(Boolean)
            .join('\n');

        if (rawHtmlSource) {
            const parsedLines = parseHtml(rawHtmlSource);
            for (const line of parsedLines) {
                let clean = line
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
                    .replace(/^[#★♥■📍🏝🌊💅🍖🏨\s]+/, '')
                    .replace(/#/g, '')
                    .trim();

                // 쓸데없는 단어 및 약관/이동문구 제거
                if (clean.length >= 6 && clean.length <= 100) {
                    const isBoilerplate = clean.includes('5주전') || clean.includes('최종 인원') || clean.includes('경유국가') || clean.includes('베스트셀러') || clean.includes('공항세') || clean.includes('여행자 보험') || clean.includes('관세가 부과') || clean.includes('주차장 사전예약') || clean.includes('신청금');
                    if (!isBoilerplate && !cleanBullets.includes(clean)) {
                        cleanBullets.push(clean);
                    }
                }
            }
        }

        // 2. 만약 상품 포인트가 부족하면(3개 미만) 일정(Itinerary) 및 상품 정보에서 핵심 개조식 항목 자동 추가!
        if (cleanBullets.length < 4) {
            const recText = (d.travelRecommendNote || '') + (d.specificNote || '') + (d.productName || '');
            
            // 혜택/코스 옵션
            const parenMatch = d.productName ? d.productName.match(/\(([^)]+)\)/) : null;
            if (parenMatch) {
                const opt = parenMatch[1].trim();
                if (opt.includes('VS') || opt.includes('선택')) {
                    cleanBullets.push(`선택 일정 (${opt})`);
                }
            }

            const fullTitleAndTags = `${d.productName || ''} ${d.groupBriefKeyword || ''} ${d.keyword || ''}`;
            if (fullTitleAndTags.includes('온천') && !cleanBullets.some(p => p.includes('온천'))) {
                cleanBullets.push('전일정 온천 호텔 숙박 및 온천 일정 포함');
            }
            if (fullTitleAndTags.includes('마사지') && !cleanBullets.some(p => p.includes('마사지'))) {
                cleanBullets.push('여행의 피로를 풀어주는 전신 마사지 체험 포함');
            }
            if (fullTitleAndTags.includes('호핑') && !cleanBullets.some(p => p.includes('호핑'))) {
                cleanBullets.push(fullTitleAndTags.includes('해적') ? '나트랑의 푸른 바다 100% 즐기기! 해적 호핑투어 포함' : '나트랑 해양 호핑투어 포함');
            }
            if (fullTitleAndTags.includes('삼겹살') && !cleanBullets.some(p => p.includes('삼겹살'))) {
                cleanBullets.push('무제한 삼겹살 포함! 맛과 양 모두 잡은 식사 혜택');
            }
            if (d.freeScheduleName && d.freeScheduleName !== '없음' && !cleanBullets.some(p => p.includes('자유일정'))) {
                cleanBullets.push('자유여행과 패키지의 장점만 쏙쏙 담은 여유로운 자유일정 포함');
            }
        }

        const nativeResult: DetailedProductInfo = {
            title: d.productName || '',
            destination: aggregatedDest || (d.category2 ? `${d.category2}, ${d.category3 || ''}` : ''),
            price: formattedPrice,
            departureDate: d.departureDate || '',
            returnDate: d.arrivalDate || '',
            duration: finalDuration,
            airline: deptAir.transportName || d.transportName || '',
            departureFlightNumber: deptAir.departureFlight || '',
            returnFlightNumber: returnAir.departureFlight || returnAir.arrivalFlight || '',
            departureAirport: deptAir.departureCityName || '인천',
            departureTime: deptAir.departureTime || '',
            arrivalTime: deptAir.arrivalTime || '',
            returnDepartureTime: returnAir.departureTime || '',
            returnArrivalTime: returnAir.arrivalTime || '',
            departureSegments: deptAir.segments || [],
            returnSegments: returnAir.segments || [],
            url: url,
            itinerary: itinerary,
            meetingInfo: meetingInfo,
            inclusions: parseHtml(d.includedNote),
            exclusions: parseHtml(d.unincludedNote),
            keyPoints: Array.from(new Set(cleanBullets)).slice(0, 6),
            features: [],
            courses: [],
            specialOffers: [],
            hashtags: d.groupBriefKeyword || '',
            hasNoOption: false,
            hasFreeSchedule: d.freeScheduleName ? true : false
        };

        return refineData(nativeResult, html, url);
    }
    return null;
}

function parseHtml(h: string): string[] {
    if (!h) return [];
    // 1. <style>, <script>, <title> 태그와 그 내부 콘텐츠를 완전히 제거
    let clean = h.replace(/<(style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, '');
    // 2. 나머지 HTML 태그를 줄바꿈으로 치환하여 텍스트만 추출
    return clean.replace(/<[^>]+>/g, '\n')
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 2 && s.toLowerCase() !== 'untitled');
}

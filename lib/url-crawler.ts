
import * as iconv from 'iconv-lite';
import type { DetailedProductInfo } from '../types';
import { scrapeWithBrowser } from '@/lib/browser-crawler';

/**
 * URL 크롤링 및 상품 정보 파싱 (서버 사이드 전용)
 */

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function quickFetch(url: string, retries = 1): Promise<{ html: string; title: string }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000); // 4초 타임아웃으로 대폭 단축

        const response = await fetch(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';

        let html = '';
        // 1. 헤더에서 CHARSET 확인
        if (contentType.toLowerCase().includes('euc-kr')) {
            html = iconv.decode(Buffer.from(buffer), 'euc-kr');
        } else {
            // 2. 일단 UTF-8로 디코딩 후 메타 태그 재확인
            const tempText = new TextDecoder('utf-8').decode(buffer);
            if (tempText.includes('charset=euc-kr') || tempText.includes('charset=EUC-KR') || tempText.includes('CP949')) {
                html = iconv.decode(Buffer.from(buffer), 'euc-kr');
            } else {
                html = tempText;
            }
        }

        console.log(`[QuickFetch] Url: ${url}, Status: ${response.status}, Length: ${html.length}`);

        // 간단한 타이틀 추출
        let title = '';
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        return { html, title };

    } catch (error: any) {
        if (retries > 0) {
            console.log(`[QuickFetch] 재시도 (${retries}회 남음): ${url}`);
            await sleep(1000);
            return quickFetch(url, retries - 1);
        }
        console.warn(`[QuickFetch] 최종 실패: ${url} (${error.message})`);
        return { html: '', title: '' }; // 에러를 던지지 않고 빈 결과 반환
    }
}

async function fetchModeTourNative(url: string, isSummaryOnly = false): Promise<DetailedProductInfo | null> {
    const productNoMatch = url.match(/package\/(\d+)/i) || url.match(/Pnum=(\d+)/i);
    if (!productNoMatch) return null;
    const productNo = productNoMatch[1];

    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json'
    };

    let dataDetail: any = null;
    let dataPoints: any = null;
    let dataSchedule: any = null;
    let dataHotel: any = null;

    try {
        console.log(`[ModeTour Native] Fetching for ${productNo} (SummaryOnly=${isSummaryOnly})`);
        
        // 요약 모드일 때는 일정(Schedule) 목록을 가져오지 않음 (가장 큰 데이터)
        const fetchTasks = [
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetHotelList?productNo=${productNo}`, { headers })
        ];
        
        if (!isSummaryOnly) {
            fetchTasks.push(fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers }));
        }

        const responses = await Promise.all(fetchTasks);
        const resDetail = responses[0];
        const resPoints = responses[1];
        const resHotel = responses[2];
        const resSchedule = !isSummaryOnly ? responses[3] : null;

        if (resDetail.ok) {
            dataDetail = await resDetail.json();
        }
        if (resPoints.ok) dataPoints = await resPoints.json();
        if (resHotel.ok) dataHotel = await resHotel.json();
        if (resSchedule?.ok) {
            dataSchedule = await resSchedule.json();
            console.log(`[ModeTour Native] schedule result OK, len: ${dataSchedule?.result?.length || 0}`);
        }

        if (!dataDetail?.result) {
            const resSimple = await fetch(`https://b2c-api.modetour.com/Package/GetProductSimpleDetail?productNo=${productNo}`, { headers });
            if (resSimple.ok) dataDetail = await resSimple.json();
        }
    } catch (e: any) {
        console.warn(`[ModeTour Native] Fetch error: ${e.message}`);
    }

    if (dataDetail?.isOK && dataDetail.result) {
        const d = dataDetail.result;
        console.log(`[ModeTour Native] Processing: ${d.productName || d.prd_nm}`);
        console.log(`[ModeTour Native-DEBUG] d keys: ${Object.keys(d).join(', ')}`);
        console.log(`[ModeTour Native-DEBUG] transport: ${d.transportName}, carrier: ${d.carrier_nm}, fltNo: ${d.flight_no}`);

        // 1. Title 정제
        let cleanTitle = d.productName || '';
        cleanTitle = cleanTitle.replace(/\[출발확정\]/g, '').trim();

        // 2. Region 정제
        const mainRegion = d.category2 || '';
        const cities = d.visitCities && d.visitCities.length > 0 ? d.visitCities.join('/') : (d.category3 || '');
        const destination = mainRegion ? `${mainRegion}, ${cities}` : cities;

        // 3. Duration 보정
        let duration = d.travelPeriod || '';
        if (/^\d+일$/.test(duration)) {
            const days = parseInt(duration);
            if (days > 1) duration = `${days - 1}박${duration}`;
        }

        // --- 4. 상품 포인트 추출 (서술형 혜택 문장) ---
        let keyPoints: string[] = [];

        // 4.1. GetProductKeyPointInfo에서 specialBenefits/sightseeings 우선 추출 (가장 고품질)
        if (dataPoints?.isOK && dataPoints.result) {
            const r = dataPoints.result;
            const tabSections = [r.specialBenefits, r.sightseeings, r.hotels, r.meals].filter(Boolean);
            for (const section of tabSections) {
                if (Array.isArray(section)) {
                    for (const item of section) {
                        if (keyPoints.length >= 7) break;
                        const title = (item.title || item.name || '').replace(/\[특전\]/g, '').trim();
                        if (title.length > 3 && !keyPoints.includes(title)) {
                            keyPoints.push(title);
                        }
                    }
                }
            }
        }

        // travelRecommendNote 등 상세 정보
        const moreInfoText = [
            d.travelRecommendNote,
            d.specialEventNote,
            d.generalBonusNote,
        ].filter(Boolean).join('\n\n');

        // 4.2. [특전] 태그가 있는 라인 또는 타이틀 추출
        if (moreInfoText) {
            const rawText = moreInfoText.replace(/<[^>]+>/g, '');
            
            const specialLines = rawText.split('\n')
                .filter((l: string) => l.includes('[특전]') || l.includes('【특전】'))
                .map((l: string) => l.replace(/\[특전\]|【특전】/g, '').replace(/^[\s■\*\-]+/, '').trim())
                .filter((l: string) => {
                    if (l.length < 5 || l.length > 60) return false;
                    if (l.includes('대상자') || l.includes('유효기간') || l.includes('여권') || l.includes('등록 필요')) return false;
                    if (l.includes('입국 카드') || l.includes('MDAC') || l.includes('비자') || l.includes('보험')) return false;
                    if (l.includes('방문하는 모든') || l.includes('이내 등록')) return false;
                    if (l.includes('불포함') || l.includes('포함 사항')) return false;
                    return true;
                });
            
            specialLines.forEach(l => {
                if (keyPoints.length < 7 && !keyPoints.includes(l)) keyPoints.push(l);
            });

            // 4.3. ■섹션■ 구분을 파싱하여 관광/숙박/식사 핵심 추출
            const sections = rawText.split(/■[^■]+■/);
            const sectionHeaders = rawText.match(/■([^■]+)■/g) || [];
            
            for (let i = 0; i < sectionHeaders.length && keyPoints.length < 7; i++) {
                const header = sectionHeaders[i].replace(/■/g, '').trim();
                const content = sections[i + 1] || '';
                if (header.includes('관광') || header.includes('관광지')) {
                    const places = content.split('\n').map((l: string) => l.replace(/^[\s\*\-\d\.]+/, '').trim()).filter((l: string) => l.length > 3 && !l.startsWith('#'));
                    if (places.length > 0) {
                        const placeNames = places.slice(0, 3).map((p: string) => p.split(/[:：]/)[0].trim()).filter((p: string) => p.length > 2 && p.length < 15);
                        if (placeNames.length > 0 && !keyPoints.some(kp => kp.includes('명소'))) {
                            keyPoints.push(`${placeNames.join(', ')} 등 주요 명소 방문`);
                        }
                    }
                } else if (header.includes('숙박') && !keyPoints.some(kp => kp.includes('호텔') || kp.includes('숙박'))) {
                    const hotelLines = content.split('\n').map((l: string) => l.replace(/^[\s\*\-]+/, '').trim()).filter((l: string) => l.length > 5);
                    if (hotelLines.length > 0) {
                        let h = hotelLines[0];
                        if (h.includes('특급') || h.includes('5성')) h = '특급호텔에서 전일정 편안한 숙박';
                        else if (h.includes('리조트')) h = '리조트 숙박';
                        else if (h.includes('월드체인')) h = '월드체인 호텔 숙박';
                        else if (h.length > 25) h = h.substring(0, 25).trim() + ' 숙박';
                        if (h.length > 3) keyPoints.push(h);
                    }
                } else if (header.includes('식사') && !keyPoints.some(kp => kp.includes('식사') || kp.includes('석식'))) {
                    const mealLines = content.split('\n').map((l: string) => l.replace(/^[\s\*\-]+/, '').trim()).filter((l: string) => l.length > 3 && !l.startsWith('#'));
                    if (mealLines.some((m: string) => m.includes('무제한'))) keyPoints.push('호텔 식사 및 음료 무제한 제공');
                    else if (mealLines.length > 0) keyPoints.push(`식사 ${mealLines.length}회 포함`);
                }
            }
            
            // 4.4. 섹션 구분이 없는 경우 일반 라인에서 추출 (garbage fallback)
            if (keyPoints.length < 3) {
                const lines = rawText.split('\n')
                    .map((l: string) => l.replace(/^[\s■\*\-\d\.]+/, '').replace(/■+$/g, '').trim())
                    .filter((l: string) => {
                        if (l.length < 5 || l.length > 50) return false;
                        const cl = l.replace(/■/g, '').trim();
                        if (!cl || cl.startsWith('#')) return false;
                        if (/^(스페셜혜택|관광|숙박|식사|차량|기타|특전|혜택)\s*$/i.test(cl)) return false;
                        if (cl.includes('행사 인원') || cl.includes('인솔자 배정')) return false;
                        if (cl.includes('대상자') || cl.includes('유효기간') || cl.includes('여권') || cl.includes('등록 필요')) return false;
                        if (cl.includes('입국 카드') || l.includes('MDAC') || l.includes('비자') || l.includes('보험')) return false;
                        if (cl.includes('방문하는 모든') || l.includes('이내 등록')) return false;
                        // 노출 금지 단어 추가 (마케팅 문구 방지)
                        if (cl.includes('타사비교') || cl.includes('원하시나') || cl.includes('약속 드립니') || cl.includes('일생에 단 한')) return false;
                        return true;
                    });
                for (const line of lines) {
                    if (keyPoints.length >= 7) break;
                    if (line.includes(':') || line.includes('：')) {
                        const [place] = line.split(/[:：]/);
                        if (place.trim().length > 2 && place.trim().length < 20) {
                            if (!keyPoints.includes(`${place.trim()} 관광`)) keyPoints.push(`${place.trim()} 관광`);
                        }
                    } else {
                        let desc = line;
                        if (/온천호텔\d+박/.test(desc)) desc = '전 일정 온천호텔 숙박';
                        else if (/호텔석식\d+회/.test(desc)) desc = `호텔 석식 ${desc.match(/\d+/)?.[0] || ''}회 제공`;
                        else if (/현지식\d+회/.test(desc)) desc = `현지 특식 ${desc.match(/\d+/)?.[0] || ''}회 포함`;
                        
                        const cleaned = desc.replace(/\s+/g, ' ').trim();
                        if (!keyPoints.includes(cleaned)) keyPoints.push(cleaned);
                    }
                }
            }
        }

        // 4.5. 타이틀 괄호 안 키워드 → 서술형 보충 (기존 포인트가 부족할 때)
        if (cleanTitle.includes('(') && keyPoints.length < 4) {
            const inner = cleanTitle.substring(cleanTitle.lastIndexOf('(') + 1, cleanTitle.lastIndexOf(')'));
            const parts = inner.split(/[+\n,]/).filter((s: string) => s.trim().length > 1);
            for (const p of parts) {
                if (keyPoints.length >= 7) break;
                const pt = p.trim();
                if (pt.includes('온천호텔') && !keyPoints.some(kp => kp.includes('온천'))) keyPoints.push('전 일정 온천호텔 숙박');
                else if (pt.includes('석식') && pt.includes('무제한') && !keyPoints.some(kp => kp.includes('무제한'))) keyPoints.push('호텔 석식 및 음료 무제한 제공');
                else if (pt.includes('석식') && !keyPoints.some(kp => kp.includes('석식'))) keyPoints.push('호텔 석식 포함');
                else if (pt.includes('무제한') && !keyPoints.some(kp => kp.includes('무제한'))) keyPoints.push('술/음료 무제한 제공');
            }
        }

        // 4.6. 상품 속성 자동 추가
        if (d.isConfirmed || cleanTitle.includes('출발확정') || cleanTitle.includes('[출발확정]')) {
            keyPoints.unshift('출발 확정 상품');
        }
        if (d.isNoShopping || cleanTitle.includes('노쇼핑') || moreInfoText.includes('노쇼핑')) {
            keyPoints.push('노쇼핑 일정으로 편안한 여행');
        }
        if (d.isNoOption || cleanTitle.includes('노옵션') || moreInfoText.includes('노옵션')) {
            keyPoints.push('노옵션 자유로운 일정');
        }


        // (호텔 포인트는 hotelInfo 정의 후 추가 - 아래 참조)

        // travelRecommendNote 등 상세 정보를 description으로 전달 (Gemini 요약용)
        const moreInfo = [
            d.travelRecommendNote,
            d.specialEventNote,
            d.generalBonusNote,
            d.groupBriefKeyword
        ].filter(Boolean).join('\n\n');

        // --- 5. 일정(Itinerary) 매핑 ---
        let itinerary: any[] = [];
        if (dataSchedule?.isOK && dataSchedule.result?.scheduleItemList) {
            const scheduleDays = dataSchedule.result.scheduleItemList;
            
            itinerary = scheduleDays.map((dayData: any, idx: number) => {
                const dayNum = idx + 1;
                let activities: string[] = [];

                // 1. 항공편 정보 (itiSeq가 없는 경우가 많으므로 최상단에 추가)
                const airListVal = Array.isArray(dayData.listAirRouteInfo) ? dayData.listAirRouteInfo : dayData.listAirRouteInfo?.item;
                const airList: any[] = Array.isArray(airListVal) ? airListVal : [];
                
                let transport: any = null;
                if (airList.length > 0) {
                    // 세그먼트가 나눠져 있는 경우를 대비해 데이터를 병합
                    const merged = {
                        airline: airList.find(f => f.transportName)?.transportName || '',
                        logoUrl: airList.find(f => f.transportLogoUrl)?.transportLogoUrl || '',
                        departureCity: airList.find(f => f.departureCityName)?.departureCityName || airList.find(f => f.departureCity)?.departureCity || '',
                        departureTime: airList.find(f => f.departureTime)?.departureTime || '',
                        arrivalCity: airList.find(f => f.arrivalCityName)?.arrivalCityName || airList.find(f => f.arrivalCity)?.arrivalCity || '',
                        arrivalTime: airList.find(f => f.arrivalTime)?.arrivalTime || '',
                        duration: airList.find(f => f.departureFlightDuration)?.departureFlightDuration || '',
                        flightNo: airList.find(f => f.departureFlight)?.departureFlight || ''
                    };
                    
                    if (merged.departureCity || merged.arrivalCity) {
                        transport = merged;
                    }
                }

                // 2. 모든 카테고리별 일정 항목 수집 및 정렬
                const allItems: any[] = [];
                const listKeys = [
                    'listItemSchedule', 'listScheduleItem', 'ortherActions', 
                    'listLocalPlace', 'listGuidePlace', 'listHotelPlace', 
                    'listTransportPlace', 'listMealPlace'
                ];
                
                listKeys.forEach(key => {
                    const val = dayData[key];
                    if (Array.isArray(val)) {
                        allItems.push(...val);
                    } else if (val && Array.isArray(val.item)) {
                        allItems.push(...val.item);
                    }
                });

                // itiSeq 순으로 정렬
                allItems.sort((a, b) => (a.itiSeq || 0) - (b.itiSeq || 0));

                const EXCLUDE_LABELS = [
                    '기타단문', '관광(콘텐츠)', '유의 ㅣ 안내사항', 
                    '중국 입국 유의사항/ 온라인 입국신고서 작성 안내사항',
                    '호텔 체크인/체크아웃 안내', '선택 관광 (콘텐츠)',
                    '현지 합류(합사) 행사 안내', 'null', 'undefined'
                ];

                const isNullStr = (s: any) => !s || s === 'null' || s === 'undefined' || String(s).trim() === '';

                // 3. 정렬된 항목들을 텍스트로 변환
                allItems.forEach((item: any) => {
                    let loc = item.itiPlaceName || item.itiServiceName || '';
                    if (EXCLUDE_LABELS.some(l => loc.includes(l)) || isNullStr(loc)) loc = '';

                    const descParts: string[] = [];
                    
                    if (!isNullStr(item.itiSummaryDes)) descParts.push(item.itiSummaryDes);
                    if (!isNullStr(item.itiDetailDes)) descParts.push(item.itiDetailDes.replace(/<[^>]+>/g, '').trim());
                    
                    const optVal = item.scheduleItemServiceOptions;
                    const optList = Array.isArray(optVal) ? optVal : optVal?.item;
                    if (Array.isArray(optList)) {
                        optList.forEach((opt: any) => {
                            const optName = opt.itiServiceName || '';
                            if (!isNullStr(opt.serviceWITHSummary)) descParts.push(opt.serviceWITHSummary.replace(/<[^>]+>/g, '').trim());
                            else if (!isNullStr(opt.serviceExplaination)) descParts.push(opt.serviceExplaination.replace(/<[^>]+>/g, '').trim());
                            if (!isNullStr(opt.detailDes)) descParts.push(opt.detailDes.replace(/<[^>]+>/g, '').trim());
                            
                            if (optName && !loc.includes(optName) && !EXCLUDE_LABELS.some(l => optName.includes(l)) && !isNullStr(optName)) {
                                descParts.unshift(optName);
                            }
                        });
                    }

                    if (!isNullStr(item.serviceWITHSummary) && !descParts.includes(item.serviceWITHSummary)) descParts.push(item.serviceWITHSummary);
                    if (!isNullStr(item.serviceExplaination) && !descParts.includes(item.serviceExplaination)) descParts.push(item.serviceExplaination);

                    // 각 파트에서 EXCLUDE_LABELS 제거 및 개별 줄 단위 중복 제거
                    const processedParts: string[] = [];
                    descParts.forEach(part => {
                        if (isNullStr(part)) return;
                        const lines = part.split(/\n|\r\n/).map(l => l.trim()).filter(l => !isNullStr(l));
                        lines.forEach(line => {
                            if (EXCLUDE_LABELS.some(l => line === l)) return;

                            // 접두어 제거 시도 (예: "유의 ㅣ 안내사항 - " 제거)
                            let cleanLine = line;
                            EXCLUDE_LABELS.forEach(label => {
                                const regex = new RegExp(`^${label}\\s*[-ㅣ\\s]*[-ㅣ]\\s*`, 'g'); // 공백/기호 유연하게 처리
                                cleanLine = cleanLine.replace(regex, '').trim();
                            });
                            
                            if (isNullStr(cleanLine) || EXCLUDE_LABELS.includes(cleanLine)) return;
                            if (cleanLine === '.' || cleanLine === '-') return;
                            processedParts.push(cleanLine);
                        });
                    });

                    const fullDesc = processedParts
                        .filter((s, i, a) => a.indexOf(s) === i) // 중복 제거
                        .join('\n');
                    
                    if (loc || fullDesc) {
                        let block = loc;
                        if (loc && fullDesc) {
                            if (!fullDesc.includes(loc)) block += '\n' + fullDesc;
                            else block = fullDesc;
                        } else if (fullDesc) {
                            block = fullDesc;
                        }
                        
                        // 다시 한번 최종적으로 접두어 제거 (loc가 붙은 경우 대비)
                        let finalBlock = block.trim();
                        EXCLUDE_LABELS.forEach(label => {
                            const regex = new RegExp(`^${label}\\s*[-ㅣ\\s]*[-ㅣ]\\s*`, 'g');
                            finalBlock = finalBlock.replace(regex, '').trim();
                        });

                        if (finalBlock && !activities.includes(finalBlock)) {
                            activities.push(finalBlock);
                        }
                    }
                });

                const mealsObj = dayData.listMealPlace;
                const mealList: any[] = Array.isArray(mealsObj) ? mealsObj : mealsObj?.item || [];

                const getMeal = (type: string) => {
                    const m = mealList.find((item: any) => item.itiServiceName === type || item.mealTypeName === type);
                    const val = m ? (m.itiPlaceName || m.itiSummaryDes || '제공') : '불포함';
                    return isNullStr(val) ? '불포함' : val;
                };

                return {
                    day: `${dayNum}일차`,
                    date: dayData.date || '',
                    title: dayData.allPlaceTravelToday || '',
                    activities: activities.filter((s, i, a) => a.indexOf(s) === i), 
                    transport: transport,
                    meals: {
                        breakfast: getMeal('조식'),
                        lunch: getMeal('중식'),
                        dinner: getMeal('석식')
                    },
                    hotel: dayData.scheduleHotel || ''
                };
            });
        }

        // --- 6. 호텔(Hotel) 정보 매핑 ---
        let hotelInfo = '';
        let hotels: any[] = [];
        if (dataHotel?.isOK && Array.isArray(dataHotel.result)) {
            const uniqueHotels = new Map<string, any>();
            dataHotel.result.forEach((dayHotel: any) => {
                if (Array.isArray(dayHotel.listHotelPlaceData)) {
                    dayHotel.listHotelPlaceData.forEach((h: any) => {
                        const name = h.placeNameK || h.itiPlaceName;
                        if (name && !uniqueHotels.has(name)) {
                            const hotelObj = {
                                name: name,
                                address: h.address || '',
                                checkIn: '14:00',
                                checkOut: '12:00',
                                images: h.itiPlaceImg ? [h.itiPlaceImg] : [],
                                amenities: []
                            };
                            uniqueHotels.set(name, hotelObj);
                            hotels.push(hotelObj);
                        }
                    });
                }
            });
            if (hotels.length > 0) {
                hotelInfo = hotels[0].name + (hotels[0].address ? ` (${hotels[0].address})` : '');
            }
        }

        // 4.4. 호텔 정보에서 포인트 추출 (hotelInfo가 정의된 후)
        if (hotelInfo && !keyPoints.some(kp => kp.includes('호텔') || kp.includes('숙박'))) {
            const hotelName = hotelInfo.split('(')[0].trim();
            if (hotelName.length > 3) {
                keyPoints.push(`${hotelName} 숙박`);
            }
        }

        // --- 7. 미팅 및 수속 정보 추출 ---
        let meetingInfo: any[] = [];
        const meetingText = d.entryPointNote || '';
        if (meetingText) {
            const cleanMeeting = meetingText.replace(/<[^>]+>/g, ' ').trim();
            meetingInfo.push({
                type: '미팅정보',
                location: '본문 참조',
                time: '본문 참조',
                description: cleanMeeting
            });
        }

        // 중복 제거 및 최대 7개 제한 (refineData에서 4개로 최종 자르기)
        // 4.6. 최종 문장 정제 및 해시태그 보충
        keyPoints = keyPoints.map(p => 
            p.trim()
             .replace(/^["'\[【]+|["'\]】]+$/g, '')
             .replace(/^[\s■\*\-]+/, '')
             .replace(/[\.\!\?]+$/g, '')
             .replace(/\s*입니다$/, '')
             .replace(/다$/, '')
             .trim()
        ).filter(p => p.length > 5);

        // 포인트가 부족하면 해시태그에서 보충
        if (keyPoints.length < 4 && d.groupBriefKeyword) {
            const tags = d.groupBriefKeyword.split('#')
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 1 && s.length < 15);
            for (const tag of tags) {
                if (keyPoints.length >= 4) break;
                if (!keyPoints.some(kp => kp.includes(tag))) {
                    const tagPoint = tag.includes('관광') || tag.includes('투어') ? `${tag} 포함` : `${tag} 관광`;
                    keyPoints.push(tagPoint);
                }
            }
        }

        keyPoints = Array.from(new Set(keyPoints)).slice(0, 4);

        const rawPrice = String(d.sellingPriceAdultTotalAmount || '');
        const formattedPrice = rawPrice.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        const finalRet = {
            isProduct: true,
            title: cleanTitle,
            destination: destination,
            price: formattedPrice,
            departureDate: d.departureDate || d.start_dt || d.departure_dt || '',
            returnDate: d.arrivalDate || d.end_dt || d.arrival_dt || '',
            departureAirport: d.departureCityName || d.departureCity || '인천',
            airline: d.transportName || d.carrier_nm || '',
            duration: duration,
            flightCode: d.transportInfo || d.flight_no || d.carrier_no || '',
            departureTime: d.startTime || d.depTm || d.dep_tm || d.strTm || d.str_tm || '',
            arrivalTime: d.endTime || d.arrTm || d.arr_tm || d.endTm || d.end_tm || '',
            returnDepartureTime: d.returnStartTime || d.returnDepTm || d.return_dep_tm || '',
            returnArrivalTime: d.returnEndTime || d.returnArrTm || d.return_arr_tm || '',
            hotel: hotelInfo,
            hotels: hotels,
            meetingInfo: meetingInfo,
            itinerary: itinerary,
            inclusions: d.includedNote ? [d.includedNote.replace(/<[^>]+>/g, ' ').trim()] : [],
            exclusions: d.unincludedNote ? [d.unincludedNote.replace(/<[^>]+>/g, ' ').trim()] : [],
            url: url,
            features: [],
            courses: [],
            specialOffers: [],
            keyPoints: keyPoints,
            hashtags: '',
            hasNoOption: false,
            hasFreeSchedule: false,
            description: moreInfo // 추가: Gemini 요약용 상세 정보
        } as DetailedProductInfo;
        console.log(`[ModeTour Native] Final Return Airline: ${finalRet.airline}, Airport: ${finalRet.departureAirport}, Days: ${finalRet.itinerary?.length || 0}`);
        return finalRet;
    }
    return null;
}

export async function fetchContent(url: string, isSummaryOnly = false): Promise<{ text: string, nextData?: string, nativeData?: any }> {
    try {
        console.log(`[Crawler] Fetching: ${url} (isSummaryOnly=${isSummaryOnly})`);

        // ModeTour인 경우 네이티브 직접 요청 시도
        if (url.includes('modetour.com')) {
            const nativeData = await fetchModeTourNative(url, isSummaryOnly);
            if (nativeData) {
                console.log('[Crawler] ModeTour Native Data Acquired');
                // 요약 모드면 HTML 추가 획득 패스
                if (isSummaryOnly) {
                    return { text: '', nativeData };
                }
                const { html } = await quickFetch(url);
                const text = htmlToText(html, url);
                const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
                const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;
                console.log(`[Crawler] Native Flow: Text Len: ${text.length}, NextData Len: ${nextData?.length || 0}`);
                return { text, nextData, nativeData };
            }
        }

        // 1. 빠른 fetch 시도
        const { html } = await quickFetch(url);

        // 2. HTML을 텍스트로 변환 (메타데이터 포함)
        const text = htmlToText(html, url);
        console.log(`[Crawler] QuickFetch Flow: Text Len: ${text.length}`);

        // HTML 원본에서 __NEXT_DATA__ 추출 (이미 htmlToText에서 썼을 수도 있지만 명시적으로 추출)
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;
        console.log(`[Crawler] QuickFetch Flow: NextData Len: ${nextData?.length || 0}`);

        if (text.length > 500 || html.length > 5000) {
            return { text, nextData };
        }

        throw new Error('Content too short');

    } catch (error) {
        console.error(`[Crawler] Error:`, error);
        throw error;
    }
}

export function htmlToText(html: string, url: string): string {
    // 메타데이터 추출
    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) pageTitle = titleMatch[1].trim();

    let ogTitle = '';
    const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["'](.*?)["']\s*\/?>/i);
    if (ogMatch) ogTitle = ogMatch[1].trim();

    let bodyTitle = '';
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const h4Match = html.match(/<h4[^>]*>(.*?)<\/h4>/i);
    if (h4Match) bodyTitle = h4Match[1].replace(/<[^>]+>/g, '').trim();
    else if (h1Match) bodyTitle = h1Match[1].replace(/<[^>]+>/g, '').trim();

    let classTitle = '';
    const classMatch = html.match(/<(?:div|strong|h[1-6]|span|p)[^>]*class=["'](?:[^"']*?\s)?(?:tit|title|product_tit|goods_name|gd_name|prd_nm)(?:\s[^"']*?)?["'][^>]*>(.*?)<\/(?:div|strong|h[1-6]|span|p)>/i);
    if (classMatch) classTitle = classMatch[1].replace(/<[^>]+>/g, '').trim();

    let targetTitle = '';
    const jsonTitleMatch = html.match(/["'](?:GoodsName|PrdName|prd_nm|title|goods_name)["']\s*:\s*["'](.*?)["']/i);
    if (jsonTitleMatch) targetTitle = jsonTitleMatch[1].trim();

    let targetPrice = '';
    // productPrice_Adult_TotalAmount, productPrice_Adult, SalePrice, GoodsPrice 등 다양한 키 대응
    const jsonPriceMatch = html.match(/["'](?:Price|SalePrice|goodsPrice|GoodsPrice|ProductPrice_Adult|Price_Adult|productPrice_Adult_TotalAmount|price_adult)["']\s*[:=]\s*["']?(\d+)["']?/i);
    if (jsonPriceMatch) targetPrice = jsonPriceMatch[1];

    // [추가] 텍스트 내 가격 패턴 (예: 1,290,000원) - JSON 실패 시 대비
    if (!targetPrice) {
        const textPriceMatch = html.match(/[\s>]([0-9]{1,3}(?:,[0-9]{3})+)원/);
        if (textPriceMatch) targetPrice = textPriceMatch[1].replace(/,/g, '');
    }

    let targetDuration = '';
    const durationMatch = html.match(/(\d+)\s*박\s*(\d+)\s*일/);
    if (durationMatch) {
        targetDuration = `${durationMatch[1]}박${durationMatch[2]}일`;
    } else {
        // [보완] "X일" 패턴만 있는 경우 (3일 -> 2박3일 추정)
        const onlyDayMatch = html.match(/[\s>]([1-9])\s*일[\s<]/);
        if (onlyDayMatch) {
            const days = parseInt(onlyDayMatch[1], 10);
            targetDuration = `${days - 1}박${days}일`;
        }
    }

    let targetAirline = '';
    let targetDepartureAirport = '';
    let targetDepartureDate = '';
    let targetDescription = '';

    // [강력 보완] NEXT_DATA (ModeTour 등 SPA 프레임워크 렌더링 데이터) 직접 파싱
    const startIdx = html.indexOf('<script id="__NEXT_DATA__"');
    if (startIdx !== -1) {
        const jsonStart = html.indexOf('>', startIdx) + 1;
        const jsonEnd = html.indexOf('</script>', jsonStart);
        if (jsonStart !== 0 && jsonEnd !== -1) {
            try {
                const nextDataStr = html.substring(jsonStart, jsonEnd);
                const nextDataObj = JSON.parse(nextDataStr);

                const urlProductNoMatch = url.match(/package\/(\d+)/i) || url.match(/goodsNo=(\d+)/i) || url.match(/Pnum=(\d+)/i);
                const targetProductNo = urlProductNoMatch ? urlProductNoMatch[1] : '';

                // 동적 재귀 탐색 (API 응답구조가 브라우저/서버에 따라 달라지는 것에 대응)
                const extractVal = (obj: any, key: string, targetId?: string): any => {
                    if (!obj || typeof obj !== 'object') return null;

                    // 1. 만약 특정 ID를 찾는 중이라면, 해당 노드가 그 ID를 직접 가졌는지 확인
                    const currentId = obj.productNo || obj.goodsNo || obj.prd_nm_no || obj.itemNo || obj.goods_no || obj.pnum || obj.Pnum || obj.groupNumber;

                    // 만약 이 객체가 다른 상품의 정보를 담고 있다면 건너뜀 (매칭 필터링)
                    if (targetId && currentId && String(currentId) !== targetId) return null;

                    // 현재 객체에서 키를 찾음
                    if (key in obj && obj[key] !== null && obj[key] !== undefined && typeof obj[key] !== 'object') {
                        return obj[key];
                    }

                    let highestVal: any = null;
                    for (const k in obj) {
                        const res = extractVal(obj[k], key, targetId);
                        if (res !== null && res !== undefined) {
                            if (key.toLowerCase().includes('price') || key.toLowerCase().includes('amount')) {
                                const numRes = parseInt(String(res).replace(/[^0-9]/g, ''), 10);
                                const numHighest = highestVal ? parseInt(String(highestVal).replace(/[^0-9]/g, ''), 10) : 0;
                                if (numRes > numHighest) highestVal = res;
                            } else {
                                return res;
                            }
                        }
                    }
                    return highestVal;
                };

                // [강력 보완] ID 기반 추출 시도 후 실패 시 ID 없이 전역 시도 (백업)
                const extractValRobust = (obj: any, key: string, targetId?: string): any => {
                    let res = extractVal(obj, key, targetId);
                    if (!res && targetId) {
                        // ID 매칭 없이 전체 트리에서 첫 번째로 발견되는 유효값 추출
                        res = extractVal(obj, key);
                    }
                    return res;
                };

                const nextPrice = extractValRobust(nextDataObj, 'sellingPriceAdultTotalAmount', targetProductNo)
                    || extractValRobust(nextDataObj, 'productPrice_Adult', targetProductNo)
                    || extractValRobust(nextDataObj, 'salePrice', targetProductNo)
                    || extractValRobust(nextDataObj, 'sellingPrice', targetProductNo)
                    || extractValRobust(nextDataObj, 'price', targetProductNo)
                    || extractValRobust(nextDataObj, 'totalAmount', targetProductNo)
                    || extractValRobust(nextDataObj, 'adultPrice', targetProductNo);

                if (nextPrice) targetPrice = String(nextPrice).replace(/[^0-9]/g, '');

                const nextAirline = extractValRobust(nextDataObj, 'transportName', targetProductNo)
                    || extractValRobust(nextDataObj, 'airlineName', targetProductNo)
                    || extractValRobust(nextDataObj, 'airLineName', targetProductNo)
                    || extractValRobust(nextDataObj, 'airline_nm', targetProductNo)
                    || extractValRobust(nextDataObj, 'carrierNm', targetProductNo)
                    || extractValRobust(nextDataObj, 'airline', targetProductNo);
                if (nextAirline) targetAirline = String(nextAirline);

                const nextAirport = extractValRobust(nextDataObj, 'departureAirportName', targetProductNo)
                    || extractValRobust(nextDataObj, 'dep_airport_nm', targetProductNo)
                    || extractValRobust(nextDataObj, 'start_city_nm', targetProductNo)
                    || extractValRobust(nextDataObj, 'depCityName', targetProductNo);
                if (nextAirport) targetDepartureAirport = String(nextAirport);

                const nextDuration = extractValRobust(nextDataObj, 'duration', targetProductNo)
                    || extractValRobust(nextDataObj, 'itinerary_period', targetProductNo)
                    || extractValRobust(nextDataObj, 'travelPeriod', targetProductNo);
                if (nextDuration) targetDuration = String(nextDuration);

                const nextDepDate = extractValRobust(nextDataObj, 'departureDate', targetProductNo)
                    || extractValRobust(nextDataObj, 'startDate', targetProductNo)
                    || extractValRobust(nextDataObj, 'start_date', targetProductNo);
                if (nextDepDate) targetDepartureDate = String(nextDepDate);

                const nextTitle = extractValRobust(nextDataObj, 'goodsName', targetProductNo)
                    || extractValRobust(nextDataObj, 'productName', targetProductNo)
                    || extractValRobust(nextDataObj, 'title', targetProductNo);
                if (nextTitle) targetTitle = String(nextTitle);
                
                const nextDesc = extractValRobust(nextDataObj, 'travelRecommendNote', targetProductNo)
                    || extractValRobust(nextDataObj, 'description', targetProductNo)
                    || extractValRobust(nextDataObj, 'moreInfo', targetProductNo);
                if (nextDesc) targetDescription = String(nextDesc);

            } catch (e) {
                console.error('[Crawler] __NEXT_DATA__ 파싱 오류:', e);
            }
        }
    }

    // [추가] JS 렌더링 후 DOM 가시 텍스트에서 직접 추출 (한국어 패턴) 최우선 적용
    // Script/style 제거한 텍스트에서 검색 (고객 노출 가격/항공사가 가장 정확함)
    const visibleText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');

    // 성인 가격 패턴: "성인 799,000원" 또는 "799,000 원" 등
    const visiblePriceMatch = visibleText.match(/(\d{1,3}(?:,\d{3})+)\s*원/);
    if (visiblePriceMatch) {
        const parsedVisiblePrice = visiblePriceMatch[1].replace(/,/g, '');
        // 기본 JSON에서 추출한 가격이 너무 작거나(ex: 유류할증료 28800), 가시적 텍스트 가격이 더 현실적이면 덮어씌움
        if (!targetPrice || targetPrice === '0' || parseInt(parsedVisiblePrice, 10) > parseInt(targetPrice, 10)) {
            targetPrice = parsedVisiblePrice;
            console.log(`[Crawler] 가시 텍스트에서 가격 추출 (덮어쓰기): ${targetPrice}`);
        }
    }

    // 항공사와 출발 공항도 __NEXT_DATA__ 추출 실패 시 덮어쓰기
    if (!targetAirline) {
        const visibleAirlineMatch = visibleText.match(/(제주항공|대한항공|아시아나항공|아시아나|진에어|티웨이항공|티웨이|이스타항공|이스타|에어서울|에어부산|에어프레미아|피치항공|스쿠트|비엣젯|필리핀항공|싱가포르항공|타이항공|ANA|JAL)/);
        if (visibleAirlineMatch) {
            targetAirline = visibleAirlineMatch[1];
            console.log(`[Crawler] 가시 텍스트에서 항공사 추출: ${targetAirline}`);
        }
    }
    if (!targetDepartureAirport) {
        // 출발지 패턴: "인천출발", "인천 출발", "인천공항" 등
        const visibleAirportMatch = visibleText.match(/(인천|김포|부산|대구|청주|광주|제주|무안)\s*(?:출발|공항|국제공항)/);
        if (visibleAirportMatch) {
            targetDepartureAirport = visibleAirportMatch[1];
            console.log(`[Crawler] 가시 텍스트에서 출발공항 추출: ${targetDepartureAirport}`);
        }
    }

    if (!targetDepartureDate) {
        const visibleDateMatch = visibleText.match(/(?:출발일?|일정)\s*[:\-]?\s*(\d{4}[-.]\d{2}[-.]\d{2})/);
        if (visibleDateMatch) {
            targetDepartureDate = visibleDateMatch[1].replace(/\./g, '-');
            console.log(`[Crawler] 가시 텍스트에서 출발일 추출: ${targetDepartureDate}`);
        } else {
            const anyDateMatch = visibleText.match(/(\d{4}[-.]\d{2}[-.]\d{2})/);
            if (anyDateMatch) {
                targetDepartureDate = anyDateMatch[1].replace(/\./g, '-');
                console.log(`[Crawler] 가시 텍스트에서 일반 출발일 패턴 추출: ${targetDepartureDate}`);
            }
        }
    }

    // [추가] 가시 텍스트 추출 실패 시 최후의 수단: 백그라운드 JSON 정규식 직접 찾기
    // 주: 여기에는 유류할증료나 부분 가격이 포함될 위험이 있음
    if (!targetPrice || targetPrice === '0') {
        const altPriceMatch = html.match(/["'](?:sellingPriceAdultTotalAmount|totalAmount|adultPrice|salePrice)["']\s*:\s*(\d+)/);
        if (altPriceMatch) targetPrice = altPriceMatch[1];
    }
    if (!targetAirline) {
        const altAirlineMatch = html.match(/["'](?:transportName|airlineName|carrierNm)["']\s*:\s*["']([^"']+)["']/);
        if (altAirlineMatch) targetAirline = altAirlineMatch[1];
    }
    if (!targetDepartureAirport) {
        const altAirportMatch = html.match(/["'](?:departureCityName|depCityName|start_city_nm)["']\s*:\s*["']([^"']+)["']/);
        if (altAirportMatch) targetDepartureAirport = altAirportMatch[1];
    }

    // PAGE_TITLE 보강
    let finalTitle = pageTitle;
    if ((pageTitle.includes('모두투어') || pageTitle.includes('상품상세') || pageTitle.includes('undefined')) &&
        (ogTitle.length > 5 || bodyTitle.length > 5 || targetTitle.length > 5 || classTitle.length > 5)) {
        finalTitle = targetTitle || classTitle || ogTitle || bodyTitle;
    }

    let processed = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');

    const cleanBody = processed
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim()
        .substring(0, 50000);

    // [중요] 메타데이터를 가장 먼저 배치해야 텍스트가 잘려도 메타데이터는 유지됨
    const metadataBlock = `==== TARGET METADATA START ====
PAGE_TITLE: "${finalTitle}"
OG_TITLE: "${ogTitle}"
BODY_TITLE: "${bodyTitle}"
CLASS_TITLE: "${classTitle}"
TARGET_TITLE: "${targetTitle || finalTitle}"
TARGET_PRICE: "${targetPrice}"
TARGET_DURATION: "${targetDuration}"
TARGET_AIRLINE: "${targetAirline}"
TARGET_DEPARTURE_AIRPORT: "${targetDepartureAirport}"
TARGET_DEPARTURE_DATE: "${targetDepartureDate}"
TARGET_DESCRIPTION: "${targetDescription}"
==== TARGET METADATA END ====`;

    return `${metadataBlock}

[CONTENT BODY]
${cleanBody}`;
}

export async function analyzeWithGemini(text: string, url: string, nextData?: string, isSummaryOnly = false): Promise<DetailedProductInfo | null> {
    const rawApiKey = process.env.GEMINI_API_KEY?.trim();
    if (!rawApiKey) return null;
    
    // API 키가 여러 개 등록되어 있을 경우(쉼표 구분) 첫 번째 키만 사용
    const apiKey = rawApiKey.split(',')[0].trim();

    try {
        const modelName = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';
        console.log(`[Gemini] AI 분석 시작... (모델: ${modelName}, 요약모드: ${isSummaryOnly})`);

        let prompt = `다음 여행 상품 페이지에서 정보를 추출하여 JSON으로 반환하세요.
URL: ${url}
${nextData ? `--- [중요: NEXT_JS_DATA (JSON 데이터 참조용)] ---\n${nextData.substring(0, 15000)}\n` : ''}

반환 형식:
{
  "isProduct": true,
  "title": "상품명 전체",
  "destination": "목적지 (국가+도시)",
  "price": "성인 1인 가격 (숫자만)",
  "departureDate": "출발일 (YYYY-MM-DD)",
  "airline": "항공사명",
  "duration": "여행기간 (예: 3박5일)",
  "departureAirport": "출발공항",
  "keyPoints": ["상품 포인트 요약 (명사형 개조식)"]`;

        if (!isSummaryOnly) {
            prompt += `,\n  "exclusions": ["불포함 사항 요약"],\n  "itinerary": [{"day": "1일차", "activities": ["활동 내역..."]}]`;
        }

        prompt += `\n}\n\n입력 텍스트:\n${text.substring(0, 20000)}`;

        console.log(`[Gemini] 최종 프롬프트 길이: ${prompt.length}`);
        const fs = require('fs');
        fs.writeFileSync('debug-gemini-prompt.txt', prompt, 'utf-8');
        // ---------------------

        const tryModel = async (mName: string) => {
            console.log(`[Gemini] Trying model: ${mName}`);
            // Retry with v1 API if v1beta fails for quota
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${mName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
            });
            const data = await response.json();
            if (data.error) {
                console.warn(`[Gemini] Model ${mName} error: ${data.error.message}`);
                return { error: data.error };
            }
            return data;
        };

        let data = await tryModel(modelName);
        if (data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
            console.log('[Gemini] Flash model exhausted, trying 1.5-flash...');
            data = await tryModel('gemini-1.5-flash');
        }
        if (data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
            console.log('[Gemini] 1.5-flash exhausted, trying 1.5-pro...');
            data = await tryModel('gemini-1.5-pro');
        }

        if (data.error || !data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            console.error('[Gemini] All models failed or no text');
            return analyzeWithRegex(text, url);
        }

        const resText = data.candidates[0].content.parts[0].text;
        console.log('[Gemini] AI 응답:', resText.substring(0, 150));

        // JSON 파싱 전처리 (마크다운, 주석, 후행 쉼표 제거 등)
        let jsonStr = resText.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();

        // 간혹 AI가 응답 끝에 불필요한 텍스트를 붙이는 경우
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }

        // 후행 쉼표 제거 (Trailing commas)
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

        try {
            return JSON.parse(jsonStr);
        } catch (parseErr: any) {
            console.warn('[Gemini] 1차 파싱 실패, 정규식으로 핵심 필드 수동 추출 시도:', parseErr.message);
            // JSON이 완전히 망가졌을 때 핵심 데이터만 어떻게든 살리는 Fallback
            const fallback: any = { isProduct: true, features: [], exclusions: [], keyPoints: [] };

            const extractString = (key: string) => {
                const match = jsonStr.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
                return match ? match[1] : '';
            };

            fallback.title = extractString('title');
            fallback.price = extractString('price');
            fallback.airline = extractString('airline');
            fallback.departureAirport = extractString('departureAirport');
            fallback.departureDate = extractString('departureDate');
            fallback.duration = extractString('duration');

            return fallback;
        }
    } catch (e: any) {
        console.error('[Gemini] 네트워크/시스템 오류 (Rate Limit 등):', e);
        console.log('[Fallback] 정규식을 이용한 자체 분석 모드로 전환합니다.');
        return analyzeWithRegex(text, url);
    }
}

/**
 * [Fallback] Gemini API 호출 실패(Rate Limit 등) 시 정규식으로 직접 메타데이터를 추출하는 함수
 */
function analyzeWithRegex(text: string, url: string): DetailedProductInfo {
    const fallback: DetailedProductInfo = {
        isProduct: true,
        title: '',
        destination: '',
        price: '',
        departureDate: '',
        duration: '',
        airline: '',
        departureAirport: '',
        hotel: '',
        features: [],
        courses: [],
        specialOffers: [],
        inclusions: [],
        exclusions: [],
        itinerary: [],
        keyPoints: [],
        hashtags: '',
        hasNoOption: false,
        hasFreeSchedule: false,
        url: url
    };

    const stripQuotes = (s: string) => s.replace(/^"|"$/g, '').trim();

    const extractMatch = (regex: RegExp) => {
        const match = text.match(regex);
        return match ? stripQuotes(match[1]) : '';
    };

    fallback.title = extractMatch(/TARGET_TITLE:\s*"?([^"\n]*)"?/);
    if (!fallback.title || fallback.title === 'undefined') {
        fallback.title = extractMatch(/PAGE_TITLE:\s*"?([^"\n]*)"?/);
    }

    fallback.price = extractMatch(/TARGET_PRICE:\s*"?([^"\n]*)"?/);
    fallback.duration = extractMatch(/TARGET_DURATION:\s*"?([^"\n]*)"?/);
    fallback.airline = extractMatch(/TARGET_AIRLINE:\s*"?([^"\n]*)"?/);
    fallback.departureAirport = extractMatch(/TARGET_DEPARTURE_AIRPORT:\s*"?([^"\n]*)"?/);
    fallback.departureDate = extractMatch(/TARGET_DEPARTURE_DATE:\s*"?([^"\n]*)"?/);

    console.log('[Fallback] 정규식 추출 결과:', JSON.stringify(fallback));
    return fallback;
}

/**
 * 확정서 전용 종합 분석 — 페이지 전체 내용에서 일정/식사/호텔/포함사항 등 모두 추출
 */
export async function analyzeForConfirmation(text: string, url: string, nextData?: string): Promise<any | null> {
    const rawKeys = process.env.GEMINI_API_KEY || '';
    const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(Boolean);
    if (apiKeys.length === 0) {
        console.error('[Gemini-Confirm] No API keys found in environment');
        return null;
    }

    let preExtractedInclusions = '';
    let preExtractedExclusions = '';

    // Next_DATA에서 포함/불포함 직접 추출 (글자수 제한으로 잘리는 문제 방지)
    if (nextData) {
        console.log('[Debug] nextData length:', nextData.length);
        try {
            const dataObj = JSON.parse(nextData);
            console.log('[Debug] dataObj keys:', Object.keys(dataObj));
            const findValues = (obj: any, keyMap: string[], results: string[] = []): string[] => {
                if (!obj || typeof obj !== 'object') return results;
                for (const k in obj) {
                    if (keyMap.includes(k.toLowerCase()) && typeof obj[k] === 'string') {
                        console.log(`[Debug-Find] Found key ${k}, len: ${obj[k].length}`);
                        if (obj[k].length > 10) results.push(obj[k]);
                    }
                    findValues(obj[k], keyMap, results);
                }
                return results;
            };
            const inc = findValues(dataObj, ['includednote', 'incldcn', 'inclddetailcdnm']);
            const exc = findValues(dataObj, ['notincludednote', 'notincldcn', 'notinclddetailcdnm']);
            preExtractedInclusions = inc.join('\n\n');
            preExtractedExclusions = exc.join('\n\n');
            console.log('[Debug] preExtractedInclusions Length:', preExtractedInclusions.length);
            console.log('[Debug] preExtractedExclusions Length:', preExtractedExclusions.length);
        } catch (e) {
            console.error('nextData parsing error:', e);
        }
    }

    console.log(`[Gemini] 데이터 길이 - Text: ${text.length}, NextData: ${nextData?.length || 0}`);

    // 템플릿 리터럴 깨짐 방지를 위해 백틱 제거
    const safeText = text.replace(/`/g, "'").substring(0, 40000);
    const safeNextData = nextData ? nextData.replace(/`/g, "'").substring(0, 40000) : '';

    console.log('[Gemini] 확정서용 종합 분석 시작...');

    // 프롬프트를 문자열 연결 방식으로 구성 (템플릿 리터럴 파싱 오류 방지)
    let prompt = '당신은 여행 상품 웹페이지 전문 분석가입니다.\n';
    prompt += '아래 여행 상품 페이지의 전체 내용을 분석하여, 모바일 여행 확정서에 필요한 모든 정보를 빠짐없이 추출하세요.\n\n';
    prompt += 'URL: ' + url + '\n\n';

    if (preExtractedInclusions || preExtractedExclusions) {
        prompt += '--- [시스템 사전 추출 정보] ---\n';
        prompt += '포함사항 원문: ' + preExtractedInclusions + '\n';
        prompt += '불포함사항 원문: ' + preExtractedExclusions + '\n';
        prompt += '----------------------------------\n';
    }
    if (safeNextData) {
        prompt += '--- [NEXT_JS_DATA] ---\n' + safeNextData + '\n';
    }
    prompt += '--- [페이지 전체 내용] ---\n';
    prompt += safeText + '\n';
    prompt += '--- [끝] ---\n\n';

    prompt += '[중요 지침]\n';
    prompt += '1. 모든 일정(itinerary)의 activities는 본문을 꼼꼼히 읽고 상세히 기술하세요.\n';
    prompt += '2. 호텔 정보(name, address)를 반드시 찾아내세요. 본문에 없으면 절대 "미정" 대신 [NEXT_JS_DATA] 데이터를 최우선으로 사용하세요.\n';
    prompt += '3. 비행기 편명과 시간을 반드시 찾아내세요. 시간은 "09:00" 처럼 HH:MM 형식으로 적으세요.\n';
    prompt += '4. 귀국날짜(returnDate)를 정확히 계산하여 YYYY-MM-DD 형식으로 적으세요.\n';
    prompt += '5. JSON 이외의 텍스트는 출력하지 마세요. 답변에는 "연도-월-일"과 같은 가이드 문구를 넣지 말고 실제 데이터만 넣으세요.\n\n';
    prompt += '{\n';
    prompt += '  "title": "상품명 전체",\n';
    prompt += '  "destination": "목적지 (국가+도시)",\n';
    prompt += '  "price": "1인 기준 가격 (숫자만)",\n';
    prompt += '  "departureDate": "출발일 (YYYY-MM-DD 또는 원본 텍스트)",\n';
    prompt += '  "returnDate": "귀국일 (YYYY-MM-DD 또는 원본 텍스트)",\n';
    prompt += '  "duration": "여행기간 (예: 3박5일)",\n';
    prompt += '  "airline": "항공사명",\n';
    prompt += '  "flightCode": "편명 (예: 7C201)",\n';
    prompt += '  "departureAirport": "출발공항",\n';
    prompt += '  "departureTime": "가는편 출발 시각 (HH:MM) - 본문에서 반드시 찾아주세요",\n';
    prompt += '  "arrivalTime": "가는편 도착 시각 (HH:MM)",\n';
    prompt += '  "returnDepartureTime": "오는편 출발 시각 (HH:MM)",\n';
    prompt += '  "returnArrivalTime": "오는편 도착 시각 (HH:MM)",\n';
    prompt += '  "hotel": {\n';
    prompt += '    "name": "대표 호텔명 (한글 명칭)",\n';
    prompt += '    "englishName": "호텔 영문명",\n';
    prompt += '    "address": "호텔 상세 주소",\n';
    prompt += '    "checkIn": "체크인 시간 (예: 14:00)",\n';
    prompt += '    "checkOut": "체크아웃 시간 (예: 12:00)",\n';
    prompt += '    "images": ["호텔 이미지 URL 배열"],\n';
    prompt += '    "amenities": ["시설 및 서비스 목록"]\n';
    prompt += '  },\n';
    prompt += '  "itinerary": [\n';
    prompt += '    {\n';
    prompt += '      "day": "1일차",\n';
    prompt += '      "date": "날짜 (간략일정에 명시된 날짜 그대로)",\n';
    prompt += '      "title": "일정 제목",\n';
    prompt += '      "activities": ["간략일정에 명시된 항목 그대로 (원문 100% 유지. 임의로 요약/수정 금지)"],\n';
    prompt += '      "transportation": "간략일정표에 표시된 항공편 양식 그대로 (예: 인천 (ICN) 출발 2026.04.12(일) 18:40 - 4시간 30분 소요 - 곤명 (KMG) 도착 2026.04.12(일) 22:10) 본문에 있는 정보를 절대 누락하지 말고 그대로 적으세요.",\n';
    prompt += '      "hotelDetails": {\n';
    prompt += '        "name": "해당일 숙박 호텔 한글명",\n';
    prompt += '        "address": "호텔 상세 주소",\n';
    prompt += '        "images": ["호텔 이미지 URL 배열"],\n';
    prompt += '        "amenities": ["시설 목록"],\n';
    prompt += '        "checkIn": "체크인 시간",\n';
    prompt += '        "checkOut": "체크아웃 시간"\n';
    prompt += '      },\n';
    prompt += '      "meals": {\n';
    prompt += '        "breakfast": "포함 또는 불포함 또는 기내식",\n';
    prompt += '        "lunch": "포함 또는 불포함 또는 메뉴명",\n';
    prompt += '        "dinner": "포함 또는 불포함 또는 메뉴명"\n';
    prompt += '      },\n';
    prompt += '      "hotel": "해당일 숙박 호텔 한글명",\n';
    prompt += '      "dailyNotices": ["해당 일자의 특별 유의사항"]\n';
    prompt += '    }\n';
    prompt += '  ],\n';
    prompt += '  "inclusions": ["포함사항 전체 목록"],\n';
    prompt += '  "exclusions": ["불포함사항 전체 목록"],\n';
    prompt += '    "keyPoints": ["상품 포인트 요약 (\'~입니다\', \'~합니다\' 등의 서술어 절대 금지. 반드시 명사형으로 끝나는 짧은 개조식 구문 작성. 예: \'특급호텔에서 전일정 숙박\', \'노쇼핑 일정으로 편안한 여행\')"],\n';
    prompt += '  "specialOffers": ["특전/혜택"],\n';
    prompt += '  "features": ["상품 특징"],\n';
    prompt += '  "courses": ["주요 관광 코스"],\n';
    prompt += '  "notices": ["전체 유의사항"],\n';
    prompt += '  "cancellationPolicy": "취소/환불 규정",\n';
    prompt += '  "checklist": ["준비물 목록"]\n';
    prompt += '  "meetingInfo": [\n';
    prompt += '    {\n';
    prompt += '      "type": "미팅장소/수속카운터",\n';
    prompt += '      "location": "상세 위치",\n';
    prompt += '      "time": "미팅 시각",\n';
    prompt += '      "description": "미팅 관련 상세 안내 내용 (원문 그대로 복사)"\n';
    prompt += '    }\n';
    prompt += '  ],\n';
    prompt += '  "checklist": ["준비물 목록"]\n';
    prompt += '}\n\n';
    prompt += '중요 지침 (절대 엄수):\n';
    prompt += '1. 원문 보존 (VERBATIM): 간략일정(Brief Itinerary) 섹션을 찾아 그 안의 activities(활동/명소/안내/미팅/투숙/유의사항 모두 포함)와 교통편 정보(transportation)를 절대로 요약하거나 고치지 말고 원문 그대로 토시 하나 틀리지 않게 복사하세요.\n';
    prompt += '   특히 activities 배열에는 단순히 관광지 이름만 넣지 말고, 해당 일자에 적힌 "인천 국제 공항 출발", "유의사항", "가이드 미팅 후 투숙" 등 모든 안내 텍스트 블록들을 개별 문자열로 배열에 전부 넣으세요.\n';
    prompt += '2. 교통 시간/소요시간: 출발시간, 도착시간, 소요시간이 있다면 "transportation" 필드에 간략일정 양식 그대로 담으세요.\n';
    prompt += '3. 호텔명 정확도: 호텔 이름은 원문에 명시된 전체 정식 명칭을 사용하세요. 주소가 있다면 반드시 포함하세요.\n';
    prompt += '4. 미팅 및 수속 정보: 본문에서 미팅 안내 등을 찾아 meetingInfo에 상세히 기록하세요.\n';
    prompt += '5. 다중 호텔 추출: 일정표 전체에서 언급된 모든 호텔들을 찾아내어 hotels 배열에 담으세요.\n';
    prompt += '6. 이모지 사용 금지: 깔끔한 텍스트만 사용합니다.\n';
    prompt += '7. JSON 형식만 반환하세요.';

    console.log(`[Gemini-Confirm] Combined Prompt Length: ${prompt.length}`);
    console.log(`[Gemini-Confirm] Prompt Snippet (Tail): ${prompt.substring(prompt.length - 500)}`);
    // safeText와 safeNextData 존재 여부 및 길이 로그
    console.log(`[Gemini-Confirm] safeText Len: ${safeText.length}, safeNextData Len: ${safeNextData.length}`);
    if (safeText.includes('일정') || safeText.includes('1일차')) {
        console.log('[Gemini-Confirm] "일정" or "1일차" keywords FOUND in safeText');
    } else {
        console.log('[Gemini-Confirm] "일정" or "1일차" keywords MISSING from safeText!!!');
    }

    const tryModel = async (mName: string, activeKey: string) => {
        console.log(`[Gemini-Confirm] Trying model: ${mName} with key ending in ..${activeKey.slice(-4)}`);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${mName}:generateContent?key=${activeKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    temperature: 0.1, 
                    maxOutputTokens: 8192,
                    responseMimeType: "application/json"
                }
            })
        });
        const data = await response.json();
        if (data.error) {
            console.warn(`[Gemini-Confirm] Model ${mName} error: ${data.error.message}`);
            return { error: data.error };
        }
        return data;
    };

    let finalResult: any = null;

    try {
        for (const activeKey of apiKeys) {
            console.log(`[Gemini-Confirm] Attempting with key ..${activeKey.slice(-4)}`);
            
            // Try models in sequence for this key
            const modelsToTry = [
                'models/gemini-2.0-flash',
                'models/gemini-1.5-pro',
                'models/gemini-1.5-flash-latest',
                'models/gemini-pro-latest'
            ];

            for (const mName of modelsToTry) {
                const data = await tryModel(mName, activeKey);
                
                if (data.error) {
                    if (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED' || data.error.message?.includes('quota')) {
                        console.warn(`[Gemini-Confirm] Key ..${activeKey.slice(-4)} reached quota. Moving to next key.`);
                        break; // Try next key
                    }
                    continue; // Try next model with same key
                }

                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const resText = data.candidates[0].content.parts[0].text;
                    console.log(`[Gemini-Confirm] Raw Response: ${resText.substring(0, 500)}...`);
                    const jsonStr = resText.replace(/```json\s*|\s*```/g, '').trim();
                    try {
                        const parsed = JSON.parse(jsonStr);
                        // Cleaning logic
                        const cleanEnt = (s: any) => typeof s === 'string' ? s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : s;
                        if (Array.isArray(parsed.inclusions)) parsed.inclusions = parsed.inclusions.map(cleanEnt);
                        if (Array.isArray(parsed.exclusions)) parsed.exclusions = parsed.exclusions.map(cleanEnt);

                        // Itinerary Fallback
                        if (!parsed.itinerary || !Array.isArray(parsed.itinerary) || parsed.itinerary.length === 0) {
                            console.log('[Gemini] Itinerary empty, creating fallback Day 1');
                            parsed.itinerary = [{
                                day: "전체 일정",
                                title: parsed.title || "상품 일정 안내",
                                activities: ["상세 일정 정보를 추출하지 못했습니다. 상세 내용은 원문 페이지를 참고해 주세요."],
                                meals: { breakfast: "정보 없음", lunch: "정보 없음", dinner: "정보 없음" }
                            }];
                        }

                        console.log('[Gemini] 확정서 분석 완료 (일정수: ' + parsed.itinerary.length + ')');
                        finalResult = parsed;
                        break; // Success! Break model loop
                    } catch (parseErr) {
                        console.error('[Gemini] JSON 파싱 실패', parseErr);
                    }
                }
            }
            if (finalResult) break; // Success! Break key loop
        }

        if (!finalResult) {
            console.error('[Gemini] All keys and models failed or produced invalid data');
            return null;
        }
        return finalResult;

    } catch (e: any) {
        console.error('[Gemini] 확정서 분석 오류:', e.message);
        return null;
    }
}


export const scrapeWithScrapingBee = async (url: string): Promise<string | null> => {
    const rawKey = process.env.SCRAPINGBEE_API_KEY;
    if (!rawKey) return null;
    const apiKey = rawKey.trim();
    if (!apiKey) return null;

    let ssrNextData: string | undefined;
    let ssrHtml: string | undefined;

    // [전략 1-보조] SSR에서 __NEXT_DATA__ 추출 (출발일/상품명 확보용, 빠름)
    try {
        console.log('[ScrapingBee] SSR에서 __NEXT_DATA__ 보조 추출 시도');
        const ssrUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=10000`;
        const response = await fetch(ssrUrl);
        if (response.ok) {
            const html = await response.text();
            if (html.length > 1000 && html.includes('<') && !html.startsWith('{')) {
                ssrHtml = html;
                const ndStart = html.indexOf('<script id="__NEXT_DATA__"');
                if (ndStart !== -1) {
                    const jsonStart = html.indexOf('>', ndStart) + 1;
                    const jsonEnd = html.indexOf('</script>', jsonStart);
                    if (jsonStart > 0 && jsonEnd !== -1) {
                        ssrNextData = html.substring(jsonStart, jsonEnd);
                        console.log(`[ScrapingBee] SSR __NEXT_DATA__ 확보: ${ssrNextData.length}자`);
                    }
                }
            }
        }
    } catch (e: any) {
        console.warn('[ScrapingBee] SSR 보조 추출 실패 (무시):', e.message);
    }

    // [전략 2-메인] JS 렌더링 (빠름 - domcontentloaded)
    try {
        console.log('[ScrapingBee] JS 렌더링 시도 (최적화 모드)');
        const jsScenario = {
            instructions: [
                { scroll_y: 2000 },
                { wait: 1500 },
                { scroll_y: 5000 },
                { wait: 1000 }
            ]
        };

        const scenarioStr = JSON.stringify(jsScenario);
        const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=6000&js_scenario=${encodeURIComponent(scenarioStr)}`;

        const response = await fetch(scrapingBeeUrl);
        if (response.ok) {
            const html = await response.text();
            if (html.length > 1000 && html.includes('<') && !html.startsWith('{')) {
                console.log(`[ScrapingBee] JS 렌더링 성공: ${html.length}자`);

                let enrichedHtml = html;
                if (ssrNextData && !html.includes('__NEXT_DATA__')) {
                    enrichedHtml = html.replace('</body>', `<script id="__NEXT_DATA__" type="application/json">${ssrNextData}</script></body>`);
                }

                return htmlToText(enrichedHtml, url);
            }
        }
    } catch (e: any) {
        console.warn('[ScrapingBee] JS 렌더링 실패:', e.message);
    }

    // [전략 3-폴백] SSR HTML 사용 (JS 렌더링 실패 시)
    if (ssrHtml) {
        console.log('[ScrapingBee] JS 실패 → SSR HTML 원본으로 폴백');
        return htmlToText(ssrHtml, url);
    } else if (ssrNextData) {
        console.log('[ScrapingBee] JS 실패 → SSR __NEXT_DATA__로 폴백');
        const minimalHtml = `<html><body><script id="__NEXT_DATA__" type="application/json">${ssrNextData}</script></body></html>`;
        return htmlToText(minimalHtml, url);
    }

    console.error('[ScrapingBee] 모든 전략 실패');
    return null;
}



/**
 * 확정서 전용 크롤러 — 전체 페이지 데이터를 종합 분석
 * 확정서는 정확도와 모든 세부 정보(포함/불포함/일정표) 추출이 필수이므로, 
 * 다소 지연되더라도 JS 렌더링이 보장되는 브라우저 크롤링을 사용합니다.
 */
export async function crawlForConfirmation(url: string): Promise<DetailedProductInfo | null> {
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    console.log(`[Crawler] crawlForConfirmation Start. Vercel=${isVercel}, URL=${url}`);

    // 타임아웃 안전망 (26초) - Vercel 30초 제한 대비
    let timeoutPromise = new Promise<null>((_, reject) => {
        setTimeout(() => reject(new Error('Total analysis timeout (26s)')), 26000);
    });

    try {
        const result = await Promise.race([
            _executeDeepCrawl(url, isVercel),
            timeoutPromise
        ]);
        return result as DetailedProductInfo | null;
    } catch (e: any) {
        console.error(`[Crawler] Deep Crawl Failed or Timeout: ${e.message}`);
        // 타임아웃 발생 시, 아주 최소한의 데이터만이라도 반환 시도 (기존 fetchContent는 매우 빠름)
        try {
            const contentResult = await fetchContent(url);
            if (contentResult.nativeData) return refineData(contentResult.nativeData, contentResult.text, url);
            return refineData(fallbackParse(contentResult.text), contentResult.text, url);
        } catch (inner) {
            return null;
        }
    }
}

async function _executeDeepCrawl(url: string, isVercel: boolean): Promise<DetailedProductInfo | null> {
    let fullText = '';
    let nextData: any = undefined;
    let nativeDataObj: any = null;

    // 1. [최우선] 모두투어 Native API 시도 (가장 빠름: 1~3초)
    if (url.includes('modetour.com')) {
        console.log('[ConfirmCrawler] ModeTour URL 감지 -> 네이티브 API 우선 획득');
        try {
            const native = await fetchModeTourNative(url, false); // 확정서는 전체 데이터 필요
            if (native) {
                console.log('[ConfirmCrawler] ModeTour Native Data 수집 성공.');
                nativeDataObj = native;
                nextData = JSON.stringify(native);
                
                // HTML도 가져와서 fullText 채우기 (AI 분석 보조용)
                const contentResult = await fetchContent(url);
                fullText = contentResult.text;
            }
        } catch (e: any) {
            console.warn('[ConfirmCrawler] Native API 호출 중 오류:', e.message);
        }
    }

    // 2. 브라우저 크롤링 (Native 실패 시 또는 타 사이트)
    if (!fullText) {
        if (!isVercel) {
            try {
                console.log('[ConfirmCrawler] 로컬 환경: Browser 크롤링(Puppeteer) 시도');
                fullText = await scrapeWithBrowser(url) || '';
            } catch (e: any) {
                console.log(`[ConfirmCrawler] 브라우저 크롤링 중 에러 발생: ${e.message}`);
            }
        } else if (process.env.SCRAPINGBEE_API_KEY) {
            console.log(`[ConfirmCrawler] ScrapingBee로 전환...`);
            const sbResult = await scrapeWithScrapingBee(url);
            if (sbResult) fullText = sbResult;
        }
    }

    // 3. 여전히 데이터가 없으면 일반 fetch
    if (!fullText) {
        console.log(`[ConfirmCrawler] 모든 고급 크롤링이 실패하여 일반 fetch로 폴백`);
        const result = await fetchContent(url);
        fullText = result.text;
        if (!nextData) nextData = result.nextData;
    } else {
        fullText = fullText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    }

    // 4. AI 분석 (최종 단계: 10~20초 소요)
    console.log(`[Crawler] AI 분석 시작... (데이터 길이: ${fullText?.length || 0})`);
    // analyzeForConfirmation는 이미 상단에 정의되어 있다고 가정 (1047번 라인)
    const result = await analyzeForConfirmation(fullText, url, nextData);
    
    if (result) {
        result.url = url;
        // [중요] 네이티브 데이터가 있으면 AI 결과에 주입
        if (nativeDataObj) {
            console.log('[ConfirmCrawler] AI 결과에 네이티브 데이터 주입 (Verbatim)');
            if (nativeDataObj.itinerary && nativeDataObj.itinerary.length > 0) result.itinerary = nativeDataObj.itinerary;
            if (nativeDataObj.meetingInfo && nativeDataObj.meetingInfo.length > 0) result.meetingInfo = nativeDataObj.meetingInfo;
            if (nativeDataObj.airline) result.airline = nativeDataObj.airline;
            if (nativeDataObj.flightCode) result.flightCode = nativeDataObj.flightCode;
            if (nativeDataObj.departureAirport) result.departureAirport = nativeDataObj.departureAirport;
        }
        return result;
    }

    // 최종 폴백: 일반 파싱
    console.log('[ConfirmCrawler] 확정서 분석 실패, 일반 파싱으로 폴백');
    return await crawlTravelProduct(url, 'confirmation');
}


function fallbackParse(text: string): DetailedProductInfo {
    return { title: '상품명 추출 실패', destination: '', price: '가격 문의', departureDate: '', departureAirport: '', duration: '', airline: '', hotel: '', url: '', features: [], courses: [], specialOffers: [], inclusions: [], exclusions: [], itinerary: [], keyPoints: [], hashtags: '', hasNoOption: false, hasFreeSchedule: false };
}

export async function crawlTravelProduct(url: string, source?: string): Promise<DetailedProductInfo> {
    console.log(`[Crawler] crawlTravelProduct (Normal Mode) Start: ${url}`);

    // 1. [Fast Path] ModeTour Native API
    if (url.includes('modetour.com')) {
        console.log('[Crawler] ModeTour 감지: Native API (Summary Only) 시도');
        const native = await fetchModeTourNative(url, true); // 요약 모드 활성화
        if (native) {
            console.log('[Crawler] ModeTour Native 수집 성공 (AI 분석 건너뜀)');
            return refineData(native, JSON.stringify(native), url);
        }
    }

    // 2. [Vercel 최적화] Vercel에서는 ScrapingBee 대신 일반 fetch 시도 후 안될 때만 AI 고려
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    
    let fullText = '';
    let nextData: any = undefined;

    // 일반 fetch 시도 (isSummaryOnly=true)
    const contentResult = await fetchContent(url, true);
    if (contentResult.nativeData) {
        return refineData(contentResult.nativeData, contentResult.text, url, contentResult.nextData);
    }
    
    fullText = contentResult.text;
    nextData = contentResult.nextData;

    // 만약 텍스트가 너무 적고 (정상적인 페이지가 아님) Vercel이 아니라면 브라우저 시도
    if (fullText.length < 500 && !isVercel) {
        try {
            const browserText = await scrapeWithBrowser(url);
            if (browserText) fullText = browserText;
        } catch (e) {}
    }

    // 텍스트 정리
    fullText = fullText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

    // 3. AI 분석 (최종 수단)
    console.log(`[Crawler] AI 분석 시작 (Normal Mode: Summary Only)`);
    const aiResult = await analyzeWithGemini(fullText, url, nextData, true);

    if (aiResult?.isProduct) {
        return refineData(aiResult, fullText, url, nextData);
    }
    
    return refineData(fallbackParse(fullText), fullText, url, nextData);
}

function formatDateString(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '미정') return dateStr;
    const cleanDate = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return cleanDate;
    
    // YYYYMMDD 또는 YYMMDD 형식 처리
    if (/^\d{8}$/.test(cleanDate)) {
        return `${cleanDate.substring(0, 4)}-${cleanDate.substring(4, 6)}-${cleanDate.substring(6, 8)}`;
    }
    if (/^\d{6}$/.test(cleanDate)) {
        return `20${cleanDate.substring(0, 2)}-${cleanDate.substring(2, 4)}-${cleanDate.substring(4, 6)}`;
    }

    const match = cleanDate.match(/(\d{2,4})[-\.\/년]\s*(\d{1,2})[-\.\/월]\s*(\d{1,2})/);
    if (match) {
        let year = match[1];
        if (year.length === 2) year = `20${year}`;
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}

function formatDurationString(durationStr: string): string {
    if (!durationStr || durationStr.trim() === '미정' || durationStr === '""') return '미정';
    let str = durationStr.trim().replace(/"/g, '');

    // 이미 X박Y일 형태면 유지
    if (/^\d+박\d+일$/.test(str)) return str;

    const boxDayMatch = str.match(/(\d+)\s*박\s*(\d+)\s*일?/);
    if (boxDayMatch) return `${boxDayMatch[1]}박${boxDayMatch[2]}일`;

    const onlyDayMatch = str.match(/(\d+)\s*일$/);
    if (onlyDayMatch) {
        const days = parseInt(onlyDayMatch[1], 10);
        if (days > 1) return `${days - 1}박${days}일`;
        if (days === 1) return `당일`;
    }

    const onlyBoxMatch = str.match(/^(\d+)\s*박$/);
    if (onlyBoxMatch) {
        const nights = parseInt(onlyBoxMatch[1], 10);
        return `${nights}박${nights + 1}일`;
    }
    return str.replace(/\s+/g, '');
}

export function refineData(info: DetailedProductInfo, originalText: string, url: string, nextData?: string): DetailedProductInfo {
    const refined = { ...info };

    // 기본적인 포맷팅만 수행 (AI가 추출한 데이터를 최대한 존중)
    if (refined.price) {
        const digits = String(refined.price).replace(/[^0-9]/g, '');
        if (digits && parseInt(digits, 10) > 1000) {
            refined.price = parseInt(digits, 10).toLocaleString() + '원';
        }
    }

    if (refined.departureDate) {
        refined.departureDate = formatDateString(refined.departureDate);
    }

    if (refined.duration) {
        refined.duration = formatDurationString(refined.duration);
    }

    // 항공사 이름 매핑 (코드 -> 이름)
    if (refined.airline && refined.airline.length <= 3) {
        const airlineCode = refined.airline.trim().toUpperCase();
        if (AIRLINE_MAP[airlineCode]) {
            console.log(`[Refine] Mapping airline code ${airlineCode} to ${AIRLINE_MAP[airlineCode]}`);
            refined.airline = AIRLINE_MAP[airlineCode];
        }
    }
    console.log(`[Refine-DEBUG] After Refine: Airline=${refined.airline}, Airport=${refined.departureAirport}, Date=${refined.departureDate}`);

    return {
        ...refined,
        url,
        itinerary: refined.itinerary || [],
        keyPoints: (refined.keyPoints || []).slice(0, 4),
        inclusions: refined.inclusions || [],
        exclusions: refined.exclusions || [],
        specialOffers: refined.specialOffers || [],
        notices: refined.notices || [],
        features: refined.features || [],
        courses: refined.courses || []
    };
}

const AIRLINE_MAP: Record<string, string> = {
    '7C': '제주항공', 'KE': '대한항공', 'OZ': '아시아나', 'LJ': '진에어',
    'TW': '티웨이', 'ZE': '이스타', 'RS': '에어서울', 'BX': '에어부산',
    'VN': '베트남항공', 'VJ': '비엣젯', 'PR': '필리핀항공', '5J': '세부퍼시픽',
    'CX': '캐세이퍼시픽', 'CI': '중화항공', 'BR': '에바항공', 'MU': '동방항공',
    'CZ': '남방항공', 'CA': '중국국제항공', 'HO': '길상항공'
};

export function formatProductInfo(info: DetailedProductInfo, index?: number): string {
    let r = index !== undefined ? `${index + 1}. ${info.title}\n\n` : `${info.title}\n\n`;
    
    // 가격 콤마 포맷팅 보완
    const rawPrice = String(info.price || '').replace(/[^0-9]/g, '');
    const priceWithComma = rawPrice ? parseInt(rawPrice, 10).toLocaleString() : '- ';

    r += `* 출발일 : ${formatDateString(info.departureDate || '-')}\n`;
    r += `* 출발공항 : ${info.departureAirport || '인천공항'}\n`;
    r += `* 항공사 : ${info.airline || '정보없음'}\n`;
    r += `* 여행기간 : ${info.duration || '-'}\n\n`;
    r += `* 지역 : ${info.destination || '-'}\n`;
    r += `* 기간 : ${info.duration || '-'}\n`;
    r += `* 가격 : ${priceWithComma}원\n`;

    if (info.keyPoints && info.keyPoints.length > 0) {
        r += `\n[상품 포인트]\n`;
        info.keyPoints.forEach(point => {
            r += `- ${point}\n`;
        });
    }

    r += `\n[원문 일정표 열기]\n(${info.url})\n\n`;
    r += `📌 예약 전 확인사항\n\n`;
    r += `상품가는 예약일/출발일에 따라 변동될 수 있습니다.\n`;
    r += `항공 좌석은 예약 시점에 다시 확인해야 합니다.`;
    return r;
}

export async function generateRecommendation(info: DetailedProductInfo): Promise<string> {
    const p = info.price || '문의';
    return `✨ **${info.destination} 여행, 추천드려요!**\n\n${p}에 즐기는 알찬 일정입니다.`;
}

export function compareProducts(products: DetailedProductInfo[]): string {
    if (!products || products.length < 2) {
        return "비교할 상품이 충분하지 않습니다.";
    }

    let comparison = "⚖️ 상품 비교 분석 결과\n\n";

    // 상세 상품별 분석
    products.forEach((p, i) => {
        const rawPrice = String(p.price || '').replace(/[^0-9]/g, '');
        const priceWithComma = rawPrice ? parseInt(rawPrice, 10).toLocaleString() : '정보 없음';

        comparison += `${i + 1}. ${p.title}\n\n`;
        comparison += `* 출발일 : ${formatDateString(p.departureDate || '미정')}\n`;
        comparison += `* 출발공항 : ${p.departureAirport || '인천'}\n`;
        comparison += `* 항공 : ${p.airline || '-'}\n`;
        comparison += `* 지역 : ${p.destination || '-'}\n`;
        comparison += `* 기간 : ${p.duration || '-'}\n`;
        comparison += `* 가격 : ${priceWithComma}${rawPrice ? '원' : ''}\n\n`;

        if (p.keyPoints && p.keyPoints.length > 0) {
            comparison += `[상품 포인트]\n`;
            p.keyPoints.slice(0, 10).forEach(point => {
                comparison += `- ${point}\n`;
            });
            comparison += `\n`;
        }

        comparison += `[원문 일정표 열기]\n(${p.url})\n\n`;

        if (i < products.length - 1) {
            comparison += `------------------------------------------\n\n`;
        }
    });

    comparison += `📌 예약 전 확인사항\n\n`;
    comparison += `상품가는 예약일/출발일에 따라 변동될 수 있습니다.\n`;
    comparison += `항공 좌석은 예약 시점에 다시 확인해야 합니다.`;

    return comparison;
}

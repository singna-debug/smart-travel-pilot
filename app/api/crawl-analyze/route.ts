import { NextRequest, NextResponse } from 'next/server';
import { formatProductInfo } from '@/lib/url-crawler';

/**
 * Node.js Serverless로 변경하여 ModeTour WAF 방화벽 우회 (Edge는 차단됨)
 */
export const preferredRegion = 'icn1';
export const runtime = 'nodejs';

const VERSION = "2026-03-13-V6"; // 배포 확인용 버전 코드


// ── htmlToText (Edge 호환 및 지능형 프루닝) ──
function htmlToText(html: string, url: string, isConfirmation: boolean = false): { text: string, nextData?: string } {
    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) pageTitle = titleMatch[1].trim();

    // 텍스트 추출 시 테이블 구조를 어느 정도 유지하도록 시도
    let visibleTextRaw = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<\/tr>/gi, '\n') // 행 구분
        .replace(/<\/td>/gi, '  ') // 칸 구분
        .replace(/<[^>]+>/g, ' ');

    let nextData: string | undefined = undefined;
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
        nextData = nextDataMatch[1];
    }

    // [최적화] 429 에러 방지 및 정보 손실 방지 사이의 균형
    // 확정서의 경우 일정이 길 수 있으므로 한도를 더 늘림
    let bodyLimit = isConfirmation ? 70000 : 50000;
    let nextDataLimit = isConfirmation ? 40000 : 50000;

    if (nextData && nextData.length > nextDataLimit) {
        // NEXT_DATA가 너무 크면 핵심 정보가 앞쪽에 보통 있으므로 앞부분만 취함
        nextData = nextData.substring(0, nextDataLimit);
    }

    const cleanBody = visibleTextRaw
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim()
        .substring(0, bodyLimit);

    const formattedText = `PAGE_TITLE: "${pageTitle}"\n\n[CONTENT BODY]\n${cleanBody}`;

    return { text: formattedText, nextData };
}

// ── recursiveValueExtractor (Edge safe) ──
function extractValRobust(obj: any, key: string, targetId?: string): any {
    if (!obj || typeof obj !== 'object') return null;
    const currentId = obj.productNo || obj.goodsNo || obj.prd_nm_no || obj.itemNo || obj.goods_no || obj.pnum || obj.Pnum || obj.groupNumber;
    if (targetId && currentId && String(currentId) !== targetId) return null;

    if (key in obj && obj[key] !== null && obj[key] !== undefined && typeof obj[key] !== 'object') {
        return obj[key];
    }

    let highestVal: any = null;
    for (const k in obj) {
        if (obj[k] && typeof obj[k] === 'object') {
            const res = extractValRobust(obj[k], key, targetId);
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
    }
    return highestVal;
}

async function fetchModeTourNative(url: string, sbKey?: string): Promise<any> {
    const productNoMatch = url.match(/package\/(\d+)/i) || url.match(/Pnum=(\d+)/i);
    if (!productNoMatch) return null;
    const productNo = productNoMatch[1];

    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    };

    let dataDetail: any = null;
    let dataPoints: any = null;
    let dataSchedule: any = null;
    let dataHotel: any = null;

    try {
        console.log(`[ModeTour Native] Fetching for ${productNo}`);
        const [resDetail, resPoints, resSchedule, resHotel] = await Promise.all([
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers, cache: 'no-store' }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`, { headers, cache: 'no-store' }),
            fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers, cache: 'no-store' }),
            fetch(`https://b2c-api.modetour.com/Package/GetHotelList?productNo=${productNo}`, { headers, cache: 'no-store' })
        ]);

        if (resDetail.ok) dataDetail = await resDetail.json();
        if (resPoints.ok) dataPoints = await resPoints.json();
        if (resSchedule.ok) dataSchedule = await resSchedule.json();
        if (resHotel.ok) dataHotel = await resHotel.json();

        if (!dataDetail?.result) {
            const resSimple = await fetch(`https://b2c-api.modetour.com/Package/GetProductSimpleDetail?productNo=${productNo}`, { headers, cache: 'no-store' });
            if (resSimple.ok) dataDetail = await resSimple.json();
        }
    } catch (e: any) {
        console.warn(`[ModeTour Native] Direct fetch failed: ${e.message}`);
    }

    if (dataDetail?.isOK && dataDetail.result) {
        const d = dataDetail.result;
        console.log(`[ModeTour Native] Processing: ${d.productName || d.prd_nm}`);

        // 1. Title 정제
        let cleanTitle = d.productName || d.prd_nm || '';
        cleanTitle = cleanTitle.replace(/\[출발확정\]/g, '').trim();

        // 2. Region / Destination
        const mainRegion = d.category2 || d.city_nm || '';
        const cities = d.visitCities && d.visitCities.length > 0 ? d.visitCities.join('/') : (d.category3 || '');
        const destination = mainRegion ? `${mainRegion}, ${cities}` : cities;

        // 3. Duration 보정
        let duration = d.travelPeriod || d.days_cnt || '';
        if (/^\d+일$/.test(duration)) {
            const days = parseInt(duration);
            if (days > 1) duration = `${days - 1}박${duration}`;
        }

        // --- 4. 상품 포인트/특전 추출 (서술형 혜택 문장) ---
        let keyPoints: string[] = [];
        
        // moreInfo에서 서술형 포인트 추출
        const moreInfoText = [
            d.travelRecommendNote,
            d.specialEventNote,
            d.generalBonusNote,
        ].filter(Boolean).join('\n\n');

        if (moreInfoText) {
            const rawText = moreInfoText.replace(/<[^>]+>/g, '');
            
            // [특전] 태그 라인 최우선 (스페셜 혜택 탭 내용)
            const specialLines = rawText.split('\n')
                .filter((l: string) => l.includes('[특전]') || l.includes('【특전】'))
                .map((l: string) => l.replace(/\[특전\]|【특전】/g, '').replace(/^[\s■\*\-]+/, '').trim())
                .filter((l: string) => {
                    if (l.length < 5 || l.length > 60) return false;
                    // 조건부/안내성 텍스트 필터링
                    if (l.includes('대상자') || l.includes('유효기간') || l.includes('여권') || l.includes('등록 필요')) return false;
                    if (l.includes('입국 카드') || l.includes('MDAC') || l.includes('비자') || l.includes('보험')) return false;
                    if (l.includes('방문하는 모든') || l.includes('이내 등록')) return false;
                    if (l.includes('불포함') || l.includes('포함 사항')) return false;
                    return true;
                });
            keyPoints.push(...specialLines);

            // ■섹션■ 구분 파싱 → 관광/숙박/식사 핵심 추출
            const sections = rawText.split(/■[^■]+■/);
            const sectionHeaders = rawText.match(/■([^■]+)■/g) || [];
            
            for (let i = 0; i < sectionHeaders.length && keyPoints.length < 7; i++) {
                const header = sectionHeaders[i].replace(/■/g, '').trim();
                const content = sections[i + 1] || '';
                
                if (header.includes('관광') || header.includes('관광지')) {
                    const placeNames = content.split('\n')
                        .map((l: string) => l.replace(/^[\s\*\-\d\.]+/, '').trim())
                        .filter((l: string) => l.length > 3 && !l.startsWith('#'))
                        .slice(0, 3)
                        .map((p: string) => p.split(/[:：]/)[0].trim())
                        .filter((p: string) => p.length > 2 && p.length < 15);
                    if (placeNames.length > 0 && !keyPoints.some(kp => kp.includes('명소'))) {
                        keyPoints.push(`${placeNames.join(', ')} 등 주요 명소 방문`);
                    }
                } else if (header.includes('숙박') && !keyPoints.some(kp => kp.includes('호텔') || kp.includes('숙박'))) {
                    const hotelLines = content.split('\n')
                        .map((l: string) => l.replace(/^[\s\*\-]+/, '').trim())
                        .filter((l: string) => l.length > 5);
                    if (hotelLines.length > 0) {
                        let h = hotelLines[0];
                        if (h.includes('특급') || h.includes('5성')) h = '특급호텔에서 전일정 편안한 숙박';
                        else if (h.includes('리조트')) h = '리조트 숙박';
                        else if (h.includes('월드체인')) h = '월드체인 호텔 숙박';
                        else if (h.length > 25) h = h.substring(0, 25).trim() + ' 숙박';
                        if (h.length > 3) keyPoints.push(h);
                    }
                } else if (header.includes('식사') && !keyPoints.some(kp => kp.includes('식사') || kp.includes('석식'))) {
                    const mealLines = content.split('\n')
                        .map((l: string) => l.replace(/^[\s\*\-]+/, '').trim())
                        .filter((l: string) => l.length > 3 && !l.startsWith('#'));
                    if (mealLines.some((m: string) => m.includes('무제한'))) {
                        keyPoints.push('호텔 식사 및 음료 무제한 제공');
                    } else if (mealLines.length > 0) {
                        keyPoints.push(`식사 ${mealLines.length}회 포함`);
                    }
                }
            }
            
            // 섹션 구분이 없을 때 일반 라인 추출
            if (keyPoints.length === 0) {
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
                        return true;
                    });
                for (const line of lines) {
                    if (keyPoints.length >= 7) break;
                    if (line.includes(':') || line.includes('：')) {
                        const [place] = line.split(/[:：]/);
                        if (place.trim().length > 2 && place.trim().length < 20) keyPoints.push(`${place.trim()} 관광`);
                    } else {
                        let desc = line;
                        if (/온천호텔\d+박/.test(desc)) desc = '전 일정 온천호텔 숙박';
                        else if (/호텔석식\d+회/.test(desc)) desc = `호텔 석식 ${desc.match(/\d+/)?.[0] || ''}회 제공`;
                        else if (/현지식\d+회/.test(desc)) desc = `현지 특식 ${desc.match(/\d+/)?.[0] || ''}회 포함`;
                        keyPoints.push(desc.replace(/\s+/g, ' ').trim());
                    }
                }
            }
        }

        // GetProductKeyPointInfo에서 추출 (있을 때만 보충)
        if (dataPoints?.isOK && dataPoints.result) {
            const r = dataPoints.result;
            const tabSections = [r.specialBenefits, r.sightseeings, r.hotels, r.meals].filter(Boolean);
            for (const section of tabSections) {
                if (Array.isArray(section)) {
                    for (const item of section) {
                        if (keyPoints.length >= 7) break;
                        const title = (item.title || item.BenefitTitle || item.name || '').replace(/\[특전\]/g, '').trim();
                        if (title.length > 3 && !keyPoints.includes(title)) keyPoints.push(title);
                    }
                }
            }
        }

        // 타이틀 괄호 안 키워드 보충 (부족할 때만)
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

        // 상품 속성 자동 추가
        if (d.isConfirmed || cleanTitle.includes('출발확정') || cleanTitle.includes('[출발확정]')) {
            keyPoints.unshift('출발 확정 상품');
        }
        if (d.isNoShopping || cleanTitle.includes('노쇼핑') || moreInfoText.includes('노쇼핑')) {
            keyPoints.push('노쇼핑 일정으로 편안한 여행');
        }

        // 최종 문장 정제 및 해시태그 보충
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

        // travelRecommendNote 등 상세 정보를 description으로 전달 (Gemini 요약용)
        const moreInfo = [
            d.travelRecommendNote, 
            d.specialEventNote, 
            d.generalBonusNote,
            d.groupBriefKeyword
        ].filter(Boolean).join('\n\n');

        // --- 5. 일정(Itinerary) 매핑 ---
        let itinerary: any[] = [];
        if (dataSchedule?.isOK && Array.isArray(dataSchedule.result)) {
            const daysMap = new Map<number, any>();
            dataSchedule.result.forEach((item: any) => {
                const day = item.itiDays || 1;
                if (!daysMap.has(day)) {
                    daysMap.set(day, {
                        day: `${day}일차`,
                        title: item.itiPlaceName || `Day ${day}`,
                        activities: [],
                        meals: { breakfast: '제공', lunch: '제공', dinner: '제공' }
                    });
                }
                const dayObj = daysMap.get(day);
                if (item.itiPlaceName) {
                    dayObj.activities.push(`${item.itiPlaceName} 방문 및 관광`);
                }
            });
            itinerary = Array.from(daysMap.values());
        }

        // --- 6. 호텔(Hotel) 정보 ---
        let hotel = { name: '', address: '' };
        if (dataHotel?.isOK && Array.isArray(dataHotel.result)) {
            const firstHotel = dataHotel.result[0]?.listHotelPlaceData?.[0];
            if (firstHotel) {
                hotel.name = firstHotel.placeNameK || firstHotel.itiPlaceName || '';
                hotel.address = firstHotel.address || '';
            }
        }

        return {
            isProduct: true,
            title: cleanTitle,
            destination: destination,
            price: String(d.sellingPriceAdultTotalAmount || d.adultPrice || '0'),
            departureDate: d.departureDate || d.start_dt || d.departure_dt,
            returnDate: d.arrivalDate || d.end_dt || d.arrival_dt,
            departureAirport: d.departureCityName || d.departureCity || '인천',
            airline: d.transportName || d.carrier_nm || '',
            duration: duration,
            flightCode: d.transportInfo || d.flight_no || d.carrier_no || '',
            departureTime: d.startTime || d.depTm || d.dep_tm || d.strTm || d.str_tm || d.departure_time || '',
            arrivalTime: d.endTime || d.arrTm || d.arr_tm || d.endTm || d.end_tm || d.arrival_time || '',
            returnDepartureTime: d.returnStartTime || d.returnDepTm || d.return_dep_tm || '',
            returnArrivalTime: d.returnEndTime || d.returnArrTm || d.return_arr_tm || '',
            hotel: hotel,
            url: url, // URL 필드 명시적 추가
            itinerary: itinerary,
            keyPoints: keyPoints,
            inclusions: d.includedNote ? [d.includedNote.replace(/<[^>]+>/g, ' ').trim()] : [],
            exclusions: d.unincludedNote ? [d.unincludedNote.replace(/<[^>]+>/g, ' ').trim()] : [],
            cancellationPolicy: d.cancelInform || d.cancelDetail || d.cancelNote || '',
            description: moreInfo
        };
    }
    return { error: `[ModeTour Native] Final check failed.` };
}

async function crawl(url: string, apiKey: string, isConfirmation: boolean = false): Promise<string | null> {
    const isModeTour = url.includes('modetour.com');

    // [Step 1] SSR Try (Fast & Cheap) - Bypass for confirmations to ensure full JS content
    if (!isConfirmation) {
        try {
            console.log('[Edge Crawl] SSR Start');
            const ssrUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=6000`;
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(ssrUrl, { signal: controller.signal });
            clearTimeout(tid);

            if (res.ok) {
                const html = await res.text();
                console.log('[Edge Crawl] SSR Finished, length:', html.length);
                if (html.length > 25000) return html;
            } else {
                console.log('[Edge Crawl] SSR status not ok:', res.status);
            }
        } catch (e: any) {
            console.log('[Edge Crawl] SSR error:', e.name === 'AbortError' ? 'TIMEOUT' : e.message);
        }
    } else {
        console.log('[Edge Crawl] Bypassing SSR for deep confirmation scan');
    }

    // [Step 2] JS Rendering with Scenario (Scroll for dynamic content) - Timeout varies by source
    try {
        console.log(`[Edge Crawl] JS Start (${isConfirmation ? 'Deep' : 'Fast'} Mode)`);

        // 확정서의 경우 더 깊게 스크롤하고 더 오래 기다림
        const jsScenario = isConfirmation ? {
            instructions: [
                { wait: 3500 },
                { scroll_y: 2000 },
                { wait: 2000 },
                { scroll_y: 5000 },
                { wait: 2000 },
                { scroll_y: 8000 },
                { wait: 2000 }
            ]
        } : {
            instructions: [
                { scroll_y: 2000 },
                { wait: 1000 },
                { scroll_y: 5000 }
            ]
        };

        const scenarioStr = JSON.stringify(jsScenario);
        const timeout = isConfirmation ? 25000 : 12000;
        const waitTime = isConfirmation ? 5000 : 1500;

        const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=${waitTime}&js_scenario=${encodeURIComponent(scenarioStr)}&timeout=${timeout}`;

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(sbUrl, { signal: controller.signal });
        clearTimeout(tid);

        if (res.ok) {
            const html = await res.text();
            console.log(`[Edge Crawl] JS Finished. Status: ${res.status}, Length: ${html.length}`);
            if (html.length > 5000) return html;
            console.warn('[Edge Crawl] JS HTML too short, might be blocked or empty');
        } else {
            const errText = await res.text().catch(() => 'N/A');
            console.error(`[Edge Crawl] JS FAILED. Status: ${res.status}, Error: ${errText.substring(0, 100)}`);
            // 만약 401, 403, 429 등 크레딧/인증 문제면 에러를 반환하여 사용자에게 알림
            if (res.status === 401 || res.status === 403 || res.status === 429) {
                throw new Error(`ScrapingBee Error (${res.status}): ${errText.substring(0, 50)}...`);
            }
        }
    } catch (e: any) {
        console.error('[Edge Crawl] JS Fatal Error:', e.name === 'AbortError' ? 'TIMEOUT (22s)' : e.message);
        if (e.message.includes('ScrapingBee Error')) throw e;
    }

    return null;
}

async function analyze(text: string, url: string, nextData: string | undefined, apiKey: string, hints: any = {}): Promise<any | null> {
    const prompt = `다음 여행 상품 페이지 정보를 분석하여 JSON으로 반환하세요.
URL: ${url}
${nextData ? `NEXT_DATA (JSON 일부): ${nextData.substring(0, 10000)}\n` : ''}
${Object.keys(hints).length > 0 ? `[추가 힌트 정보 (매우 중요)]: ${JSON.stringify(hints)}\n` : ''}

반환 형식:
{
  "isProduct": true,
  "title": "상품명",
  "destination": "목적지",
  "price": "가격 (숫자만, 예: 799000)",
  "departureDate": "출발일 (예: 2026-04-18)",
  "departureAirport": "출발 공항 (예: 인천, 김해 등)",
  "airline": "항공사",
  "duration": "여행기간",
  "keyPoints": ["상품 포인트 요약 ('~입니다', '~합니다' 등의 서술어 절대 금지. 반드시 명사형으로 끝나는 짧은 개조식 구문 작성. 예: '특급호텔에서 전일정 숙박', '노쇼핑 일정으로 편안한 여행')"]
}

본문 요약:
${text.substring(0, 35000)}`;

    try {
        const model = 'gemini-flash-latest';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
        });
        const data = await res.json();
        try {
            const resText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!resText) {
                console.error('[AI Analyze] No text in response. Data:', JSON.stringify(data));
                return null;
            }
            const jsonMatch = resText.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch (innerError: any) {
            console.error('[AI Analyze] Parsing Error:', innerError.message, 'Data:', JSON.stringify(data));
            return null;
        }
    } catch (e: any) {
        console.error('[AI Analyze] Error:', e.message || e);
        return null;
    }
}

// ── analyzeForConfirmationEdge (고급 분석) ──
async function analyzeForConfirmationEdge(text: string, url: string, nextData: string | undefined, apiKey: string): Promise<any | null> {
    const prompt = `당신은 여행 확정서 제작 전문가입니다. 아래 내용을 분석하여 '모바일 확정서' 전문을 작성하세요.
URL: ${url}

[중요 지침]
1. 모든 일정(itinerary)의 activities는 본문을 꼼꼼히 읽고 3-5문장으로 상세히 기술하세요. 단순 나열은 금지합니다.
2. 호텔 정보(name, address)를 반드시 찾아내세요. 본문에 없으면 절대 "미정"이나 "연도-월-일" 같은 placeholder를 쓰지 말고, [HINTS]에 있는 데이터를 최우선으로 사용하세요.
3. 비행기 편명과 시간을 반드시 찾아내세요. 시간은 반드시 "09:00" 처럼 HH:MM 형식으로 적으세요. 본문에 없으면 [HINTS] 데이터를 사용하고, 그것도 없으면 비워두세요.
4. 귀국날짜(returnDate)와 호텔 체크아웃 날짜(checkOutDate)를 정확히 계산하여 YYYY-MM-DD 형식으로 적으세요.
5. 'cancellationPolicy' 섹션에 취소 및 환불 규정을 본문에서 찾아 상세히 기술하세요. [HINTS]나 본문에 없어도 여행사 공통 규정을 참고하지 말고 본문에 있는 내용만 적으세요. 없으면 빈 문자열로 두세요.
6. 'notices' 섹션에 유의사항을 10개 이상 아주 풍성하게 작성하세요.
7. JSON 이외의 텍스트는 출력하지 마세요. 답변에는 "연도-월-일"과 같은 가이드 문구를 값으로 넣지 말고 실제 데이터만 넣으세요. 데이터가 없으면 차라리 null 또는 빈 문자열을 넣으세요.
8. 포함/불포함 사항(inclusions, exclusions)을 본문에서 찾아 상세히 리스트업 하세요. 
9. 일차별 meals(조/중/석식) 정보도 본문에서 찾아 "제공", "불포함", "기내식" 등으로 명시하세요.

--- [NEXT_DATA] ---
${nextData ? nextData.substring(0, 25000) : 'N/A'}

--- [CONTENT] ---
${text}

반드시 다음 JSON 형식으로만 답변하세요:
{
  "title": "",
  "destination": "",
  "price": "",
  "departureDate": "",
  "returnDate": "",
  "checkOutDate": "",
  "duration": "",
  "airline": "",
  "flightCode": "",
  "departureAirport": "",
  "departureTime": "",
  "arrivalTime": "",
  "returnDepartureTime": "",
  "returnArrivalTime": "",
  "hotel": { "name": "", "address": "", "amenities": [] },
  "itinerary": [
    {
      "day": "1일차",
      "date": "",
      "title": "",
      "activities": [""],
      "transportation": "",
      "meals": { "breakfast": "", "lunch": "", "dinner": "" }
    }
  ],
  "inclusions": [""],
  "exclusions": [""],
  "cancellationPolicy": "",
  "specialOffers": ["이벤트 특전 1", "이벤트 특전 2"],
  "keyPoints": ["상품 포인트 요약 ('~입니다', '~합니다' 등의 서술어 절대 금지. 반드시 명사형으로 끝나는 짧은 개조식 구문 작성. 예: '특급호텔에서 전일정 숙박', '노쇼핑 일정으로 편안한 여행')"],
  "notices": ["공항 미팅 안내", "준비물 안내"]
}
`;

    async function tryModel(modelName: string) {
        console.log(`[AI Deep] Trying model: ${modelName}`);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 12000
                }
            })
        });
        const data = await res.json();
        if (data.error) {
            console.warn(`[AI Deep] Model ${modelName} returned error:`, data.error.message);
            return { error: data.error };
        }
        return data;
    }

    try {
        let data = await tryModel('gemini-pro-latest');

        // Fallback to flash if pro is limited
        if (data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED' || data.error?.status === 'NOT_FOUND') {
            console.log('[AI Deep] Pro limited or not found, falling back to flash-latest...');
            data = await tryModel('gemini-flash-latest');
        }

        if (data.error) return { error: data.error.message || 'API_ERROR' };

        try {
            const resText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!resText) {
                console.error('[AI Deep] No response candidates:', JSON.stringify(data));
                return { error: 'EMPTY_RESPONSE' };
            }
            const jsonMatch = resText.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'JSON_NOT_FOUND' };
        } catch (innerError: any) {
            console.error('[AI Deep] Parse Error:', innerError.message);
            return { error: 'PARSE_ERROR' };
        }
    } catch (e: any) {
        console.error('[AI Deep] Fatal:', e.message);
        return { error: 'FATAL_ERROR' };
    }
}

export async function POST(request: NextRequest) {
    try {
        const { url, source } = await request.json();
        const sbKey = (process.env.SCRAPINGBEE_API_KEY || '').trim();
        const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

        console.log('[Edge] POST received', {
            version: VERSION,
            url,
            source,
            sbKeyPrefix: sbKey.substring(0, 4),
            geminiKeyPrefix: geminiKey.substring(0, 4)
        });

        if (!sbKey || !geminiKey) return NextResponse.json({ success: false, error: 'API 키 누락' });

        const isConfirmation = source === 'confirmation';

        // 1. ModeTour Native API 시도
        let nativeData = null;
        let nativeError = null;
        if (url.includes('modetour.com')) {
            nativeData = await fetchModeTourNative(url, sbKey);
            if (nativeData?.error) {
                nativeError = nativeData.error;
                nativeData = null;
            }
        }

        // 2. 크롤링 (Native Data가 불충분하거나 없을 때만 필수, 확정서면 웬만하면 크롤링 시도)
        let html: string | null = null;
        if (!nativeData || isConfirmation) {
            console.log(`[Edge] starting crawl... (isConfirmation: ${isConfirmation})`);
            try {
                html = await crawl(url, sbKey, isConfirmation);
            } catch (crawlErr: any) {
                nativeError = crawlErr.message;
                console.error('[Edge] Crawl Critical Error:', crawlErr.message);
            }
            console.log('[Edge] html captured, length:', html?.length || 0);
        }

        if (!html) {
            console.warn('[Edge] crawl returned null/undefined. isNativeDataPresent:', !!nativeData);
            if (nativeData) {
                console.log('[Edge] Falling back to nativeData only');
                let result = await analyze(JSON.stringify(nativeData), url, undefined, geminiKey);

                if (!result || result.error) {
                    console.log('[Edge] AI failed for nativeData fallback, using nativeData as raw');
                    result = { ...nativeData, url };
                } else {
                    result.url = url; // AI 결과에 URL 강제 주입
                    if (!result.title || result.title.includes('실패')) result.title = nativeData.title;
                    if (!result.price || result.price === '가격 문의') result.price = nativeData.price;
                    if (!result.duration) result.duration = nativeData.duration;
                    if (nativeData.airline && !result.airline) result.airline = nativeData.airline;
                    if (nativeData.departureAirport && !result.departureAirport) result.departureAirport = nativeData.departureAirport;
                }

                const formatted = formatProductInfo(result);

                return NextResponse.json({ success: true, data: { raw: result, formatted } });
            }

            // IF Native data failed AND Crawl Failed, that means BOTH failed. 
            // We should give a specific error so the user knows.
            return NextResponse.json({ success: false, error: `수집 실패 (문제 추적 코드: ${nativeError || 'ScrapingBee 한도 초과/알 수 없는 에러'}) URL을 확인해주세요.` });
        }

        // 3. 텍스트 정제 및 힌트 추출
        const { text, nextData } = htmlToText(html, url, isConfirmation);
        console.log('[Debug] cleaned text length:', text.length, 'nextData length:', nextData?.length || 0);

        let hints: any = {};
        if (nextData) {
            try {
                const nextObj = JSON.parse(nextData);
                const pNo = url.match(/package\/(\d+)/i)?.[1] || '';
                hints = {
                    price: extractValRobust(nextObj, 'sellingPriceAdultTotalAmount', pNo),
                    airline: extractValRobust(nextObj, 'transportName', pNo),
                    departureDate: extractValRobust(nextObj, 'departureDate', pNo),
                    returnDate: extractValRobust(nextObj, 'arrivalDate', pNo),
                    duration: extractValRobust(nextObj, 'travelPeriod', pNo),
                    flightCode: extractValRobust(nextObj, 'transportInfo', pNo),
                    departureTime: extractValRobust(nextObj, 'startTime', pNo),
                    arrivalTime: extractValRobust(nextObj, 'endTime', pNo)
                };
            } catch (e) { }
        }

        // 4. 분석
        let result;
        if (isConfirmation) {
            console.log(`[Edge] 확정서 심층 분석 시작 (Text: ${text.length}, source: ${source})`);
            const contextText = `[HINTS]\n${JSON.stringify({ ...nativeData, ...hints })}\n\n${text}`;
            result = await analyzeForConfirmationEdge(contextText, url, nextData, geminiKey);
            console.log(`[Edge] 확정서 심층 분석 성공 여부: ${!result?.error}`);

            if (!result || result.error) {
                console.warn('[Edge] Deep analysis failed, falling back to general:', result?.error);
                result = await analyze(text, url, nextData, geminiKey, { ...nativeData, ...hints });
            }
            if (result && !result.error) result.url = url; // 분석 결과에 URL 주입
        } else {
            console.log(`[Edge] 일반 분석 시작 (Text: ${text.length})`);
            result = await analyze(text, url, nextData, geminiKey, { ...nativeData, ...hints });
            if (result && !result.error) result.url = url; // 분석 결과에 URL 주입
        }

        // 5. 최종 결과 도출
        if (!result || result.error) {
            console.warn('[Edge] AI analysis failed completey');
            if (nativeData) {
                console.log('[Edge] AI failed, returning Native Data only');
                const raw = { ...nativeData, url };
                return NextResponse.json({
                    success: true,
                    data: { raw, formatted: formatProductInfo(raw) + " [V7-N]" }
                });
            }
            return NextResponse.json({ success: false, error: result?.error || '분석 실패' });
        }

        // Native Data로 보강 (원본 API 값이 더 정확할 경우 또는 AI가 placeholder를 반환한 경우)
        if (nativeData) {
            const isPlaceholder = (s: any): boolean => {
                if (!s) return true;
                if (Array.isArray(s)) return s.length === 0 || s.every(item => isPlaceholder(item));
                const str = String(s);
                const lowerStr = str.toLowerCase();
                return str.includes('미상') || str.includes('미정') || str.includes('정보 없음') ||
                    str.includes('연도-월-일') || str.includes('호텔명') || str.includes('주소') ||
                    str.includes('편명') || str.includes('출발공항') || str.includes('박일') ||
                    str.includes('조식') || str.includes('중식') || str.includes('석식') ||
                    str.includes('placeholder') || lowerStr.includes('key point') ||
                    (str.includes('포인트') && str.length > 20) || // 프롬프트 내 가이드 텍스트 방지
                    str.includes('관광포함');
            };

            if (isPlaceholder(result.title) || result.title.includes('실패')) result.title = nativeData.title;
            if (isPlaceholder(result.price) || result.price === '가격 문의') result.price = nativeData.price;
            if (isPlaceholder(result.duration)) result.duration = nativeData.duration;
            if (nativeData.airline && isPlaceholder(result.airline)) result.airline = nativeData.airline;
            if (nativeData.departureAirport && isPlaceholder(result.departureAirport)) result.departureAirport = nativeData.departureAirport;

            if (isPlaceholder(result.cancellationPolicy) && nativeData.cancellationPolicy) {
                result.cancellationPolicy = nativeData.cancellationPolicy;
            }

            // 상품 포인트: AI가 추출한 개조식 포인트를 우선하되, 없으면 네이티브 데이터 사용
            if ((!result.keyPoints || result.keyPoints.length === 0 || isPlaceholder(result.keyPoints)) && nativeData.keyPoints && nativeData.keyPoints.length > 0) {
                result.keyPoints = nativeData.keyPoints;
            }

            if (isConfirmation) {
                if (nativeData.departureDate && isPlaceholder(result.departureDate)) result.departureDate = nativeData.departureDate;
                if (nativeData.returnDate && isPlaceholder(result.returnDate)) result.returnDate = nativeData.returnDate;
                if (nativeData.flightCode && isPlaceholder(result.flightCode)) result.flightCode = nativeData.flightCode;
                if (nativeData.departureTime && isPlaceholder(result.departureTime)) result.departureTime = nativeData.departureTime;
                if (nativeData.arrivalTime && isPlaceholder(result.arrivalTime)) result.arrivalTime = nativeData.arrivalTime;
                if (nativeData.returnDepartureTime && isPlaceholder(result.returnDepartureTime)) result.returnDepartureTime = nativeData.returnDepartureTime;
                if (nativeData.returnArrivalTime && isPlaceholder(result.returnArrivalTime)) result.returnArrivalTime = nativeData.returnArrivalTime;

                // 호텔 정보 보강
                if (!result.hotel) result.hotel = { name: '', address: '', amenities: [] };
                if (nativeData.hotel) {
                    if (isPlaceholder(result.hotel.name)) result.hotel.name = nativeData.hotel.name;
                    if (isPlaceholder(result.hotel.address)) result.hotel.address = nativeData.hotel.address;
                }

                // 체크아웃 날짜 보강
                if (isPlaceholder(result.checkOutDate) && nativeData.returnDate) {
                    result.checkOutDate = nativeData.returnDate;
                }

                if (isPlaceholder(result.cancellationPolicy) && nativeData.cancellationPolicy) {
                    result.cancellationPolicy = nativeData.cancellationPolicy;
                }

                // 상품 포인트: AI 추출 결과 개조식 포맷 최우선
                if ((!result.keyPoints || result.keyPoints.length === 0 || isPlaceholder(result.keyPoints)) && nativeData.keyPoints && nativeData.keyPoints.length > 0) {
                    result.keyPoints = nativeData.keyPoints;
                }
                if (isPlaceholder(result.itinerary) && nativeData.itinerary && nativeData.itinerary.length > 0) {
                    result.itinerary = nativeData.itinerary;
                }

                if ((!result.inclusions || result.inclusions.length === 0) && nativeData.inclusions) result.inclusions = nativeData.inclusions;
                if ((!result.exclusions || result.exclusions.length === 0) && nativeData.exclusions) result.exclusions = nativeData.exclusions;
            }
        }

        const formatted = formatProductInfo(result);

        return NextResponse.json({ success: true, data: { raw: result, formatted: formatted + " [V7]" } });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

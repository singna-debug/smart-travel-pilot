import { NextRequest, NextResponse } from 'next/server';

/**
 * ★ Edge Runtime: Vercel Hobby에서도 30초 사용 가능 ★
 * 수집(ScrapingBee) + 분석(Gemini)을 한 번에 처리하여 네트워크 왕복 제거
 */
export const runtime = 'edge';

// ── htmlToText (Edge 호환) ──
function htmlToText(html: string, url: string, isConfirmation: boolean = false): { text: string, nextData?: string } {
    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) pageTitle = titleMatch[1].trim();

    let targetPrice = '';
    // [추가] 가시적 텍스트에서 가격 추출
    const visibleText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
    const visiblePriceMatch = visibleText.match(/(\d{1,3}(?:,\d{3})+)\s*원/);
    if (visiblePriceMatch) {
        targetPrice = visiblePriceMatch[1].replace(/,/g, '');
    }

    let targetAirline = '';
    const visibleAirlineMatch = visibleText.match(/(제주항공|대한항공|아시아나항공|아시아나|진에어|티웨이항공|티웨이|이스타항공|이스타|에어서울|에어부산|에어프레미아|피치항공|스쿠트|비엣젯|필리핀항공|싱가포르항공|타이항공|ANA|JAL)/);
    if (visibleAirlineMatch) targetAirline = visibleAirlineMatch[1];

    let targetDepartureAirport = '';
    const visibleAirportMatch = visibleText.match(/출발\s*:\s*(인천|김포|김해|부산|대구|제주|청주|무안|광주)/);
    if (visibleAirportMatch) targetDepartureAirport = visibleAirportMatch[1];
    else {
        const generalAirportMatch = visibleText.match(/(인천공항|인천출발|김포공항|김포출발|김해공항|김해출발|부산출발|대구공항|대구출발|청주공항|청주출발|무안출발)/);
        if (generalAirportMatch) targetDepartureAirport = generalAirportMatch[1].replace('공항', '').replace('출발', '');
    }

    let targetDuration = '';
    const durationMatch = html.match(/(\d+)\s*박\s*(\d+)\s*일/);
    if (durationMatch) targetDuration = `${durationMatch[1]}박${durationMatch[2]}일`;

    let targetDepartureDate = '';
    const visibleDateMatch = visibleText.match(/(?:출발일?|일정)\s*[:\-]?\s*(\d{4}[-.]\d{2}[-.]\d{2})/);
    if (visibleDateMatch) {
        targetDepartureDate = visibleDateMatch[1].replace(/\./g, '-');
    }

    let nextData: string | undefined = undefined;
    const startIdx = html.indexOf('<script id="__NEXT_DATA__"');
    if (startIdx !== -1) {
        const jsonStart = html.indexOf('>', startIdx) + 1;
        const jsonEnd = html.indexOf('</script>', jsonStart);
        if (jsonStart !== 0 && jsonEnd !== -1) {
            nextData = html.substring(jsonStart, jsonEnd);
        }
    }

    // [최적화] 전체 텍스트가 너무 길면 토큰 제한에 걸리므로 지능적으로 생략
    // 확정서 제작인 경우(isConfirmation=true) 429 에러 방지를 위해 더 타이트하게 제한
    // 일반 URL 분석인 경우(isConfirmation=false) 품질 유지를 위해 넉넉하게 유지
    let bodyLimit = isConfirmation ? 30000 : 60000;
    let nextDataLimit = isConfirmation ? 25000 : 60000;

    // 둘 다 있을 경우 합쳐서 토큰 제한을 넘지 않게 조절
    if (nextData) {
        // nextData가 너무 거대할 수 있으므로 1차 정리
        if (nextData.length > nextDataLimit) {
            nextData = nextData.substring(0, nextDataLimit);
        }
    }

    const cleanBody = visibleText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim().substring(0, bodyLimit);

    const formattedText = `==== TARGET METADATA START ====
PAGE_TITLE: "${pageTitle}"
TARGET_PRICE: "${targetPrice}"
TARGET_DURATION: "${targetDuration}"
TARGET_AIRLINE: "${targetAirline}"
TARGET_DEPARTURE_AIRPORT: "${targetDepartureAirport}"
TARGET_DEPARTURE_DATE: "${targetDepartureDate}"
==== TARGET METADATA END ====
[CONTENT BODY]
${cleanBody}`;

    return { text: formattedText, nextData };
}

async function fetchModeTourNative(url: string, sbKey?: string): Promise<any> {
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

    try {
        console.log(`[Edge ModeTour] Fetching product info for: ${productNo} with 4s timeout (Direct)`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const [resDetail, resPoints] = await Promise.all([
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers, signal: controller.signal }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`, { headers, signal: controller.signal })
        ]);

        dataDetail = await resDetail.json();
        dataPoints = await resPoints.json();
        clearTimeout(timeoutId);
    } catch (e: any) {
        console.warn(`[Edge ModeTour] Direct fetch failed or blocked: ${e.message}. Attempting Proxy API...`);
        // Proxy Fallback
        if (sbKey) {
            try {
                const proxyDetailUrl = `https://app.scrapingbee.com/api/v1/?api_key=${sbKey}&url=${encodeURIComponent(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`)}&render_js=false&forward_headers=true`;
                const proxyPointsUrl = `https://app.scrapingbee.com/api/v1/?api_key=${sbKey}&url=${encodeURIComponent(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`)}&render_js=false&forward_headers=true`;

                const proxyHeaders = {
                    'Spb-modewebapireqheader': headers.modewebapireqheader,
                    'Spb-referer': headers.referer,
                    'Spb-accept': headers.accept
                };

                const [pResDetail, pResPoints] = await Promise.all([
                    fetch(proxyDetailUrl, { headers: proxyHeaders }),
                    fetch(proxyPointsUrl, { headers: proxyHeaders })
                ]);

                dataDetail = await pResDetail.json();
                dataPoints = await pResPoints.json();

                console.log(`[Edge ModeTour] Proxy API fetch successful!`);
            } catch (proxyError: any) {
                console.error(`[Edge ModeTour] Proxy API fetch also failed: ${proxyError.message}`);
                return null;
            }
        } else {
            console.error('[Edge ModeTour] No ScrapingBee key provided for fallback.');
            return null;
        }
    }

    if (dataDetail && dataDetail.isOK && dataDetail.result) {
        const d = dataDetail.result;

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

        // 4. 상품 포인트 파싱 (사이트 실제 데이터 기반 - 고속)
        let keyPoints: string[] = [];

        // A. 제목 특전
        if (cleanTitle.includes('(')) {
            const inner = cleanTitle.substring(cleanTitle.lastIndexOf('(') + 1, cleanTitle.lastIndexOf(')'));
            const parts = inner.split(/[+\n,]/).filter((s: string) => s.trim().length > 1);
            parts.forEach((p: string) => {
                let point = p.trim();
                if (point.includes('온천')) point = '엄선된 온천 숙박';
                if (point.includes('식사') || point.includes('석식')) point = '호텔 석식/특식 제공';
                if (point.includes('무제한')) point = '주류/음료 무제한';
                keyPoints.push(point);
            });
        }

        // B. Site KeyPointInfo
        if (dataPoints && dataPoints.isOK && Array.isArray(dataPoints.result)) {
            const sitePoints = dataPoints.result
                .filter((p: any) => p.title && p.title.length > 2)
                .map((p: any) => p.title.trim());
            keyPoints = [...keyPoints, ...sitePoints];
        }

        // C. 특징 및 키워드
        if (d.groupBriefKeyword) {
            const keywords = d.groupBriefKeyword.split('#').filter(Boolean).map((k: string) => k.trim());
            keyPoints = [...keyPoints, ...keywords];
        }

        // 중복 제거 및 정리
        keyPoints = Array.from(new Set(keyPoints)).filter(p => p.length > 2).slice(0, 8);

        // 가격 콤마 포맷팅
        const rawPrice = String(d.sellingPriceAdultTotalAmount || '');
        const formattedPrice = rawPrice.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        return {
            isProduct: true,
            title: cleanTitle,
            destination: destination,
            price: formattedPrice,
            departureDate: d.departureDate,
            airline: d.transportName || '',
            duration: duration,
            departureAirport: d.departureCityName || '',
            keyPoints: keyPoints,
            exclusions: d.unincludedNote ? [d.unincludedNote.replace(/<[^>]+>/g, ' ').trim()] : [],
            url: url
        };
    }
    return null;
}

// ── ScrapingBee로 수집 ──
async function crawl(url: string, apiKey: string): Promise<string | null> {
    const isModeTour = url.includes('modetour.com');

    // 1. ModeTour는 SSR(render_js=false)을 먼저 시도하는 것이 압도적으로 빠르고 정보가 충분함
    if (isModeTour) {
        try {
            console.log('[Edge] 수집 시도 (ModeTour): SSR HTML (render_js=false)');
            const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=8000`;
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(sbUrl, { signal: controller.signal });
            clearTimeout(tid);
            if (res.ok) {
                const html = await res.text();
                if (html.length > 5000 && html.includes('__NEXT_DATA__')) {
                    console.log(`[Edge] ModeTour SSR 수집 성공: ${html.length}자 (NEXT_DATA 포함)`);
                    return html;
                }
            }
        } catch (e: any) {
            console.warn('[Edge] ModeTour SSR 1차 시도 실패:', e.message);
        }
    }

    // 2. JS 렌더링 시도 (ModeTour가 아니거나 SSR 정보가 부족할 때)
    try {
        console.log('[Edge] 수집 시도: JS렌더링 (빠른 대기)');
        const jsScenario = encodeURIComponent('{"instructions":[{"wait":1000},{"scroll_y":2000}]}');
        const timeout = isModeTour ? 12000 : 15000;
        const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=1500&js_scenario=${jsScenario}&timeout=${timeout}`;

        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), timeout);
        const res = await fetch(sbUrl, { signal: controller.signal });
        clearTimeout(tid);

        if (res.ok) {
            const html = await res.text();
            if (html.length > 1000 && html.includes('<') && !html.startsWith('{')) {
                console.log(`[Edge] JS 렌더링 수집 성공: ${html.length}자`);
                return html;
            }
        }
    } catch (e: any) {
        console.warn('[Edge] JS 렌더링 시도 실패:', e.name === 'AbortError' ? 'TIMEOUT' : e.message);
    }

    // 3. 최후 수단 (JS 실패 시 일반 SSR 재시도)
    if (!isModeTour) {
        try {
            console.log('[Edge] 수집 시도: SSR HTML (render_js=false) - Fallback');
            const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=6000`;
            const controller = new AbortController();
            const tid = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(sbUrl, { signal: controller.signal });
            clearTimeout(tid);
            if (res.ok) {
                const html = await res.text();
                return html;
            }
        } catch (e: any) { }
    }

    return null;
}

function analyzeWithRegex(text: string, url: string): any {
    const fallback: any = {
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

    return fallback;
}

// ── Gemini로 분석 ──
async function analyze(text: string, url: string, nextData: string | undefined, apiKey: string): Promise<any | null> {
    const safeText = text.replace(/`/g, "'").substring(0, 40000);
    const safeNextData = nextData ? nextData.replace(/`/g, "'").substring(0, 40000) : '';

    let prompt = `다음 여행 상품 페이지에서 정보를 추출하여 JSON으로 반환하세요.
URL: ${url}
${safeNextData ? `--- [중요: NEXT_JS_DATA (JSON 데이터 참조용)] ---\n${safeNextData.substring(0, 15000)}\n` : ''}

반환 형식:
{
  "isProduct": true,
  "title": "METADATA 섹션의 TARGET_TITLE 또는 PAGE_TITLE 중 더 구체적인 것을 그대로 추출 (상품명 전체)",
  "destination": "목적지 (국가+도시)",
  "price": "METADATA 섹션의 TARGET_PRICE 값을 최우선적으로 사용하세요 (숫자만 추출). 없으면 텍스트에서 성인 1인 가격을 찾으세요.",
  "departureDate": "출발일 (YYYY-MM-DD 형식 권장)",
  "airline": "METADATA 섹션의 TARGET_AIRLINE을 최우선으로 사용하세요. 없으면 항공사(티웨이, 제주항공 등) 추출.",
  "duration": "METADATA 섹션의 TARGET_DURATION 값을 최우선으로 사용하세요. 없으면 'X박 Y일' 패턴을 찾으세요.",
  "departureAirport": "METADATA 섹션의 TARGET_DEPARTURE_AIRPORT를 최우선으로 사용하세요. 없으면 텍스트에서 '인천', '부산', '대구' 등 출발지 추출.",
  "keyPoints": ["상품의 핵심 특징 5~7개 요약. 특히 '특전', '식사 업그레이드', '식사 포함여부', '쇼핑조건' 등을 매력적으로 작성하세요."],
  "exclusions": ["불포함 사항 요약"]
}

입력 텍스트:
${safeText.substring(0, 30000)}`;

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8000 }
            })
        });

        const data = await res.json();

        if (data.error && data.error.code === 429) {
            console.warn('[Edge] AI Rate Limit 발생, 정규식으로 복구합니다.');
            return analyzeWithRegex(text, url);
        }

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            return analyzeWithRegex(text, url);
        }

        const resText = data.candidates[0].content.parts[0].text;
        const jsonStr = resText.replace(/```json\s*|\s*```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('[Gemini] 분석 오류, 정규식으로 복구:', e);
        return analyzeWithRegex(text, url);
    }
}

// ── 확정서 전용 깊은 분석 (Edge) ──
async function analyzeForConfirmationEdge(text: string, url: string, nextData: string | undefined, apiKey: string): Promise<any | null> {
    let preExtractedInclusions = '';
    let preExtractedExclusions = '';

    if (nextData) {
        try {
            const dataObj = JSON.parse(nextData);
            function findValues(obj: any, keyMap: string[], results: string[] = []): string[] {
                if (!obj || typeof obj !== 'object') return results;
                for (const k in obj) {
                    if (keyMap.includes(k.toLowerCase()) && typeof obj[k] === 'string') {
                        if (obj[k].length > 10) results.push(obj[k]);
                    }
                    findValues(obj[k], keyMap, results);
                }
                return results;
            }
            const inc = findValues(dataObj, ['includednote', 'incldcn', 'inclddetailcdnm']);
            const exc = findValues(dataObj, ['notincludednote', 'notincldcn', 'notinclddetailcdnm']);
            preExtractedInclusions = inc.join('\\n\\n');
            preExtractedExclusions = exc.join('\\n\\n');
        } catch (e) {
            console.error('nextData parsing error:', e);
        }
    }

    const safeText = text.replace(/`/g, "'").substring(0, 30000);
    const safeNextData = nextData ? nextData.replace(/`/g, "'").substring(0, 30000) : '';

    let prompt = '당신은 여행 상품 웹페이지 전문 분석가입니다.\\n';
    prompt += '아래 여행 상품 페이지의 전체 내용을 분석하여, 모바일 여행 확정서에 필요한 모든 정보를 빠짐없이 추출하세요.\\n\\n';
    prompt += 'URL: ' + url + '\\n\\n';

    if (preExtractedInclusions || preExtractedExclusions) {
        prompt += '--- [시스템 사전 추출 정보] ---\\n';
        prompt += '포함사항 원문: ' + preExtractedInclusions + '\\n';
        prompt += '불포함사항 원문: ' + preExtractedExclusions + '\\n';
        prompt += '----------------------------------\\n';
    }
    if (safeNextData) {
        prompt += '--- [NEXT_JS_DATA] ---\\n' + safeNextData + '\\n';
    }
    prompt += '--- [페이지 전체 내용] ---\\n';
    prompt += safeText + '\\n';
    prompt += '--- [끝] ---\\n\\n';

    prompt += '아래 JSON 형식으로 반환하세요. 페이지에 정보가 없으면 빈 문자열이나 빈 배열로 두세요.\\n\\n';
    prompt += '{\\n';
    prompt += '  "title": "상품명 전체",\\n';
    prompt += '  "destination": "목적지 (국가+도시)",\\n';
    prompt += '  "price": "1인 기준 가격 (숫자만)",\\n';
    prompt += '  "departureDate": "출발일 (YYYY-MM-DD 또는 원본 텍스트)",\\n';
    prompt += '  "returnDate": "귀국일 (YYYY-MM-DD 또는 원본 텍스트)",\\n';
    prompt += '  "duration": "여행기간 (예: 3박5일)",\\n';
    prompt += '  "airline": "항공사명",\\n';
    prompt += '  "flightCode": "편명 (예: 7C201)",\\n';
    prompt += '  "departureAirport": "출발공항",\\n';
    prompt += '  "departureTime": "가는편 출발 시각 (HH:MM) - 본문에서 반드시 찾아주세요",\\n';
    prompt += '  "arrivalTime": "가는편 도착 시각 (HH:MM)",\\n';
    prompt += '  "returnDepartureTime": "오는편 출발 시각 (HH:MM)",\\n';
    prompt += '  "returnArrivalTime": "오는편 도착 시각 (HH:MM)",\\n';
    prompt += '  "hotel": {\\n';
    prompt += '    "name": "대표 호텔명 (한글 명칭)",\\n';
    prompt += '    "englishName": "호텔 영문명",\\n';
    prompt += '    "address": "호텔 상세 주소",\\n';
    prompt += '    "checkIn": "체크인 시간 (예: 14:00)",\\n';
    prompt += '    "checkOut": "체크아웃 시간 (예: 12:00)",\\n';
    prompt += '    "images": ["호텔 이미지 URL 배열"],\\n';
    prompt += '    "amenities": ["시설 및 서비스 목록"]\\n';
    prompt += '  },\\n';
    prompt += '  "itinerary": [\\n';
    prompt += '    {\\n';
    prompt += '      "day": "1일차",\\n';
    prompt += '      "date": "날짜",\\n';
    prompt += '      "title": "일정 제목 (예: 인천 출발 - 다낭 도착)",\\n';
    prompt += '      "activities": ["해당 일자의 핵심 활동 내용 3-5개 요약"],\\n';
    prompt += '      "transportation": "비행기 편명, 출발시간, 도착시간, 소요시간 (예: TW041 21:25 출발 -> 00:40 도착 (5시간 15분 소요))",\\n';
    prompt += '      "hotelDetails": {\\n';
    prompt += '        "name": "해당일 숙박 호텔 한글명",\\n';
    prompt += '        "address": "호텔 상세 주소",\\n';
    prompt += '        "images": ["호텔 이미지 URL 배열"],\\n';
    prompt += '        "amenities": ["시설 목록"],\\n';
    prompt += '        "checkIn": "체크인 시간",\\n';
    prompt += '        "checkOut": "체크아웃 시간"\\n';
    prompt += '      },\\n';
    prompt += '      "meals": {\\n';
    prompt += '        "breakfast": "포함 또는 불포함 또는 기내식",\\n';
    prompt += '        "lunch": "포함 또는 불포함 또는 메뉴명",\\n';
    prompt += '        "dinner": "포함 또는 불포함 또는 메뉴명"\\n';
    prompt += '      },\\n';
    prompt += '      "hotel": "해당일 숙박 호텔 한글명",\\n';
    prompt += '      "dailyNotices": ["해당 일자의 특별 유의사항"]\\n';
    prompt += '    }\\n';
    prompt += '  ],\\n';
    prompt += '  "inclusions": ["포함사항 전체 목록"],\\n';
    prompt += '  "exclusions": ["불포함사항 전체 목록"],\\n';
    prompt += '  "keyPoints": ["상품 핵심 포인트 5~7개"],\\n';
    prompt += '  "specialOffers": ["특전/혜택"],\\n';
    prompt += '  "features": ["상품 특징"],\\n';
    prompt += '  "courses": ["주요 관광 코스"],\\n';
    prompt += '  "notices": ["전체 유의사항"],\\n';
    prompt += '  "cancellationPolicy": "취소/환불 규정",\\n';
    prompt += '  "checklist": ["준비물 목록"]\\n';
    prompt += '}\\n\\n';
    prompt += '중요 지침:\\n';
    prompt += '1. 이모지 사용 절대 금지: 모든 텍스트에서 이모지를 절대 사용하지 마세요. 깔끔한 텍스트만 사용합니다.\\n';
    prompt += '2. 일정표 상세화: 각 일차별 activities는 페이지 내용을 꼼꼼히 읽고 중요한 방문지, 체험 내용을 3-5문장으로 요약하여 작성하세요. 정보가 아코디언(펼치기) 메뉴나 상세 일정 탭 안에 숨어있을 수 있으니 텍스트 전체를 꼼꼼히 분석하세요.\\n';
    prompt += '3. 항공 정보 필수상 추출: 본문에서 "항공사", "편명", "출발시간", "도착시간"을 반드시 찾아내세요. 시간은 반드시 HH:MM 형식(예: 09:15, 23:40)으로 추출해야 합니다. 본문 어딘가에 숫자로 된 시각 정보가 반드시 있으니 절대 놓치지 마세요.\\n';
    prompt += '4. 교통 정보 상세화: transportation 필드에 편명, 출발/도착 시각, 총 소요 시간을 예시 형식에 맞춰 정확히 기입하세요.\\n';
    prompt += '5. 호텔 정보: 호텔 이름은 가능한 한글 정식 명칭을 사용하세요.\\n';
    prompt += '6. JSON만 반환하세요. 다른 설명 텍스트는 제외하세요.';

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8000 }
            })
        });

        const data = await res.json();

        if (data.error && data.error.code === 429) {
            console.warn('[Edge] Deep Analysis: AI Rate Limit (429) 발생');
            return { error: 'RATE_LIMIT' };
        }
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.warn('[Edge] Deep Analysis: 알 수 없는 응답 형식', data);
            return null;
        }

        const resText = data.candidates[0].content.parts[0].text;
        let jsonStr = resText;
        const startIdx = resText.indexOf('{');
        const endIdx = resText.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
            jsonStr = resText.substring(startIdx, endIdx + 1);
        }
        return JSON.parse(jsonStr);
    } catch (e: any) {
        console.error('[Gemini] 확정서 전용 분석 오류:', e);
        return { error: 'DEEP_ANALYSIS_FAILED', details: e.message || String(e) };
    }
}

// ── 메인 핸들러: 수집 + 분석을 한 번에 ──
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url, source } = body;
        if (!url) return NextResponse.json({ success: false, error: 'URL이 필요합니다.' }, { status: 400 });

        const sbKey = process.env.SCRAPINGBEE_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!sbKey) return NextResponse.json({ success: false, error: 'SCRAPINGBEE_API_KEY 미설정' });
        if (!geminiKey) return NextResponse.json({ success: false, error: 'GEMINI_API_KEY 미설정' });

        // [New] ModeTour Fast Path: Native 데이터를 Gemini의 입력값으로 활용하여 품질과 속도 동시 확보
        if (url.includes('modetour.com') && source !== 'confirmation') {
            const nativeResult = await fetchModeTourNative(url, sbKey);
            if (nativeResult) {
                console.log('[Edge] ModeTour Native 데이터를 Gemini 분석에 주입');
                const nativeSummary = `[Native Data Summary]\nTitle: ${nativeResult.title}\nPrice: ${nativeResult.price}\nDates: ${nativeResult.departureDate}\nAirline: ${nativeResult.airline}\nDuration: ${nativeResult.duration}\nKey Points: ${nativeResult.keyPoints.join(', ')}`;

                // 데이터 주입 후 AI 분석 (속도를 위해 즉시 analyze 호출)
                const geminiResult = await analyze(nativeSummary, url, JSON.stringify(nativeResult), geminiKey);
                if (geminiResult) {
                    geminiResult.url = url;
                    const formatted = `[${geminiResult.title}]\n\n* 가격 : ${geminiResult.price}원\n* 지역 : ${geminiResult.destination}\n* 기간 : ${geminiResult.duration}\n\n[상품 포인트]\n${geminiResult.keyPoints ? geminiResult.keyPoints.map((p: string) => `- ${p}`).join('\n') : ''}`;

                    return NextResponse.json({
                        success: true,
                        data: {
                            raw: geminiResult,
                            formatted: formatted,
                            recommendation: ''
                        }
                    });
                }
            }
        }

        // 1. 수집
        const html = await crawl(url, sbKey);
        if (!html) {
            return NextResponse.json({ success: false, error: '데이터 수집에 실패했습니다. URL을 확인해주세요.' });
        }

        // 2. 텍스트 정제
        const { text: cleanedText, nextData } = htmlToText(html, url, source === 'confirmation');

        // 3. AI 분석 (source에 따라 라우팅)
        let result;
        if (source === 'confirmation') {
            console.log('[Edge] 확정서 전용 깊은 분석(analyzeForConfirmationEdge) 호출');
            result = await analyzeForConfirmationEdge(cleanedText, url, nextData, geminiKey);
            if (result && result.error === 'RATE_LIMIT') {
                return NextResponse.json({ success: false, error: 'AI 분석 한도를 초과했습니다 (1분당 요청 수 제한). 약 1분 후 다시 시도해주세요.' }, { status: 429 });
            }
            if (result && result.error === 'DEEP_ANALYSIS_FAILED') {
                let detailStr = '';
                try { detailStr = typeof result.details === 'object' ? JSON.stringify(result.details) : String(result.details); } catch (e) { }
                return NextResponse.json({ success: false, error: `분석 실패. (상세: ${detailStr.substring(0, 150)})`, details: result.details });
            }
            if (!result) { // Fallback to shallow if deep fails
                console.log('[Edge] 깊은 분석 실패, 얕은 분석으로 Fallback');
                result = await analyze(cleanedText, url, nextData, geminiKey);
            }
        } else {
            result = await analyze(cleanedText, url, nextData, geminiKey);
        }

        if (!result) {
            return NextResponse.json({ success: false, error: 'AI 분석에 실패했습니다.' });
        }

        result.url = url;
        const formattedText = `[${result.title}]\n\n* 가격 : ${result.price}원\n* 지역 : ${result.destination}\n* 기간 : ${result.duration}\n\n[상품 포인트]\n${result.keyPoints ? result.keyPoints.map((p: string) => `- ${p}`).join('\n') : ''}`;

        return NextResponse.json({
            success: true,
            data: {
                raw: result,
                formatted: formattedText,
                recommendation: ''
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

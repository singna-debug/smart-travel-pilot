import { NextRequest, NextResponse } from 'next/server';

/**
 * ★ Edge Runtime: Vercel Hobby에서도 30초 사용 가능 ★
 * 수집(ScrapingBee) + 분석(Gemini)을 한 번에 처리하여 네트워크 왕복 제거
 */
export const runtime = 'edge';

// ── htmlToText (Edge 호환) ──
function htmlToText(html: string, url: string): { text: string, nextData?: string } {
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

    const cleanBody = visibleText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim().substring(0, 50000);

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

async function fetchModeTourNative(url: string): Promise<any> {
    const productNoMatch = url.match(/package\/(\d+)/i) || url.match(/Pnum=(\d+)/i);
    if (!productNoMatch) return null;
    const productNo = productNoMatch[1];

    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json'
    };

    try {
        console.log(`[Edge ModeTour] Fetching product info for: ${productNo} with 4s timeout`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const [resDetail, resPoints] = await Promise.all([
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers, signal: controller.signal }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`, { headers, signal: controller.signal })
        ]);

        const [dataDetail, dataPoints] = await Promise.all([resDetail.json() as any, resPoints.json() as any]);
        clearTimeout(timeoutId);

        if (dataDetail.isOK && dataDetail.result) {
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
            if (dataPoints && dataPoints.isOK && dataPoints.result) {
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
    } catch (e) {
        console.error('[Edge ModeTour] Native Fetch error:', e);
    }
    return null;
}

// ── ScrapingBee로 수집 ──
async function crawl(url: string, apiKey: string): Promise<string | null> {
    // Attempt 1: JS 렌더링 최우선 시도 (단, 대기 시간을 최소화하여 속도 확보)
    try {
        console.log('[Edge] 수집 시도: JS렌더링 (빠른 대기)');
        const jsScenario = encodeURIComponent('{"instructions":[{"wait":1000},{"scroll_y":2000},{"wait":500},{"scroll_y":5000}]}');
        // wait을 2000으로 줄여서 속도 대폭 개선
        const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=2000&js_scenario=${jsScenario}&timeout=15000`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 15000);
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
        console.warn('[Edge] Attempt 1 (JS) 실패:', e.name === 'AbortError' ? 'TIMEOUT' : e.message);
    }

    // Attempt 2: SSR HTML (JS 렌더링 실패 시 최후 수단)
    try {
        console.log('[Edge] 수집 시도: SSR HTML (render_js=false)');
        const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=8000`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(sbUrl, { signal: controller.signal });
        clearTimeout(tid);
        if (res.ok) {
            const html = await res.text();
            if (html.length > 1000 && html.includes('<') && !html.startsWith('{')) {
                console.log(`[Edge] SSR 수집 성공: ${html.length}자`);
                return html;
            }
        }
    } catch (e: any) {
        console.warn('[Edge] Attempt 2 (SSR) 실패:', e.name === 'AbortError' ? 'TIMEOUT' : e.message);
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
  "keyPoints": ["상품의 핵심 특징 5~7개 요약"],
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

// ── 메인 핸들러: 수집 + 분석을 한 번에 ──
export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();
        if (!url) return NextResponse.json({ success: false, error: 'URL이 필요합니다.' }, { status: 400 });

        const sbKey = process.env.SCRAPINGBEE_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!sbKey) return NextResponse.json({ success: false, error: 'SCRAPINGBEE_API_KEY 미설정' });
        if (!geminiKey) return NextResponse.json({ success: false, error: 'GEMINI_API_KEY 미설정' });

        // [New] ModeTour Fast Path: 브라우저 렌더링 없이 즉시 분석 (1초 이내)
        if (url.includes('modetour.com')) {
            const nativeResult = await fetchModeTourNative(url);
            if (nativeResult) {
                console.log('[Edge] ModeTour Native 분석 성공');
                const formatted = `[${nativeResult.title}]\n\n* 가격 : ${nativeResult.price}원\n* 출발일 : ${nativeResult.departureDate}\n* 항공 : ${nativeResult.airline}\n* 지역 : ${nativeResult.destination}\n* 기간 : ${nativeResult.duration}\n\n[상품 포인트]\n${nativeResult.keyPoints.map((p: string) => `- ${p}`).join('\n')}`;

                return NextResponse.json({
                    success: true,
                    data: {
                        raw: nativeResult,
                        formatted: formatted,
                        recommendation: ''
                    }
                });
            }
        }

        // 1. 수집
        const html = await crawl(url, sbKey);
        if (!html) {
            return NextResponse.json({ success: false, error: '데이터 수집에 실패했습니다. URL을 확인해주세요.' });
        }

        // 2. 텍스트 정제
        const { text: cleanedText, nextData } = htmlToText(html, url);

        // 3. AI 분석
        const result = await analyze(cleanedText, url, nextData, geminiKey);
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

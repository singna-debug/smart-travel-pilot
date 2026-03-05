import { NextRequest, NextResponse } from 'next/server';

/**
 * ★ Edge Runtime: Vercel Hobby에서도 30초 사용 가능 ★
 * 수집(ScrapingBee) + 분석(Gemini)을 한 번에 처리하여 네트워크 왕복 제거
 */
export const runtime = 'edge';

// ── htmlToText (Edge 호환) ──
function htmlToText(html: string): string {
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

    const cleanBody = visibleText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim().substring(0, 50000);

    return `[METADATA]
PAGE_TITLE: ${pageTitle}
TARGET_PRICE: ${targetPrice}
TARGET_DURATION: ${targetDuration}
TARGET_AIRLINE: ${targetAirline}
TARGET_DEPARTURE_AIRPORT: ${targetDepartureAirport}
[CONTENT]
${cleanBody}`;
}

// ── ScrapingBee로 수집 ──
async function crawl(url: string, apiKey: string): Promise<string | null> {
    // Attempt 1: SSR HTML 먼저 시도 (__NEXT_DATA__ 확보를 위해)
    try {
        console.log('[Edge] 수집 시도: SSR HTML (render_js=false)');
        const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=10000`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 10000);
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
        console.warn('[Edge] Attempt 1 실패:', e.name === 'AbortError' ? 'TIMEOUT' : e.message);
    }

    // Attempt 2: JS 렌더링 (동적 콘텐츠 필요 시, 12초)
    try {
        console.log('[Edge] 수집 시도: JS렌더링');
        const jsScenario = encodeURIComponent('{"instructions":[{"wait":2000},{"scroll_y":2000},{"wait":1500},{"scroll_y":4000},{"wait":1500},{"scroll_y":6000}]}');
        const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=networkidle2&js_scenario=${jsScenario}&timeout=12000`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 12000);
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
        console.warn('[Edge] Attempt 2 실패:', e.name === 'AbortError' ? 'TIMEOUT' : e.message);
    }

    return null;
}

// ── Gemini로 분석 ──
async function analyze(text: string, url: string, nextData: string | undefined, apiKey: string): Promise<any | null> {
    const safeText = text.replace(/`/g, "'").substring(0, 40000);
    const safeNextData = nextData ? nextData.replace(/`/g, "'").substring(0, 40000) : '';

    let prompt = '당신은 여행 상품 웹페이지 전문 분석가입니다.\n';
    prompt += '아래 여행 상품 페이지의 전체 내용을 분석하여, 모바일 여행 확정서에 필요한 모든 정보를 빠짐없이 추출하세요.\n\n';
    prompt += 'URL: ' + url + '\n\n';

    if (safeNextData) {
        prompt += '--- [NEXT_JS_DATA] ---\n' + safeNextData + '\n';
    }
    prompt += '--- [페이지 전체 내용] ---\n' + safeText + '\n--- [끝] ---\n\n';

    prompt += '아래 JSON 형식으로 반환하세요. 페이지에 정보가 없으면 빈 문자열이나 빈 배열로 두세요.\n\n';
    prompt += '{\n';
    prompt += '  "title": "METADATA 섹션의 PAGE_TITLE을 우선적으로 사용 (상품명 전체)",\n';
    prompt += '  "destination": "목적지 (국가+도시)",\n';
    prompt += '  "price": "METADATA 섹션의 TARGET_PRICE 값을 최우선적으로 사용하세요 (숫자만)",\n';
    prompt += '  "departureDate": "출발일 (YYYY-MM-DD 또는 원본 텍스트)",\n';
    prompt += '  "returnDate": "귀국일 (YYYY-MM-DD 또는 원본 텍스트)",\n';
    prompt += '  "duration": "METADATA 섹션의 TARGET_DURATION 값을 최우선적으로 사용하세요 (예: 3박5일)",\n';
    prompt += '  "airline": "METADATA 섹션의 TARGET_AIRLINE 값을 최우선적으로 사용하세요",\n';
    prompt += '  "flightCode": "편명 (예: 7C201)",\n';
    prompt += '  "departureAirport": "METADATA 섹션의 TARGET_DEPARTURE_AIRPORT 값을 최우선적으로 사용하세요",\n';
    prompt += '  "departureTime": "가는편 출발 시각 (HH:MM)",\n';
    prompt += '  "arrivalTime": "가는편 도착 시각 (HH:MM)",\n';
    prompt += '  "returnDepartureTime": "오는편 출발 시각 (HH:MM)",\n';
    prompt += '  "returnArrivalTime": "오는편 도착 시각 (HH:MM)",\n';
    prompt += '  "hotel": { "name": "호텔명", "englishName": "영문명", "address": "주소", "checkIn": "14:00", "checkOut": "12:00", "images": [], "amenities": [] },\n';
    prompt += '  "itinerary": [{ "day": "1일차", "date": "", "title": "일정 제목", "activities": ["활동 3-5개"], "transportation": "편명 출발->도착", "meals": { "breakfast": "", "lunch": "", "dinner": "" }, "hotel": "호텔명", "dailyNotices": [] }],\n';
    prompt += '  "inclusions": ["포함사항"],\n';
    prompt += '  "exclusions": ["불포함사항"],\n';
    prompt += '  "keyPoints": ["핵심 포인트 5~7개"],\n';
    prompt += '  "notices": ["유의사항"],\n';
    prompt += '  "cancellationPolicy": "취소/환불 규정",\n';
    prompt += '  "checklist": ["준비물"],\n';
    prompt += '  "meetingInfo": [{ "type": "미팅장소", "location": "장소명", "time": "미팅시간", "description": "상세설명", "imageUrl": "관련 이미지 URL" }]\n';
    prompt += '}\n\n';
    prompt += '중요: 1. 이모지 절대 금지 2. 항공시간 HH:MM 필수 3. JSON만 반환';

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
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) return null;

        const resText = data.candidates[0].content.parts[0].text;
        const jsonStr = resText.replace(/```json\s*|\s*```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('[Gemini] 분석 오류:', e);
        return null;
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

        // 1. 수집
        const html = await crawl(url, sbKey);
        if (!html) {
            return NextResponse.json({ success: false, error: '데이터 수집에 실패했습니다. URL을 확인해주세요.' });
        }

        // 2. 텍스트 정제
        const cleanedText = htmlToText(html);
        let nextData: string | undefined = undefined;
        const startIdx = html.indexOf('<script id="__NEXT_DATA__"');
        if (startIdx !== -1) {
            const jsonStart = html.indexOf('>', startIdx) + 1;
            const jsonEnd = html.indexOf('</script>', jsonStart);
            if (jsonStart !== 0 && jsonEnd !== -1) {
                nextData = html.substring(jsonStart, jsonEnd);
            }
        }

        // 3. AI 분석
        const result = await analyze(cleanedText, url, nextData, geminiKey);
        if (!result) {
            return NextResponse.json({ success: false, error: 'AI 분석에 실패했습니다.' });
        }

        result.url = url;
        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

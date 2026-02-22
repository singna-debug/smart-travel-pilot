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

    let ogTitle = '';
    const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["'](.*?)["']\s*\/?>/i);
    if (ogMatch) ogTitle = ogMatch[1].trim();

    let targetTitle = '';
    const jsonTitleMatch = html.match(/["'](?:GoodsName|PrdName|prd_nm|title|goods_name)["']\s*:\s*["'](.*?)["']/i);
    if (jsonTitleMatch) targetTitle = jsonTitleMatch[1].trim();

    let targetPrice = '';
    const jsonPriceMatch = html.match(/["'](?:Price|SalePrice|goodsPrice|GoodsPrice|ProductPrice_Adult)["']\s*[:=]\s*["']?(\d+)["']?/i);
    if (jsonPriceMatch) targetPrice = jsonPriceMatch[1];

    let targetDuration = '';
    const durationMatch = html.match(/(\d+)\s*박\s*(\d+)\s*일/);
    if (durationMatch) targetDuration = `${durationMatch[1]}박${durationMatch[2]}일`;

    let finalTitle = targetTitle || ogTitle || pageTitle;

    let processed = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

    const cleanBody = processed.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim().substring(0, 50000);

    return `[METADATA]\nPAGE_TITLE: ${finalTitle}\nTARGET_PRICE: ${targetPrice}\nTARGET_DURATION: ${targetDuration}\n[CONTENT]\n${cleanBody}`;
}

// ── ScrapingBee로 수집 ──
async function crawl(url: string, apiKey: string): Promise<string | null> {
    // Attempt 1: JS 렌더링 (시나리오 포함, 15초)
    try {
        console.log('[Edge] 수집 시도: JS렌더링 (시나리오 포함)');
        // 1초 대기 -> 스크롤 -> 1초 대기 -> 스크롤 -> 1초 대기로 동적 콘텐츠 및 상세 일정표 로드 유도
        const jsScenario = encodeURIComponent('{"instructions":[{"wait":1000},{"scroll_y":2000},{"wait":1000},{"scroll_y":3000},{"wait":1000}]}');
        const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&js_scenario=${jsScenario}&timeout=20000`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 16000);
        const res = await fetch(sbUrl, { signal: controller.signal });
        clearTimeout(tid);
        if (res.ok) {
            const html = await res.text();
            if (html.length > 1000) {
                console.log(`[Edge] 수집 성공: ${html.length}자`);
                return html;
            }
        }
    } catch (e: any) {
        console.warn('[Edge] Attempt 1 실패:', e.name === 'AbortError' ? 'TIMEOUT' : e.message);
    }

    // Attempt 2: JS 없이 직접 수집 (5초)
    try {
        console.log('[Edge] 수집 시도: 직접 수집');
        const sbUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=8000`;
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(sbUrl, { signal: controller.signal });
        clearTimeout(tid);
        if (res.ok) {
            const html = await res.text();
            if (html.length > 500) {
                console.log(`[Edge] 직접 수집 성공: ${html.length}자`);
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
    prompt += '  "title": "상품명 전체",\n';
    prompt += '  "destination": "목적지 (국가+도시)",\n';
    prompt += '  "price": "1인 기준 가격 (숫자만)",\n';
    prompt += '  "departureDate": "출발일 (YYYY-MM-DD 또는 원본 텍스트)",\n';
    prompt += '  "returnDate": "귀국일 (YYYY-MM-DD 또는 원본 텍스트)",\n';
    prompt += '  "duration": "여행기간 (예: 3박5일)",\n';
    prompt += '  "airline": "항공사명",\n';
    prompt += '  "flightCode": "편명 (예: 7C201)",\n';
    prompt += '  "departureAirport": "출발공항",\n';
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
    prompt += '  "checklist": ["준비물"]\n';
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

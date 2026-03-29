import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { performance } from 'perf_hooks';

function htmlToText(html: string, url: string): { text: string, nextData?: string } {
    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) pageTitle = titleMatch[1].trim();

    let targetPrice = '';
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

async function crawl(url: string, apiKey: string): Promise<string | null> {
    try {
        console.log('[Edge] 수집 시도: JS렌더링 (빠른 대기)');
        const jsScenario = encodeURIComponent('{"instructions":[{"wait":1000},{"scroll_y":2000},{"wait":500},{"scroll_y":5000}]}');
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
    console.log('[Fallback] Regex Parser Engaged');
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
        console.log('[Gemini] Requesting with prompt length:', prompt.length);
        const t0 = performance.now();
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8000 }
            })
        });

        const data = await res.json();
        const t1 = performance.now();
        console.log(`[Gemini] Response received in ${(t1 - t0).toFixed(0)} ms`);

        if (data.error && data.error.code === 429) {
            console.warn('[Edge] AI Rate Limit 발생, 정규식으로 복구합니다.');
            return analyzeWithRegex(text, url);
        }

        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.log('[Gemini] Empty response data:', JSON.stringify(data).substring(0, 200));
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

async function run() {
    const url = 'https://www.modetour.com/package/100634999?MLoc=99&Pnum=100634999&ANO=81440&sno=C117876&thru=';
    const sbKey = process.env.SCRAPINGBEE_API_KEY as string;
    const geminiKey = process.env.GEMINI_API_KEY as string;

    const t0 = performance.now();
    const html = await crawl(url, sbKey);
    const t1 = performance.now();
    console.log(`[Timeline] Crawl complete in ${(t1 - t0).toFixed(0)} ms`);

    if (!html) {
        console.error('Crawl failed');
        return;
    }

    const { text: cleanedText, nextData } = htmlToText(html, url);
    const t2 = performance.now();
    const result = await analyze(cleanedText, url, nextData, geminiKey);
    const t3 = performance.now();
    console.log(`[Timeline] Analyze complete in ${(t3 - t2).toFixed(0)} ms`);

    console.log(JSON.stringify(result, null, 2));
}

run();

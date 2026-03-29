
import * as iconv from 'iconv-lite';
import type { DetailedProductInfo } from '../types';

export const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

export function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function quickFetch(url: string, retries = 1): Promise<{ html: string; title: string }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10초로 증개

        const response = await fetch(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.modetour.com/',
                'Origin': 'https://www.modetour.com'
            },
            signal: controller.signal,
            cache: 'no-store'
        });

        clearTimeout(timeout);
        if (!response.ok) {
            console.error(`[quickFetch] HTTP Error ${response.status} for ${url}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';

        let html = '';
        if (contentType.toLowerCase().includes('euc-kr')) {
            html = iconv.decode(Buffer.from(buffer), 'euc-kr');
        } else {
            const tempText = new TextDecoder('utf-8').decode(buffer);
            if (tempText.includes('charset=euc-kr') || tempText.includes('charset=EUC-KR') || tempText.includes('CP949')) {
                html = iconv.decode(Buffer.from(buffer), 'euc-kr');
            } else {
                html = tempText;
            }
        }

        let title = '';
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        return { html, title };
    } catch (error: any) {
        console.error(`[quickFetch] Error fetching ${url}: ${error.message || error}`);
        if (retries > 0) {
            console.log(`[quickFetch] Retrying... (${retries} left)`);
            await sleep(1500);
            return quickFetch(url, retries - 1);
        }
        return { html: '', title: '' };
    }
}

export function htmlToText(html: string, url?: string): string {
    let finalTitle = '';
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) finalTitle = titleMatch[1].trim();

    let targetPrice = '';
    const jsonPriceMatch = html.match(/["'](?:Price|SalePrice|goodsPrice|sellingPriceAdultTotalAmount)["']\s*[:=]\s*["']?(\d+)["']?/i);
    if (jsonPriceMatch) targetPrice = jsonPriceMatch[1];

    let targetAirline = '';
    const airlineMatch = html.match(/(제주항공|대한항공|아시아나항공|진에어|티웨이|이스타|에어서울|에어부산|비엣젯|필리핀항공)/);
    if (airlineMatch) targetAirline = airlineMatch[1];

    let targetDeparture = '';
    let targetReturn = '';
    const datePattern = /(\d{4})[-\.\/](\d{1,2})[-\.\/](\d{1,2})/;
    const dateMatches = html.match(new RegExp(datePattern.source, 'g'));
    if (dateMatches && dateMatches.length >= 2) {
        targetDeparture = dateMatches[0];
        targetReturn = dateMatches[dateMatches.length - 1];
    } else if (dateMatches && dateMatches.length === 1) {
        targetDeparture = dateMatches[0];
    }

    const cleanBody = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>|<\/div>|<\/li>|<\/h\d>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

    const metadata = `==== TARGET METADATA START ====
TARGET_TITLE: "${finalTitle}"
TARGET_PRICE: "${targetPrice}"
TARGET_AIRLINE: "${targetAirline}"
TARGET_DEPARTURE_DATE: "${targetDeparture}"
TARGET_RETURN_DATE: "${targetReturn}"
URL: "${url}"
==== TARGET METADATA END ====`;

    return `${metadata}\n\n${cleanBody.substring(0, 30000)}`;
}

export async function analyzeWithGemini(contextOrPrompt: string, url: string, isSummaryOnly = false, nextData?: string): Promise<DetailedProductInfo | null> {
    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    const apiKeys = rawKeys.split(',').map(k => k.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    if (apiKeys.length === 0) return null;

    let prompt = contextOrPrompt;

    if (isSummaryOnly) {
        const instruction = `
[MISSION]
여행 상품 정보를 분석하여 JSON 형식으로 반환하세요.
특히 'keyPoints'는 상품의 장점, 특전(Benefits), 매력적인 소구점들을 간결하고 매력적인 '개조식'(bullet-point style)으로 요약하여 작성해야 합니다.

[OUTPUT FORMAT]
{
  "isProduct": true,
  "title": "상품명",
  "price": "가격(숫자만)",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "departureAirport": "출발공항",
  "airline": "항공사명",
  "destination": "여행지/지역 (예: 나트랑, 판랑, 달랏)",
  "duration": "여행기간 (예: 3박5일)",
  "keyPoints": [
    "전 일정 특급 호텔 숙박 및 여유로운 자유시간 보장",
    "현지 맛집 탐방 및 $50 상당의 야시장 바우처 제공",
    "노쇼핑/노옵션으로 부담 없는 깔끔한 패키지 구성",
    "판랑 사막 지프차 투어 및 이국적인 풍경 감상",
    "핵심 포인트 5"
  ]
}

[RULES]
1. keyPoints는 반드시 4개~6개 사이로 작성하세요.
2. 각 포인트는 상품의 '장점(Advantages)', '특전(Perks/Benefits)', '매력포인트(Attractive Points)'를 우선적으로 포함하세요.
3. 단순히 코스를 나열하기보다, 이 상품이 왜 좋은지(예: 호텔 업그레이드, 전 일정 식사 포함, 인기 관광지 포함 등)를 강조하세요.
4. 불필요한 서술형 없이 '개조식'으로 간결하고 매력적으로 작성하세요.

[DATA]
${contextOrPrompt.substring(0, 30000)}
`;
        prompt = instruction;
    }

    if (nextData) {
        prompt += `\n\n[보조 데이터: NEXT_DATA]\n${nextData.substring(0, 15000)}`;
    }

    try {
        for (const key of apiKeys) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            thinkingConfig: { thinkingBudget: 0 }
                        }
                    })
                });

                if (!response.ok) {
                    const errBody = await response.text();
                    console.error(`[Gemini Error] HTTP ${response.status}: ${errBody.substring(0, 200)}`);
                    continue;
                }

                const data = await response.json();
                if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const resText = data.candidates[0].content.parts[0].text;
                    const jsonStr = resText.replace(/```json\s*|\s*```/g, '').trim();
                    try {
                        return JSON.parse(jsonStr);
                    } catch (e) {
                        console.error('[Gemini] JSON Parse Error. Raw response (first 500):', jsonStr.substring(0, 500));
                        // JSON이 불완전할 수 있으므로, 중괄호로 시작하고 끝나는 부분만 추출 시도
                        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            try {
                                return JSON.parse(jsonMatch[0]);
                            } catch (e2) {
                                console.error('[Gemini] Secondary JSON Parse also failed.');
                            }
                        }
                        return null;
                    }
                }
            } catch (innerError: any) {
                console.error('[Gemini] Inner Error:', innerError?.message || innerError);
            }
        }
    } catch (outerError: any) {
        console.error('[Gemini] Outer Error:', outerError?.message || outerError);
    }
    return null;
}

export function formatDateString(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '미정') return dateStr;
    let cleanDate = dateStr.trim();
    if (cleanDate.includes('T')) cleanDate = cleanDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return cleanDate;

    const digitsOnly = cleanDate.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 8 && /^\d+$/.test(digitsOnly)) {
        const year = digitsOnly.substring(0, 4);
        const month = digitsOnly.substring(4, 6);
        const day = digitsOnly.substring(6, 8);
        return `${year}-${month}-${day}`;
    }

    const match = cleanDate.match(/(\d{2,4})[-\.\/년\s]?\s*(\d{1,2})[-\.\/월\s]?\s*(\d{1,2})/);
    if (match) {
        let year = match[1];
        if (year.length === 2) year = `20${year}`;
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}

export function formatDurationString(durationStr: string): string {
    if (!durationStr || durationStr.trim() === '미정' || durationStr === '""') return '미정';
    let str = durationStr.trim().replace(/"/g, '');

    if (/^\d+박\s*\d+일/.test(str)) return str;

    const boxDayMatch = str.match(/(\d+)\s*박\s*(\d+)\s*일/);
    if (boxDayMatch) return `${boxDayMatch[1]}박 ${boxDayMatch[2]}일`;

    const onlyDayMatch = str.match(/(\d+)\s*일/);
    if (onlyDayMatch) {
        const days = parseInt(onlyDayMatch[1], 10);
        if (days > 1) return `${days - 1}박 ${days}일`;
        if (days === 1) return `당일`;
    }

    const onlyBoxMatch = str.match(/^(\d+)\s*박/);
    if (onlyBoxMatch) {
        const nights = parseInt(onlyBoxMatch[1], 10);
        return `${nights}박 ${nights + 1}일`;
    }
    return str.replace(/\s+/g, '');
}

export const AIRLINE_MAP: Record<string, string> = {
    '7C': '제주항공', 'KE': '대한항공', 'OZ': '아시아나', 'LJ': '진에어',
    'TW': '티웨이', 'ZE': '이스타', 'RS': '에어서울', 'BX': '에어부산'
};

export function fallbackParse(text: string): DetailedProductInfo {
    const titleMatch = text.match(/TARGET_TITLE:\s*"([^"]+)"/);
    const airlineMatch = text.match(/TARGET_AIRLINE:\s*"([^"]+)"/);
    return {
        title: titleMatch ? titleMatch[1] : '추출 실패',
        airline: airlineMatch ? airlineMatch[1] : '',
        url: ''
    } as any;
}

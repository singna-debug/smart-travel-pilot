
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
        const timeout = setTimeout(() => controller.abort(), 12000); // 12초로 증대

        const response = await fetch(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.modetour.com/',
                'Origin': 'https://www.modetour.com',
                'Sec-Ch-Ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'cross-site',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1'
            },
            signal: controller.signal
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
            await sleep(2000);
            return quickFetch(url, retries - 1);
        }
        return { html: '', title: '' };
    }
}

export function htmlToText(html: string, url?: string): string {
    let finalTitle = '';
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) finalTitle = titleMatch[1].trim();

    // [정밀 추출] 모두투어 전용 데이터 패턴 (날짜, 가격, 항공)
    let targetPrice = '';
    const pricePatterns = [
        /["']sellingPriceAdultTotalAmount["']\s*[:=]\s*["']?(\d+)["']?/i,
        /["']p_sellingprice["']\s*[:=]\s*["']?(\d+)["']?/i,
        /["']salePrice["']\s*[:=]\s*["']?(\d+)["']?/i,
        /TARGET_PRICE:\s*"(\d+)"/
    ];
    for (const p of pricePatterns) {
        const m = html.match(p);
        if (m) { targetPrice = m[1]; break; }
    }

    let targetAirline = '';
    const airlineMatch = html.match(/(제주항공|대한항공|아시아나항공|진에어|티웨이|이스타|에어서울|에어부산|비엣젯|필리핀항공)/);
    if (airlineMatch) targetAirline = airlineMatch[1];

    // [정밀 추출] 출발일/귀국일 (p_startday, p_endday 등 우선)
    let targetDeparture = '';
    let targetReturn = '';
    
    // 1순위: JSON 데이터 패턴
    const depMatch = html.match(/["'](?:p_startday|departureDate|startDay)["']\s*[:=]\s*["'](\d{4}-\d{2}-\d{2})["']/i);
    const arrMatch = html.match(/["'](?:p_endday|arrivalDate|endDay)["']\s*[:=]\s*["'](\d{4}-\d{2}-\d{2})["']/i);
    
    if (depMatch) targetDeparture = depMatch[1];
    if (arrMatch) targetReturn = arrMatch[1];

    // 2순위: 8자리 연속 숫자 (YYYYMMDD) - 모두투어 API 특화
    if (!targetDeparture || !targetReturn) {
        const dateMatchLong = html.match(/["'](?:P_StartDay|P_EndDay)["']\s*[:=]\s*["'](\d{8})["']/gi);
        if (dateMatchLong && dateMatchLong.length >= 2) {
            const d1 = dateMatchLong[0].match(/\d{8}/)?.[0];
            const d2 = dateMatchLong[dateMatchLong.length - 1].match(/\d{8}/)?.[0];
            if (d1) targetDeparture = `${d1.slice(0, 4)}-${d1.slice(4, 6)}-${d1.slice(6, 8)}`;
            if (d2) targetReturn = `${d2.slice(0, 4)}-${d2.slice(4, 6)}-${d2.slice(6, 8)}`;
        }
    }

    // 3순위 (Fallback): 일반 날짜 패턴 (충돌 방지를 위해 본문 상단 20%만 검색)
    if (!targetDeparture) {
        const dateMatches = html.substring(0, 10000).match(/(\d{4})[-\.\/](\d{1,2})[-\.\/](\d{1,2})/g);
        if (dateMatches && dateMatches.length >= 2) {
            targetDeparture = dateMatches[0].replace(/[\.\/]/g, '-');
            targetReturn = dateMatches[dateMatches.length - 1].replace(/[\.\/]/g, '-');
        }
    }

    const cleanBody = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '') // 헤더 제거 (메뉴 등 잡음)
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '') // 푸터 제거 (카피라이트 등 잡음)
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

    return `${metadata}\n\n${cleanBody.substring(0, 40000)}`;
}

export async function analyzeWithGemini(contextOrPrompt: string, url: string, isSummaryOnly = false, nextData?: string): Promise<DetailedProductInfo | null> {
    const rawKeys = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
    const apiKeys = rawKeys.split(',').map(k => k.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    if (apiKeys.length === 0) return null;

    let prompt = contextOrPrompt;

    if (isSummaryOnly && !contextOrPrompt.startsWith('아래 패키지') && !contextOrPrompt.includes('[MISSION]')) {
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
                            responseMimeType: "application/json",
                            temperature: 0.2
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

export function inferDestination(title: string, domText?: string, url?: string): string {
    const titleAndUrl = `${title || ''} ${url || ''}`;
    const combined = `${titleAndUrl} ${domText || ''}`;

    // 1. Determine base region (Check title & url first, then combined)
    const matchRegion = (text: string): string => {
        if (/동유럽|체코|오스트리아|헝가리|폴란드|프라하|부다페스트|비엔나|잘츠부르크|체스키크롬로프/i.test(text)) return '동유럽';
        if (/서유럽/i.test(text)) return '서유럽';
        if (/북유럽/i.test(text)) return '북유럽';
        if (/발칸/i.test(text)) return '발칸';
        if (/스페인|포르투갈/i.test(text)) return '스페인/포르투갈';
        if (/미동부|캐나다|나이아가라|퀘백|토론토|몬트리올/i.test(text)) return '미동부/캐나다';
        if (/미서부|로스앤젤레스|\bLA\b|샌프란시스코|라스베가스|그랜드캐년/i.test(text)) return '미서부/미국';
        if (/하와이/i.test(text)) return '하와이';
        if (/괌/i.test(text)) return '괌';
        if (/사이판/i.test(text)) return '사이판';
        if (/미국/i.test(text)) return '미국/캐나다';
        if (/오사카|교토|도쿄|후쿠오카|삿포로|북해도|나고야|오키나와|우지|이네|시라하마|노보리베츠|오타루|도야|대마도|일본/i.test(text)) return '일본';
        if (/다낭|나트랑|푸꾸옥|하노이|호이안|달랏|하롱베이|베트남/i.test(text)) return '베트남';
        if (/방콕|푸켓|치앙마이|파타야|태국/i.test(text)) return '태국';
        if (/세부|보라카이|마닐라|보홀|필리핀/i.test(text)) return '필리핀';
        if (/타이베이|가오슝|타이중|대만|이란/i.test(text)) return '대만';
        if (/홍콩|마카오|심천/i.test(text)) return '홍콩/중국';
        if (/장가계|황산|청도|상해|북경|태항산|하이난|백두산|구채구|중국/i.test(text)) return '중국';
        if (/호주|뉴질랜드|시드니|멜버른/i.test(text)) return '호주/뉴질랜드';
        if (/싱가포르|싱가폴/i.test(text)) return '싱가포르';
        if (/발리|인도네시아/i.test(text)) return '인도네시아/발리';
        if (/말레이시아|코타키나발루/i.test(text)) return '말레이시아';
        if (/두바이|아부다비|중동/i.test(text)) return '두바이/중동';
        if (/아프리카|케냐|탄자니아|나미비아/i.test(text)) return '아프리카';
        if (/이탈리아|프랑스|영국|스위스|독일|터키|튀르키예|그리스|크로아티아|유럽/i.test(text)) return '유럽';
        if (/제주|울릉도|국내/i.test(text)) return '국내';
        return '';
    };

    let baseRegion = matchRegion(titleAndUrl) || matchRegion(combined);

    // 2. Extract specific cities & countries restricted to the detected baseRegion
    const REGION_SPOTS_MAP: Record<string, string[]> = {
        '동유럽': ['체코', '오스트리아', '헝가리', '부다페스트', '프라하', '잘츠부르크', '체스키크롬로프', '할슈타트', '비엔나', '빈', '독일', '폴란드'],
        '서유럽': ['프랑스', '파리', '스위스', '인터라켄', '이탈리아', '로마', '베네치아', '피렌체', '영국', '런던'],
        '북유럽': ['노르웨이', '스웨덴', '핀란드', '덴마크', '오슬로', '스톡홀름', '헬싱키'],
        '발칸': ['크로아티아', '슬로베니아', '두브로브니크', '블레드', '보스니아'],
        '스페인/포르투갈': ['스페인', '포르투갈', '마드리드', '바르셀로나', '세비야', '리스본'],
        '유럽': ['이탈리아', '프랑스', '영국', '스위스', '독일', '터키', '튀르키예', '그리스', '크로아티아'],
        '미동부/캐나다': ['미동부', '캐나다', '나이아가라', '퀘백', '뉴욕', '워싱턴', '보스턴', '토론토', '몬트리올'],
        '미서부/미국': ['미서부', '로스앤젤레스', 'LA', '샌프란시스코', '라스베가스', '그랜드캐년'],
        '일본': ['오사카', '교토', '우지', '이네', '도쿄', '후쿠오카', '삿포로', '북해도', '나고야', '오키나와', '노보리베츠', '오타루', '도야', '시라하마', '와카야마'],
        '베트남': ['다낭', '호이안', '나트랑', '푸꾸옥', '하노이', '달랏', '하롱베이'],
        '태국': ['방콕', '파타야', '푸켓', '치앙마이'],
        '필리핀': ['보홀', '보라카이', '세부', '마닐라'],
        '대만': ['타이베이', '타이페이', '가오슝', '타이중', '이란'],
        '홍콩/중국': ['홍콩', '마카오', '심천'],
        '중국': ['장가계', '황산', '청도', '상해', '북경', '태항산', '하이난', '백두산', '구채구'],
        '호주/뉴질랜드': ['호주', '뉴질랜드', '시드니', '멜버른'],
        '싱가포르': ['싱가포르', '센토사'],
        '인도네시아/발리': ['발리', '우붓', '자카르타'],
        '말레이시아': ['코타키나발루', '쿠알라룸푸르'],
        '두바이/중동': ['두바이', '아부다비'],
        '아프리카': ['케냐', '탄자니아', '나미비아', '세렝게티', '빅토리아폭포']
    };

    const foundSpots: string[] = [];
    const allowedSpots = REGION_SPOTS_MAP[baseRegion] || [];
    const titleAndUrlStr = `${title || ''} ${url || ''}`;

    for (const spot of allowedSpots) {
        if (titleAndUrlStr.includes(spot) || (domText && domText.includes(spot))) {
            if (!foundSpots.includes(spot) && spot !== baseRegion) {
                foundSpots.push(spot);
            }
        }
    }

    const normalizedSpots = foundSpots.map(s => (s === '타이페이' ? '타이베이' : s));
    const uniqueSpots = Array.from(new Set(normalizedSpots));

    if (uniqueSpots.length > 0) {
        const spotsStr = uniqueSpots.slice(0, 5).join('/');
        if (baseRegion && baseRegion !== '해외') {
            return `${baseRegion} (${spotsStr})`;
        }
        return spotsStr;
    }

    return baseRegion || '해외';
}



import * as iconv from 'iconv-lite';
import type { DetailedProductInfo } from '../types';

/**
 * URL 크롤링 및 상품 정보 파싱 (서버 사이드 전용)
 */

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function quickFetch(url: string, retries = 2): Promise<{ html: string; title: string }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        let text = decoder.decode(buffer);

        console.log(`[QuickFetch] Url: ${url}, Status: ${response.status}, Length: ${text.length}`);

        // EUC-KR 감지 및 재인코딩
        if (text.includes('charset=euc-kr') || text.includes('charset=EUC-KR')) {
            text = iconv.decode(Buffer.from(buffer), 'euc-kr');
        }

        // 간단한 타이틀 추출
        let title = '';
        const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        return { html: text, title };

    } catch (error) {
        if (retries > 0) {
            console.log(`[QuickFetch] 재시도 (${retries}회 남음): ${url}`);
            await sleep(1000);
            return quickFetch(url, retries - 1);
        }
        throw error;
    }
}

export async function fetchContent(url: string): Promise<{ text: string, nextData?: string }> {
    try {
        console.log(`[Crawler] Fetching: ${url}`);

        // 1. 빠른 fetch 시도
        const { html } = await quickFetch(url);

        // 2. HTML을 텍스트로 변환 (메타데이터 포함)
        const text = htmlToText(html);

        // HTML 원본에서 __NEXT_DATA__ 추출
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;

        if (text.length > 500 || html.length > 5000) {
            return { text, nextData };
        }

        throw new Error('Content too short');

    } catch (error) {
        console.error(`[Crawler] Error:`, error);
        throw error;
    }
}

function htmlToText(html: string): string {
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
    const jsonPriceMatch = html.match(/["'](?:Price|SalePrice|goodsPrice|GoodsPrice|ProductPrice_Adult|Price_Adult|productPrice_Adult_TotalAmount)["']\s*[:=]\s*["']?(\d+)["']?/i);
    if (jsonPriceMatch) targetPrice = jsonPriceMatch[1];

    let targetDuration = '';
    const durationMatch = html.match(/(\d+)\s*박\s*(\d+)\s*일/);
    if (durationMatch) {
        targetDuration = `${durationMatch[1]}박${durationMatch[2]}일`;
    }

    // [강력 보완] NEXT_DATA (ModeTour 등 SPA 프레임워크 렌더링 데이터) 직접 파싱
    const startIdx = html.indexOf('<script id="__NEXT_DATA__"');
    if (startIdx !== -1) {
        const jsonStart = html.indexOf('>', startIdx) + 1;
        const jsonEnd = html.indexOf('</script>', jsonStart);
        if (jsonStart !== 0 && jsonEnd !== -1) {
            const nextDataStr = html.substring(jsonStart, jsonEnd);
            try {
                const nextData = JSON.parse(nextDataStr);

                // 동적 재귀 탐색 (API 응답구조가 브라우저/서버에 따라 달라지는 것에 대응)
                function extractVal(obj: any, key: string): any {
                    if (!obj || typeof obj !== 'object') return null;
                    if (key in obj && obj[key]) return obj[key];
                    for (const k in obj) {
                        const res = extractVal(obj[k], key);
                        if (res) return res;
                    }
                    return null;
                }

                const foundPeriod = extractVal(nextData, 'travelPeriod');
                if (foundPeriod) targetDuration = String(foundPeriod);

                const foundName = extractVal(nextData, 'goodsName') || extractVal(nextData, 'productName');
                if (foundName) targetTitle = String(foundName);

                const foundPrice = extractVal(nextData, 'salePrice') || extractVal(nextData, 'price');
                if (foundPrice) targetPrice = String(foundPrice).replace(/[^0-9]/g, '');

            } catch (e) {
                console.error('[Crawler] __NEXT_DATA__ 파싱 오류:', e);
            }
        }
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

    return `[METADATA]
PAGE_TITLE: ${finalTitle}
OG_TITLE: ${ogTitle}
BODY_TITLE: ${bodyTitle}
CLASS_TITLE: ${classTitle}
TARGET_TITLE: ${targetTitle}
TARGET_PRICE: ${targetPrice}
TARGET_DURATION: ${targetDuration}
[CONTENT]
${cleanBody}`;
}

async function analyzeWithGemini(text: string, url: string, nextData?: string): Promise<DetailedProductInfo | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        console.log('[Gemini] AI 분석 시작...');
        const prompt = `다음 여행 상품 페이지에서 정보를 추출하여 JSON으로 반환하세요.
URL: ${url}
${nextData ? `--- [중요: NEXT_JS_DATA (JSON 데이터)] ---\n${nextData.substring(0, 25000)}\n` : ''}
전체 페이지 내용:
${text.substring(0, 8000)}

반환 형식:
{
  "isProduct": true,
  "title": "METADATA 섹션의 TARGET_TITLE 또는 PAGE_TITLE 중 더 구체적인 것을 그대로 추출 (상품명 전체)",
  "destination": "목적지 (국가+도시)",
  "price": "METADATA 섹션의 TARGET_PRICE 값을 우선적으로 사용하세요 (숫자만 추출).",
  "departureDate": "출발일",
  "airline": "항공사 (티웨이, 제주항공 등)",
  "duration": "METADATA 섹션의 TARGET_DURATION 값을 최우선으로 사용하세요. 없으면 내용에서 'X박 Y일' 패턴을 찾으세요. (예: 3박5일)",
  "departureAirport": "출발공항 (청주, 인천 등)",
  "keyPoints": ["상품의 핵심 특징과 매력 포인트를 5~7개 항목으로 요약. 상품명, 일정, 포함 투어, 식사, 호텔 등을 분석하여 깔끔하고 간결한 한국어 문장으로 작성. 예시: '나트랑 여행은 이걸로 끝! 100% 휴양 만족', '2024년 8월 신규 오픈! 한국인 전용 해적 호핑투어', '나트랑 명물! 머드 온천 체험으로 피로 해소', '현지만의 특별한 간식 3종 제공(코코넛 커피, 반미, 반깐)'"],
  "exclusions": ["불포함 사항을 간결하게 요약. 예: '가이드팁 1인 90유로', '매너 팁', '개인 경비', '여행자보험' 등"]
}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
        });

        const data = await response.json();
        const resText = data.candidates[0].content.parts[0].text;
        const jsonStr = resText.replace(/```json\s*|\s*```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * 확정서 전용 종합 분석 — 페이지 전체 내용에서 일정/식사/호텔/포함사항 등 모두 추출
 */
async function analyzeForConfirmation(text: string, url: string, nextData?: string): Promise<any | null> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    let preExtractedInclusions = '';
    let preExtractedExclusions = '';

    // Next_DATA에서 포함/불포함 직접 추출 (글자수 제한으로 잘리는 문제 방지)
    if (nextData) {
        console.log('[Debug] nextData length:', nextData.length);
        try {
            const dataObj = JSON.parse(nextData);
            console.log('[Debug] dataObj keys:', Object.keys(dataObj));
            function findValues(obj: any, keyMap: string[], results: string[] = []): string[] {
                if (!obj || typeof obj !== 'object') return results;
                for (const k in obj) {
                    if (keyMap.includes(k.toLowerCase()) && typeof obj[k] === 'string') {
                        console.log(`[Debug-Find] Found key ${k}, len: ${obj[k].length}`);
                        if (obj[k].length > 10) results.push(obj[k]);
                    }
                    findValues(obj[k], keyMap, results);
                }
                return results;
            }
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

    try {
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
        prompt += '  "departureTime": "가는편 출발 시간 (HH:MM) - 본문에 숨겨진 실제 시간을 찾아주세요",\n';
        prompt += '  "arrivalTime": "가는편 도착 시간 (HH:MM)",\n';
        prompt += '  "returnDepartureTime": "오는편 출발 시간 (HH:MM)",\n';
        prompt += '  "returnArrivalTime": "오는편 도착 시간 (HH:MM)",\n';
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
        prompt += '      "date": "날짜",\n';
        prompt += '      "title": "일정 제목 (예: 인천 출발 - 다낭 도착)",\n';
        prompt += '      "activities": ["해당 일자의 핵심 활동 내용 3-5개 요약"],\n';
        prompt += '      "transportation": "비행기 편명, 출발시간, 도착시간, 소요시간 (예: TW041 21:25 출발 -> 00:40 도착 (5시간 15분 소요))",\n';
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
        prompt += '  "keyPoints": ["상품 핵심 포인트 5~7개"],\n';
        prompt += '  "specialOffers": ["특전/혜택"],\n';
        prompt += '  "features": ["상품 특징"],\n';
        prompt += '  "courses": ["주요 관광 코스"],\n';
        prompt += '  "notices": ["전체 유의사항"],\n';
        prompt += '  "cancellationPolicy": "취소/환불 규정",\n';
        prompt += '  "checklist": ["준비물 목록"]\n';
        prompt += '}\n\n';
        prompt += '중요 지침:\n';
        prompt += '1. 이모지 사용 절대 금지: 모든 텍스트에서 이모지를 절대 사용하지 마세요. 깔끔한 텍스트만 사용합니다.\n';
        prompt += '2. 일정표 상세화: 각 일차별 activities는 페이지 내용을 꼼꼼히 읽고 중요한 방문지, 체험 내용을 3-5문장으로 요약하여 작성하세요. 정보가 아코디언(펼치기) 메뉴나 상세 일정 탭 안에 숨어있을 수 있으니 텍스트 전체를 꼼꼼히 분석하세요.\n';
        prompt += '3. 교통 정보 상세화: transportation 필드에 편명, 출발/도착 시각, 총 소요 시간을 예시 형식에 맞춰 정확히 기입하세요. 항공 일정 섹션이 별도로 존재하는 경우가 많으니 주의깊게 확인하세요.\n';
        prompt += '4. 호텔 정보: 호텔 이름은 가능한 한글 정식 명칭을 사용하세요.\n';
        prompt += '5. JSON만 반환하세요. 다른 설명 텍스트는 제외하세요.';

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8000 }
            })
        });

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            console.error('[Gemini] 응답 형식이 올바르지 않습니다:', JSON.stringify(data));
            return null;
        }

        const resText = data.candidates[0].content.parts[0].text;
        console.log('[Gemini] raw response length:', resText.length);
        const jsonStr = resText.replace(/```json\s*|\s*```/g, '').trim();
        try {
            const parsed = JSON.parse(jsonStr);
            console.log('[Gemini] 확정서 분석 완료:', Object.keys(parsed));
            return parsed;
        } catch (parseErr) {
            console.error('[Gemini] JSON 파싱 실패:', jsonStr.substring(0, 500));
            throw parseErr;
        }
    } catch (e: any) {
        console.error('[Gemini] 확정서 분석 오류 상세:', e.message || e);
        return null;
    }
}

async function scrapeWithScrapingBee(url: string): Promise<string | null> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY;
    if (!apiKey) return null;

    try {
        console.log(`[ScrapingBee] 시작: ${url}`);
        // render_js=true, wait_browser=networkidle를 사용하여 JS 렌더링 보장
        const response = await fetch(`https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=networkidle&timeout=25000`);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const html = await response.text();
        console.log(`[ScrapingBee] 완료: ${html.length}자`);

        // HTML 원본에서 텍스트 추출 (기존 로직 재사용)
        return htmlToText(html);
    } catch (e) {
        console.error('[ScrapingBee] 오류:', e);
        return null;
    }
}

import { scrapeWithBrowser } from '@/lib/browser-crawler';

/**
 * 확정서 전용 크롤러 — 전체 페이지 데이터를 종합 분석
 * 확정서는 정확도와 모든 세부 정보(포함/불포함/일정표) 추출이 필수이므로, 
 * 다소 지연되더라도 JS 렌더링이 보장되는 브라우저 크롤링을 사용합니다.
 */
export async function crawlForConfirmation(url: string): Promise<any> {
    console.log(`[ConfirmCrawler] 분석 시작: ${url}`);

    let fullText: string | null = null;
    let nextData: string | undefined = undefined;

    // 1. 브라우저 크롤링 시도 (주로 로컬 Puppeteer)
    try {
        fullText = await scrapeWithBrowser(url);
    } catch (e) {
        console.log(`[ConfirmCrawler] 브라우저 크롤링 중 에러 발생 (무시하고 다음 단계 진행)`);
    }

    // 2. 브라우저 크롤링 실패 시 ScrapingBee 시도 (특히 Vercel 운영 환경에서 필수)
    if (!fullText && process.env.SCRAPINGBEE_API_KEY) {
        console.log(`[ConfirmCrawler] 브라우저 실패하여 ScrapingBee로 전환...`);
        fullText = await scrapeWithScrapingBee(url);
    }

    // 3. 모든 고급 옵션 실패 시, fallback으로 기존 빠른 fetch 사용
    if (!fullText) {
        console.log(`[ConfirmCrawler] 모든 고급 크롤링이 실패하여 일반 fetch로 폴백`);
        const result = await fetchContent(url);
        fullText = result.text;
        nextData = result.nextData;
    } else {
        // 추출된 텍스트 정리
        fullText = fullText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    }

    const result = await analyzeForConfirmation(fullText, url, nextData);
    if (result) {
        result.url = url;
        return result;
    }
    // 최종 폴객: 일반 파싱
    console.log('[ConfirmCrawler] 확정서 전용 Gemini 분석 실패, 일반 파싱으로 폴백');
    return await crawlTravelProduct(url);
}

function fallbackParse(text: string): DetailedProductInfo {
    return { title: '상품명 추출 실패', destination: '', price: '가격 문의', departureDate: '', departureAirport: '', duration: '', airline: '', hotel: '', url: '', features: [], courses: [], specialOffers: [], inclusions: [], exclusions: [], itinerary: [], keyPoints: [], hashtags: '', hasNoOption: false, hasFreeSchedule: false };
}

export async function crawlTravelProduct(url: string): Promise<DetailedProductInfo> {
    const { text, nextData } = await fetchContent(url);
    const aiResult = await analyzeWithGemini(text, url, nextData);

    if (aiResult && aiResult.isProduct) {
        return refineData(aiResult, text, url, nextData);
    }
    return refineData(fallbackParse(text), text, url, nextData);
}

function formatDateString(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '미정') return dateStr;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr.trim();
    const match = dateStr.match(/(\d{2,4})[-\.\/년]\s*(\d{1,2})[-\.\/월]\s*(\d{1,2})/);
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
    if (!durationStr || durationStr.trim() === '미정') return durationStr;
    let str = durationStr.trim();
    const boxDayMatch = str.match(/(\d+)\s*박\s*(\d+)\s*일?/);
    if (boxDayMatch) return `${boxDayMatch[1]}박${boxDayMatch[2]}일`;
    const onlyDayMatch = str.match(/^(\d+)\s*일$/);
    if (onlyDayMatch) {
        const days = parseInt(onlyDayMatch[1], 10);
        if (days > 1) return `${days - 1}박${days}일`;
    }
    const onlyBoxMatch = str.match(/^(\d+)\s*박$/);
    if (onlyBoxMatch) {
        const nights = parseInt(onlyBoxMatch[1], 10);
        return `${nights}박${nights + 1}일`;
    }
    return str.replace(/\s+/g, '');
}

function refineData(info: DetailedProductInfo, originalText: string, url: string, nextData?: string): DetailedProductInfo {
    const refined = { ...info };

    // [강력 보완] Title 보정
    if (!refined.title || refined.title.length < 5 || refined.title.includes('undefined') || refined.title.includes('상품상세')) {
        const titleMatch = originalText.match(/TARGET_TITLE: (.*)/);
        if (titleMatch && titleMatch[1].trim() && titleMatch[1].trim() !== 'undefined') {
            refined.title = titleMatch[1].trim();
        } else {
            const ogMatch = originalText.match(/OG_TITLE: (.*)/);
            if (ogMatch && ogMatch[1].trim() && ogMatch[1].trim() !== 'undefined') refined.title = ogMatch[1].trim();
            else {
                const classMatch = originalText.match(/CLASS_TITLE: (.*)/);
                if (classMatch && classMatch[1].trim()) refined.title = classMatch[1].trim();
            }
        }
    }

    // [강력 보완] Price 보정 및 포맷팅 (콤마 추가)
    let rawPrice = String(refined.price || '');
    if (!rawPrice || rawPrice === '0' || rawPrice === '0원' || rawPrice === 'null' || !/\d/.test(rawPrice)) {
        const priceMatch = originalText.match(/TARGET_PRICE: (.*)/);
        if (priceMatch && priceMatch[1].trim() && priceMatch[1].trim() !== 'undefined' && priceMatch[1].trim() !== '0') {
            rawPrice = priceMatch[1].trim();
        }
    }

    // 숫자 부분만 추출하여 콤마 포맷팅
    const digits = rawPrice.replace(/[^0-9]/g, '');
    if (digits && parseInt(digits, 10) > 1000) {
        refined.price = parseInt(digits, 10).toLocaleString() + '원';
    } else if (digits === '0') {
        refined.price = '0원';
    }

    // 항공사 보정
    let airline = refined.airline || '';
    const airlineCode = airline.substring(0, 2).toUpperCase();
    if (AIRLINE_MAP[airlineCode]) airline = AIRLINE_MAP[airlineCode];
    refined.airline = airline;

    // 카테고리/기간 절대 보정: AI 텍스트 예측보다 원본 메타데이터/JSON 추출값을 무조건 1순위로 신뢰
    const durationMatch = originalText.match(/TARGET_DURATION:\s*(.+)/);
    let rawDuration = (durationMatch && durationMatch[1].trim() && durationMatch[1].trim() !== 'undefined' && durationMatch[1].trim() !== '\"\"')
        ? durationMatch[1].trim()
        : String(refined.duration || '');

    // 포맷팅 적용
    refined.departureDate = formatDateString(refined.departureDate || '');
    refined.duration = formatDurationString(rawDuration);

    console.log(`[Crawler Refine] AI Duration: ${refined.duration} -> Final Duration: ${rawDuration} -> Formatted: ${formatDurationString(rawDuration)}`);

    return {
        ...refined,
        url,
        features: refined.features || [],
        courses: refined.courses || [],
        specialOffers: refined.specialOffers || [],
        inclusions: refined.inclusions || [],
        exclusions: refined.exclusions || [],
        itinerary: refined.itinerary || [],
        keyPoints: refined.keyPoints || [],
        hashtags: refined.hashtags || '',
        hasNoOption: (refined.features || []).includes('노옵션'),
        hasFreeSchedule: (refined.features || []).includes('자유일정포함'),
    };
}

const AIRLINE_MAP: Record<string, string> = {
    '7C': '제주항공', 'KE': '대한항공', 'OZ': '아시아나', 'LJ': '진에어',
    'TW': '티웨이', 'ZE': '이스타', 'RS': '에어서울', 'BX': '에어부산',
    'VN': '베트남항공', 'VJ': '비엣젯', 'PR': '필리핀항공', '5J': '세부퍼시픽'
};

export function formatProductInfo(info: DetailedProductInfo, index?: number): string {
    let p = String(info.price || '');
    // 숫자로만 된 경우 '원' 붙임 (refineData에서 이미 처리되지만 안전장치)
    const digits = p.replace(/[^0-9]/g, '');
    if (digits && !p.includes(',')) {
        p = parseInt(digits, 10).toLocaleString() + '원';
    }

    let r = index !== undefined ? `${index + 1}. ${info.title}\n\n` : `${info.title}\n\n`;
    r += `* 가격 : ${p}\n`;
    r += `* 출발일 : ${info.departureDate || '미정'}\n`;
    r += `* 출발공항 : ${info.departureAirport || '인천'}\n`;
    r += `* 항공 : ${info.airline || '-'}\n`;
    r += `* 지역 : ${info.destination || '-'}\n`;
    r += `* 기간 : ${info.duration || '-'}\n`;

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

    // 상세 상품별 분석 (사용자 요청에 따라 테이블/AI어드바이스 제거)
    products.forEach((p, i) => {
        comparison += `${i + 1}. ${p.title}\n\n`;
        comparison += `* 가격 : ${p.price || '정보 없음'}\n`;
        comparison += `* 출발일 : ${p.departureDate || '미정'}\n`;
        comparison += `* 출발공항 : ${p.departureAirport || '인천'}\n`;
        comparison += `* 항공 : ${p.airline || '-'}\n`;
        comparison += `* 지역 : ${p.destination || '-'}\n`;
        comparison += `* 기간 : ${p.duration || '-'}\n\n`;

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

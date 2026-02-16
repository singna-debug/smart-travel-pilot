
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

async function fetchContent(url: string): Promise<{ text: string, nextData?: string }> {
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
        .substring(0, 20000);

    return `[METADATA]
PAGE_TITLE: ${finalTitle}
OG_TITLE: ${ogTitle}
BODY_TITLE: ${bodyTitle}
CLASS_TITLE: ${classTitle}
TARGET_TITLE: ${targetTitle}
TARGET_PRICE: ${targetPrice}
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
  "duration": "X박 Y일 (예: 3박5일)",
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

    return {
        ...refined,
        url,
        features: refined.features || [],
        courses: [], specialOffers: [], inclusions: [], exclusions: [], itinerary: [],
        keyPoints: refined.keyPoints || [],
        hashtags: '',
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
    r += `* 출발일 : ${info.departureDate}\n`;
    r += `* 출발공항 : ${info.departureAirport || '인천'}\n`;
    r += `* 항공 : ${info.airline}\n`;
    r += `* 지역 : ${info.destination}\n`;
    r += `* 기간 : ${info.duration}\n`;

    if (info.keyPoints && info.keyPoints.length > 0) {
        r += `\n[상품 포인트]\n`;
        info.keyPoints.forEach(point => {
            r += `- ${point}\n`;
        });
    }

    r += `\n[원문 일정표 열기]\n(${info.url})`;
    return r;
}

export async function generateRecommendation(info: DetailedProductInfo): Promise<string> {
    const p = info.price || '문의';
    return `✨ **${info.destination} 여행, 추천드려요!**\n\n${p}에 즐기는 알찬 일정입니다.`;
}

export function compareProducts(products: DetailedProductInfo[]): string {
    return "준비중";
}

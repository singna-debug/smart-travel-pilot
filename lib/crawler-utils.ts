
import * as iconv from 'iconv-lite';
import type { DetailedProductInfo } from '../types';
export { scrapeWithBrowser } from './browser-crawler';

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

export async function quickFetch(url: string, retries = 2): Promise<{ html: string; title: string }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000); 

        const response = await fetch(url, {
            headers: {
                'User-Agent': getRandomUserAgent(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            signal: controller.signal
        });

        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

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
        if (retries > 0) {
            await sleep(1000);
            return quickFetch(url, retries - 1);
        }
        return { html: '', title: '' };
    }
}

export async function fetchModeTourNative(url: string, isSummaryOnly = false): Promise<DetailedProductInfo | null> {
    const productNoMatch = url.match(/package\/(\d+)/i) || url.match(/goodsNo=(\d+)/i) || url.match(/Pnum=(\d+)/i) || url.match(/\/(\d+)\?/);
    if (!productNoMatch) {
        console.warn(`[Native] Product No not found: ${url}`);
        return null;
    }
    const productNo = productNoMatch[1];

    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json'
    };

    let dataDetail: any = null;
    let dataPoints: any = null;
    let dataSchedule: any = null;

    try {
        console.log(`[Native] Fetching for Product No: ${productNo}`);
        const fetchTasks = [
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers })
        ];

        const responses = await Promise.all(fetchTasks);
        console.log(`[Native] Response statuses: ${responses.map(r => r.status).join(', ')}`);
        
        if (responses[0].ok) {
            dataDetail = await responses[0].json();
            console.log(`[Native] dataDetail received. Success: ${!!dataDetail?.result}`);
        } else {
            const errText = await responses[0].text();
            console.warn(`[Native] dataDetail failed. Status: ${responses[0].status}, Body: ${errText.substring(0, 100)}`);
        }
        
        if (responses[1].ok) dataPoints = await responses[1].json();
        if (responses[2].ok) dataSchedule = await responses[2].json();

        if (!dataDetail?.result) {
            console.log(`[Native] Main result missing, trying SimpleDetail for Product No: ${productNo}`);
            const resSimple = await fetch(`https://b2c-api.modetour.com/Package/GetProductSimpleDetail?productNo=${productNo}`, { headers });
            if (resSimple.ok) {
                dataDetail = await resSimple.json();
                console.log(`[Native] SimpleDetail Result: ${!!dataDetail?.result}`);
            }
        }
    } catch (e: any) {}

    if (dataDetail?.result || dataDetail?.isOK || dataDetail?.productName) {
        const d = dataDetail.result || dataDetail;
        console.log(`[Native] Success. Title: ${d.productName || d.prd_nm}`);
        let cleanTitle = d.productName || '';
        const destination = d.category2 ? `${d.category2}, ${d.category3 || ''}` : (d.category3 || '');
        
        let keyPoints: string[] = [];
        if (dataPoints && (dataPoints.isOK || dataPoints.result || dataPoints.code === '200')) {
            const r = dataPoints.result || dataPoints;
            
            // 텍스트 기반 재귀 검색 함수
            const findPoints = (obj: any): string[] => {
                let found: string[] = [];
                if (!obj || typeof obj !== 'object') return found;

                if (Array.isArray(obj)) {
                    obj.forEach(item => {
                        if (typeof item === 'string' && item.length > 5) {
                            found.push(item);
                        } else if (item && typeof item === 'object') {
                            const val = item.title || item.name || item.content || item.text || item.summary;
                            if (typeof val === 'string' && val.length > 5) found.push(val);
                            else found = [...found, ...findPoints(item)];
                        }
                    });
                } else {
                    Object.values(obj).forEach(val => {
                        if (Array.isArray(val) || (val && typeof val === 'object')) {
                            found = [...found, ...findPoints(val)];
                        }
                    });
                }
                return found;
            };

            const extracted = findPoints(r);
            extracted.forEach(p => {
                const clean = p.replace(/\[특전\]/g, '').replace(/<[^>]+>/g, '').trim();
                if (clean.length > 2 && !keyPoints.includes(clean)) keyPoints.push(clean);
            });
        }

        const rawPrice = String(d.sellingPriceAdultTotalAmount || d.productPrice_Adult || d.salePrice || d.sellingPrice || d.price || '');
        
        return {
            isProduct: true,
            title: cleanTitle,
            destination: destination,
            price: rawPrice.replace(/[^0-9]/g, ''),
            departureDate: d.departureDate || d.start_dt || d.dep_dt || '',
            returnDate: d.arrivalDate || d.end_dt || d.arr_dt || '',
            departureAirport: d.departureCityName || d.departureCity || '인천',
            airline: d.transportName || d.carrier_nm || '',
            duration: d.travelPeriod || d.prd_day_cnt || d.period || '',
            url: url,
            keyPoints: keyPoints,
            itinerary: dataSchedule?.result || dataSchedule || [],
            features: []
        } as any;
    }
    return null;
}

export interface FetchOptions {
    isSummaryOnly?: boolean;
    skipHtml?: boolean;
}

export async function fetchContent(url: string, options: FetchOptions = {}): Promise<{ text: string, nextData?: string, nativeData?: any }> {
    const { isSummaryOnly = false, skipHtml = false } = options;
    if (url.includes('modetour.com') || url.includes('modetour.co.kr')) {
        console.log(`[Crawler] ModeTour domain detected. skipHtml: ${skipHtml}`);
        
        if (skipHtml) {
            // HTML 수집을 건너뛰고 Native API만 즉시 호출 (가장 빠름)
            const nativeData = await fetchModeTourNative(url, isSummaryOnly);
            return { text: '', nativeData };
        }

        // 병렬 처리: Native API와 일반 HTML 페치를 동시에 진행
        const [nativeData, fetchResult] = await Promise.all([
            fetchModeTourNative(url, isSummaryOnly),
            quickFetch(url).catch(e => ({ html: '' }))
        ]);
        
        const html = ('html' in fetchResult) ? fetchResult.html : '';

        if (nativeData) {
            const text = htmlToText(html, url);
            const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
            const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;
            return { text, nextData, nativeData };
        }
    }

    const { html } = await quickFetch(url);
    const text = htmlToText(html, url);
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;
    return { text, nextData };
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
    
    // 이 요약 모드(Normal)일 경우 기본 프롬프트 구성
    if (isSummaryOnly) {
        const instruction = `
[MISSION]
여행 상품 정보를 분석하여 JSON 형식으로 반환하세요.
특히 'keyPoints'는 상세 정보를 간결한 '개조식'(bullet-point style)으로 요약하여 작성해야 합니다.

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
    "판랑 사막 지프차 투어 및 이국적인 풍경 감상",
    "달랏 죽림선원 케이블카 조망과 야시장 핫플 탐방",
    "나트랑 포나가르 사원 및 롱선사 역사 문화 체험",
    "탄욜리 몽골마을 양떼목장 먹이주기 및 이색 체험",
    "핵심 포인트 5"
  ]
}

[RULES]
1. keyPoints는 반드시 4개~6개 사이로 작성하세요.
2. 각 포인트는 불필요한 서술형 없이 '개조식'으로 간결하게 작성하세요.
3. 본문의 특징적인 체험, 명소, 혜택을 우선적으로 추출하세요.

[DATA]
${contextOrPrompt.substring(0, 30000)}
`;
        prompt = instruction;
    }

    // 보조 데이터가 있다면 추가
    if (nextData) {
        prompt += `\n\n[보조 데이터: NEXT_DATA]\n${nextData.substring(0, 15000)}`;
    }

    try {
        for (const key of apiKeys) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
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
                        return null;
                    }
                }
            } catch (innerError) {
            }
        }
    } catch (outerError) {
    }
    return null;
}

export function refineData(info: DetailedProductInfo, originalText: string, url: string): DetailedProductInfo {
    const refined = { ...info };
    const stripQuotes = (s: string) => (s || '').replace(/^"|"$/g, '').trim();

    if (!refined.title || refined.title.length < 5) {
        const titleMatch = originalText.match(/TARGET_TITLE:\s*"?([^"\n]*)"?/);
        if (titleMatch) refined.title = stripQuotes(titleMatch[1]);
    }
    
    if (refined.price) {
        const digits = refined.price.toString().replace(/[^0-9]/g, '');
        if (digits) refined.price = parseInt(digits, 10).toLocaleString() + '원';
    }
    
    if (refined.departureDate) refined.departureDate = formatDateString(refined.departureDate);
    if (refined.returnDate) refined.returnDate = formatDateString(refined.returnDate);
    
    // 기간(duration) 보강: 제목이나 텍스트에서 'X박 Y일' 패턴 추출
    if (!refined.duration || refined.duration === '미정') {
        const durationMatch = (refined.title + ' ' + originalText).match(/(\d+)\s*박\s*(\d+)\s*일/);
        if (durationMatch) {
            refined.duration = `${durationMatch[1]}박 ${durationMatch[2]}일`;
        }
    }
    
    // 지역(destination) 보강: 제목에서 "나트랑/판랑/달랏" 형태의 다중 도시 추출
    if (refined.title.includes('/')) {
        const titleCities = refined.title.match(/([가-힣]{2,5}(?:\/[가-힣]{2,5})+)/);
        if (titleCities) {
            const cities = titleCities[1].replace(/\//g, ', ');
            // 기존 destination(나트랑) 보다 더 상세한 정보(나트랑, 판랑, 달랏)인 경우 교체
            if (!refined.destination || refined.destination.length < cities.length) {
                refined.destination = cities;
            }
        }
    }
    
    if (!refined.destination || refined.destination.length < 2) {
        const destMatch = refined.title.match(/\[(.*?)\]/);
        if (destMatch && destMatch[1].length > 1 && destMatch[1].length < 10) {
            refined.destination = destMatch[1];
        }
    }

    // 핵심포인트(keyPoints) 보강: Gemini 결과가 아예 없을 때만 실행하거나 제목 정보를 추가
    if (!refined.keyPoints || refined.keyPoints.length === 0) {
        const points: string[] = Array.isArray(refined.keyPoints) ? [...refined.keyPoints] : [];
        // 제목의 대괄호([]) 내용이나 특징적인 키워드 추출
        const titlePoints = refined.title.match(/\[(.*?)\]/g);
        if (titlePoints) {
            titlePoints.forEach(p => {
                const clean = p.replace(/[\[\]]/g, '').trim();
                if (clean.length > 2 && clean.length < 15 && !['설연휴특가', '단독상품', '모두투어'].includes(clean)) {
                    points.push(clean);
                }
            });
        }
        
        // 특정 키워드 패턴 검색 (관광, 호텔, 포함, 불포함, 식사 등)
        const patterns = [
            /([가-힣\w\s]+포함)/g,
            /([가-힣\w\s]+특전)/g,
            /([가-힣\w\s]+증정)/g,
            /([가-힣\w\s]+숙박)/g,
            /([가-힣\w\s]+체험)/g,
            /([가-힣\w\s]+방문)/g,
            /([가-힣\w\s]+제공)/g,
            /[#♥★■]\s*([가-힣\w\s&]{4,30})/g  // #, ♥ 등 기호로 시작하는 상품 포인트
        ];
        
        patterns.forEach(regex => {
            const matches = originalText.match(regex);
            if (matches) {
                matches.slice(0, 5).forEach(m => {
                    const clean = m.trim();
                    if (clean.length > 3 && clean.length < 25 && !points.includes(clean)) {
                        points.push(clean);
                    }
                });
            }
        });
        
        if (points.length > 0) refined.keyPoints = points;
    }

    // 최종 정제: 해시태그 제거 및 글자수 제한
    if (refined.keyPoints && Array.isArray(refined.keyPoints)) {
        refined.keyPoints = refined.keyPoints.map(p => 
            p.replace(/^[#♥★■]\s*/, '').trim()
        ).filter(p => p.length > 2);
    }

    refined.url = url;
    return refined;
}

export function formatDateString(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '미정') return dateStr;
    let cleanDate = dateStr.trim();
    
    // T 구분값 제거 (ISO 형식 대응)
    if (cleanDate.includes('T')) cleanDate = cleanDate.split('T')[0];
    
    // 이미 YYYY-MM-DD 형식이면 반환
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return cleanDate;
    
    // 8자리/12자리 연속된 숫자 처리 (20260412 or 202604120000)
    const digitsOnly = cleanDate.replace(/[^0-9]/g, '');
    if (digitsOnly.length >= 8 && /^\d+$/.test(digitsOnly)) {
        const year = digitsOnly.substring(0, 4);
        const month = digitsOnly.substring(4, 6);
        const day = digitsOnly.substring(6, 8);
        return `${year}-${month}-${day}`;
    }
    
    // 구분자가 있는 경우 (2026.04.12, 26/04/12 등)
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

export function formatProductInfo(info: DetailedProductInfo, index?: number): string {
    let p = String(info.price || '');
    const digits = p.replace(/[^0-9]/g, '');
    if (digits && !p.includes(',')) {
        p = parseInt(digits, 10).toLocaleString() + '원';
    }

    let r = index !== undefined ? `${index + 1}. ${info.title}\n\n` : `${info.title}\n\n`;
    r += `* 가격: ${p}\n`;
    r += `* 출발일: ${info.departureDate || '미정'}\n`;
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

    r += `\n[전문 일정표 보기]\n(${info.url})\n\n`;
    r += `※ 예약 전 확인사항\n\n`;
    r += `상품가액은 예약시 출발일에 따라 변동될 수 있습니다.\n`;
    r += `항공 좌석은 예약 시점에 다시 확인해야 합니다.`;
    return r;
}

export async function generateRecommendation(info: DetailedProductInfo): Promise<string> {
    const p = info.price || '문의';
    return `⭐ **${info.destination} 여행, 추천드려요!**\n\n${p}에 즐기는 알찬 일정입니다.`;
}

export function compareProducts(products: DetailedProductInfo[]): string {
    if (!products || products.length < 2) {
        return "비교할 상품이 충분하지 않습니다.";
    }

    let comparison = "📊 여행 상품 비교 분석 결과\n\n";

    products.forEach((p, i) => {
        comparison += `${i + 1}. ${p.title}\n\n`;
        comparison += `* 가격: ${p.price || '정보 없음'}\n`;
        comparison += `* 출발일: ${p.departureDate || '미정'}\n`;
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

        comparison += `[전문 일정표 보기]\n(${p.url})\n\n`;

        if (i < products.length - 1) {
            comparison += `------------------------------------------\n\n`;
        }
    });

    comparison += `※ 예약 전 확인사항\n\n`;
    comparison += `상품가액은 예약시 출발일에 따라 변동될 수 있습니다.\n`;
    comparison += `항공 좌석은 예약 시점에 다시 확인해야 합니다.`;

    return comparison;
}

export function fallbackParse(text: string): DetailedProductInfo {
    const titleMatch = text.match(/TARGET_TITLE:\s*"([^"]+)"/);
    const airlineMatch = text.match(/TARGET_AIRLINE:\s*"([^"]+)"/);
    return { 
        title: titleMatch ? titleMatch[1] : '추출 실패', 
        airline: airlineMatch ? airlineMatch[1] : '',
        url: '' 
    } as any;
}

export const AIRLINE_MAP: Record<string, string> = {
    '7C': '제주항공', 'KE': '대한항공', 'OZ': '아시아나', 'LJ': '진에어',
    'TW': '티웨이', 'ZE': '이스타', 'RS': '에어서울', 'BX': '에어부산'
};

export const scrapeWithScrapingBee = async (url: string): Promise<string | null> => {
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    if (!apiKey) return null;
    try {
        const response = await fetch(`https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true`);
        if (response.ok) return htmlToText(await response.text(), url);
    } catch (e) {}
    return null;
};

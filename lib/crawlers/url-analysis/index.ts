import type { DetailedProductInfo } from '../../types';
import { analyzeModeTourUrl } from './modetour';
import { analyzeHanaTourUrl } from './hanatour';
import { analyzeYellowBalloonUrl } from './yellowballoon';
import { analyzeLotteTourUrl } from './lottetour';
import { analyzeHanjinTravelUrl } from './hanjintravel';

/**
 * URL 분석 탭 전용 메인 크롤링 디스패처
 * - 상담 리스트 URL 입력 시 초고속 요약 파싱 전용
 */
export async function crawlForUrlAnalysis(url: string): Promise<DetailedProductInfo | null> {
    try {
        let result: DetailedProductInfo | null = null;
        if (url.includes('modetour.com') || url.includes('modetour.co.kr')) {
            result = await analyzeModeTourUrl(url);
        } else if (url.includes('hanatour.com')) {
            result = await analyzeHanaTourUrl(url);
        } else if (url.includes('ybtour.co.kr') || url.includes('yellowballoon.co.kr')) {
            result = await analyzeYellowBalloonUrl(url);
        } else if (url.includes('lottetour.com')) {
            result = await analyzeLotteTourUrl(url);
        } else if (url.includes('hanjintravel.com') || url.includes('kaltour.com')) {
            result = await analyzeHanjinTravelUrl(url);
        }

        if (result) {
            result.departureAirport = formatAirportWithCode(result.departureAirport);
        }
        return result;
    } catch (e) {
        console.error(`[URL-Analysis/Dispatcher] Error analyzing URL: ${url}`, e);
    }
    return null;
}

export function formatAirportWithCode(airport: string | undefined): string {
    if (!airport) return '서울(ICN)';
    const clean = airport.trim();
    if (clean.includes('(') && clean.includes(')')) return clean;

    if (clean === '서울') return '서울';
    if (clean.includes('서울') || clean.includes('인천')) return '서울(ICN)';
    if (clean.includes('부산') || clean.includes('김해')) return '부산(PUS)';
    if (clean.includes('대구')) return '대구(TAE)';
    if (clean.includes('청주')) return '청주(CJJ)';
    if (clean.includes('무안')) return '무안(MWX)';
    if (clean.includes('김포')) return '서울(GMP)';
    return `${clean}(ICN)`;
}

export function stripAllEmojis(text: string): string {
    if (!text) return '';
    return text
        .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}✈🧚🍗♨🍷🏨🚌🌟★♥▶▒◆•●📌🍽🎑🌊🧧🚢✨💡]/gu, '')
        .replace(/^[:\-\s\t]+/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export function cleanAndDeduplicateKeyPoints(keyPoints: string[] | undefined): string[] {
    if (!Array.isArray(keyPoints) || keyPoints.length === 0) return [];
    
    const cleaned: string[] = [];
    
    for (const point of keyPoints) {
        if (!point) continue;
        const noEmoji = stripAllEmojis(point);
        if (noEmoji.length < 3) continue;
        if (noEmoji.includes('환영합니다') || noEmoji.includes('어서오세요') || noEmoji.includes('안내드립니다') || noEmoji.includes('참고사항') || noEmoji.includes('유의사항') || noEmoji.includes('만 12세') || noEmoji.includes('만 2세') || noEmoji.includes('독실료') || noEmoji.includes('추가요금') || noEmoji.includes('체험형 :') || noEmoji.includes('국외여행상품')) {
            continue;
        }

        // 카테고리별 주제 중복 체크 (스피드보트/해양, 호텔/숙소, 마사지, 맛집/식사 등 주제당 단 1개만 허용)
        const categories = [
            { key: 'boat', regex: /스피드보트|보트|호핑|소이아일랜드|해양/i },
            { key: 'hotel', regex: /5성|특급|호텔|리조트|숙박/i },
            { key: 'massage', regex: /마사지|안마|스파|케어/i },
            { key: 'food', regex: /맛집|특식|미슐랭|식사|뷔페/i },
            { key: 'tour', regex: /시티투어|나트랑|달랏|관광/i },
        ];

        let isDup = false;
        const normNew = noEmoji.replace(/[^\w\u3131-\u318E\uAC00-\uD7A3]/g, '');

        for (const existing of cleaned) {
            const normExisting = existing.replace(/[^\w\u3131-\u318E\uAC00-\uD7A3]/g, '');

            // 1. 단순 유사도 중복
            if (normNew === normExisting || (normNew.length >= 6 && normExisting.includes(normNew.substring(0, 5)))) {
                isDup = true;
                break;
            }

            // 2. 카테고리 주제 중복 (동일 주제가 2개 이상 들어오는 것 방지)
            for (const cat of categories) {
                if (cat.regex.test(noEmoji) && cat.regex.test(existing)) {
                    isDup = true;
                    break;
                }
            }
            if (isDup) break;
        }

        if (!isDup) {
            cleaned.push(noEmoji);
        }
    }
    
    return cleaned.slice(0, 8);
}

export function formatTagToSentence(tag: string): string {
    if (!tag) return '';
    let clean = tag.replace(/^#/, '').trim();
    clean = clean.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}✈🧚🍗♨🍷🏨🚌🌟★♥▶▒◆•●📌🍽🌊🚢✨💡]/gu, '').trim();
    clean = clean.replace(/^[①-⑳\d\.\)\:\-\s📌🏖️📸🏨🍽️💆♀️]+/, '').trim();
    if (!clean) return '';

    // 이미 완전한 문장이거나 (12자 이상, 또는 제공/포함/구성/투숙/일정 문구 포함시) 절대 접미사 중복 추가 금지!
    if (clean.length > 12 || /제공|포함|구성|투숙|일정|체험|특전/i.test(clean)) {
        return clean;
    }

    if (clean.endsWith('투어') || clean.endsWith('관광')) return `${clean} 포함`;
    if (clean.endsWith('디너') || clean.endsWith('특식') || clean.endsWith('식사')) return `${clean} 제공`;
    if (clean.endsWith('가든') || clean.endsWith('호텔') || clean.endsWith('리조트')) return `${clean} 투숙`;
    if (clean.endsWith('슬라이드') || clean.endsWith('호핑') || clean.endsWith('크루즈') || clean.endsWith('체험')) return `${clean} 체험`;

    return clean;
}

export function extractRichKeyPointsFromText(text: string): string[] {
    if (!text) return [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const points: string[] = [];
    let isInsideCoreSection = false;

    for (const line of lines) {
        if (line.includes('상품 핵심 포인트') || line.includes('상품 포인트') || line.includes('핵심관광지') || line.includes('상품 특전')) {
            isInsideCoreSection = true;
            continue;
        }

        const isCircledNum = /^[①-⑳]\s*/.test(line);
        const isNumDot = /^[1-9]\d*[\.\)\]]\s*/.test(line);
        const isBulletHeader = /^(📌|🚩|🏠|🍴|🚍|✨|⭐|✔|▶)\s*/.test(line);
        const isSpecialPack = /^\[.*팩.*\]/.test(line);

        if (isCircledNum || isNumDot || isBulletHeader || isSpecialPack || (isInsideCoreSection && line.length > 8 && line.length < 120)) {
            const cleaned = line
                .replace(/^[①-⑳]\s*/, '')
                .replace(/^[1-9]\d*[\.\)\]]\s*/, '')
                .replace(/^(📌|🚩|🏠|🍴|🚍|✨|⭐|✔|▶)\s*/, '')
                .trim();

            const isJunkDisclaimer = /배송비|관세|환불|마일리지|접수는|항공의|경비가|불포함|의거|사정에\s*의하여|여행요금에|단체쇼핑|쇼핑센터|흡연|금지된|국가를|단체\s*여행객|상품가는|유류할증료|취소\s*수수료|환율|안내사항|유의사항|필수경비/i.test(cleaned);

            if (cleaned.length > 5 && !points.includes(cleaned) && !isJunkDisclaimer) {
                points.push(cleaned);
            }
        }

        if (points.length >= 10) break;
    }

    return points;
}

export async function enrichKeyPointsToAtLeastFive(result: DetailedProductInfo, originalText?: string): Promise<string[]> {
    const title = result.title || '';
    const points: string[] = [];
    const hasSimilar = (kw: string) => points.some(p => p.includes(kw));

    // 1. Extract Rich KeyPoints from Page Original Text if available!
    if (originalText) {
        const richPoints = extractRichKeyPointsFromText(originalText);
        for (const rp of richPoints) {
            if (!hasSimilar(rp.substring(0, 4))) {
                points.push(rp);
            }
            if (points.length >= 8) break;
        }
    }

    // 2. Title Hashtags
    const hashtags = title.match(/#[^\s#]+/g) || [];
    for (const tag of hashtags) {
        const clean = tag.replace(/^#/, '').trim();
        if (clean.length < 2) continue;
        if (/PICK|담당자|추천|인기/i.test(clean)) continue;
        
        const formatted = formatTagToSentence(clean);
        if (formatted && !hasSimilar(formatted.substring(0, 4))) {
            points.push(formatted);
        }
        if (points.length >= 8) break;
    }

    // 3. Parsed Existing KeyPoints (filtered strictly from junk disclaimers)
    const rawExisting = cleanAndDeduplicateKeyPoints(result.keyPoints);
    for (const pt of rawExisting) {
        const formatted = formatTagToSentence(pt);
        const isJunk = /배송비|관세|환불|마일리지|접수는|항공의|경비|불포함|의거|사정|여행요금|단체|쇼핑센터|흡연|금지된|국가|상품가|유류할증료|취소수수료|스페셜포함|출발\s*후|가이드|기사|현지필수|하나투어|목적만을|공항|경유국가|관광\s*등\s*포함|엄선된\s*호텔/i.test(formatted);
        if (formatted && !isJunk && formatted.length > 2 && !hasSimilar(formatted.substring(0, 4))) {
            points.push(formatted);
        }
        if (points.length >= 6) break;
    }

    // 3. Title Hashtags (Fallback if keyPoints are insufficient)
    if (points.length < 5) {
        const hashtags = title.match(/#[^\s#]+/g) || [];
        for (const tag of hashtags) {
            const clean = tag.replace(/^#/, '').trim();
            if (clean.length < 2) continue;
            if (/PICK|담당자|추천|인기/i.test(clean)) continue;
            
            const formatted = formatTagToSentence(clean);
            if (formatted && !hasSimilar(formatted.substring(0, 4))) {
                points.push(formatted);
            }
            if (points.length >= 5) break;
        }
    }

    // 2. Airline & Departure Airport
    if (points.length < 5 && result.airline && result.airline !== '정보없음' && !hasSimilar(result.airline)) {
        const depAirport = result.departureAirport || '인천';
        points.push(`${result.airline} 직항 탑승 (${depAirport} 출발)`);
    }

    // 3. Duration & Destination
    if (points.length < 5 && result.destination && result.duration && !hasSimilar(result.duration)) {
        points.push(`${result.destination} ${result.duration} 알찬 일정`);
    }

    // 4. Inclusions (포함사항) highlights
    if (points.length < 5 && Array.isArray(result.inclusions)) {
        for (const inc of result.inclusions) {
            const cleanInc = stripAllEmojis(inc);
            if (cleanInc.length > 5 && !hasSimilar(cleanInc.substring(0, 4))) {
                points.push(cleanInc);
            }
            if (points.length >= 5) break;
        }
    }

    // 5. Itinerary spot highlights
    if (points.length < 5 && Array.isArray(result.itinerary)) {
        for (const day of result.itinerary) {
            const spots = (day.items || day.timeline || []).map((s: any) => typeof s === 'string' ? s : s.title).filter(Boolean);
            for (const spot of spots) {
                const cleanSpot = stripAllEmojis(spot);
                if (cleanSpot.length > 4 && !hasSimilar(cleanSpot.substring(0, 4))) {
                    points.push(`${cleanSpot} 탐방`);
                }
                if (points.length >= 5) break;
            }
            if (points.length >= 5) break;
        }
    }

    const rawPoints = cleanAndDeduplicateKeyPoints(points);

    // Gemini AI를 사용하여 전체 일정표(Itinerary) 텍스트를 읽고 고품질 5줄 상품 포인트 요약
    try {
        const { analyzeWithGemini } = require('../../crawler-base-utils');
        let itineraryContext = '';
        if (Array.isArray(result.itinerary) && result.itinerary.length > 0) {
            itineraryContext = result.itinerary.map((d: any) => {
                const itemsStr = (d.items || d.timeline || []).map((i: any) => typeof i === 'string' ? i : (i.title || i.description || '')).filter(Boolean).join(', ');
                return `${d.day || 1}일차 (${d.title || ''}): ${itemsStr}`;
            }).join('\n');
        }

        const prompt = `아래 패키지 여행 상품의 제목 및 전체 일정표를 기반으로, 상담 시 고객에게 제시할 명확한 [상품 핵심 포인트 5줄 요약]을 작성해줘.

[작성 규칙 - 매우 중요]:
1. "~하세요", "~경험하세요" 같은 장황한 서술형/구어체 문장을 절대 쓰지 말고, 반드시 간결하고 명확한 개조식 문구(~포함, ~제공, ~투숙, ~체험, ~일정)로 작성해.
2. 반드시 서로 다른 핵심 혜택으로 구성된 정확히 5개의 줄(개조식)로 반환해.
3. 한 줄에 너무 많은 내용을 섞지 말고 1줄당 1개 혜택만 명확히 정리해.

[상품 제목]: ${result.title || ''}
[주요 키워드]: ${rawPoints.join(', ')}
[전체 일정표 요약]:
${itineraryContext || '일정표 참조'}

반드시 아래 JSON 형식으로만 응답해줘:
{
  "keyPoints": [
    "전일정 5성급 특급 호텔 투숙 및 편안한 휴식",
    "스피드보트 탑승 소이 아일랜드 해양 액티비티 체험",
    "나트랑 & 고원 도시 달랏 핵심 관광지 알찬 일정",
    "매일 제공되는 현지 로컬 간식(반미/사탕수수주스) 제공",
    "베트남 대표 코코넛 커피 & 쓰어다 커피 음료 포함"
  ]
}`;
        const aiResult = await analyzeWithGemini(prompt, itineraryContext || result.title || '', true);
        if (aiResult) {
            let parsedPoints: string[] = [];
            if (Array.isArray(aiResult.keyPoints) && aiResult.keyPoints.length > 0) {
                parsedPoints = aiResult.keyPoints;
            } else if (typeof aiResult === 'object') {
                const keys = Object.values(aiResult).flat();
                parsedPoints = keys.filter((v: any) => typeof v === 'string' && v.length > 3);
            }
            if (parsedPoints.length > 0) {
                return parsedPoints.slice(0, 5);
            }
        }
    } catch (e) {}

    return rawPoints.slice(0, 5);
}


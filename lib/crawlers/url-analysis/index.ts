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
        // 운영성 문구(최소 출발 인원 조건 등) 및 원문 줄바꿈 잘림으로 앞부분이 잘려나간 조각 제외
        if (/최소인원|모객기준|명\s*이상.*출발|출발.*명\s*이상/.test(noEmoji)) continue;
        if (/^(명|이상|출발가능|이상\s*출발가능)\s*(포함|제공)?$/.test(noEmoji)) continue;

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

export function formatTagToSentence(tag: string, variantIdx: number = 0): string {
    if (!tag) return '';
    let clean = tag.replace(/^#/, '').trim();
    clean = clean.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}✈🧚🍗♨🍷🏨🚌🌟★♥▶▒◆•●📌🍽🌊🚢✨💡]/gu, '').trim();
    clean = clean.replace(/^[①-⑳\d\.\)\:\-\s📌🏖️📸🏨🍽️💆♀️]+/, '').trim();
    if (!clean) return '';

    // 이미 완전한 문장이거나 (12자 이상, 또는 제공/포함/구성/투숙/일정 문구 포함시) 절대 접미사 중복 추가 금지!
    if (clean.length > 12 || /제공|포함|구성|투숙|일정|체험|특전/i.test(clean)) {
        return clean;
    }

    // 접미사 매칭용: "온천2박", "호핑1일" 처럼 뒤에 붙은 숫자/수량 단위를 떼고 핵심 단어로 판단
    const core = clean.replace(/\d+\s*(박|일|인실|인승|인|회|시간)$/, '');

    if (/투어|관광/.test(core)) return `${clean} 포함`;
    if (/디너|특식|식사|가이세키|코스요리|정식|뷔페|요리/.test(core)) return `${clean} 제공`;
    if (/가든|호텔|리조트|료칸/.test(core)) return `${clean} 투숙`;
    if (/슬라이드|호핑|크루즈|체험/.test(core)) return `${clean} 체험`;
    if (clean === '인생샷') return '인생샷 명소 탐방';
    if (clean === '소도시여행') return '여유로운 소도시 여행';
    if (clean === '미식') return '현지 대표 미식 체험';
    if (clean === '사케') return '유명 사케 양조장 시음';
    if (/여행|힐링/.test(core)) return `${clean} 코스`;
    if (/협곡|마을|온천|화산|폭포|해변|비치|전망대|산책/.test(core)) {
        const spotSuffixes = [' 일정', ' 탐방 코스', ' 방문 일정'];
        return `${clean}${spotSuffixes[variantIdx % spotSuffixes.length]}`;
    }
    if (/쇼핑|아울렛|면세/.test(core)) return `${clean} 자유시간`;

    // 어떤 카테고리에도 안 걸리는 태그(주로 지명/명소)는 매번 "포함"만 반복되지 않도록 순환 표현 사용
    const fallbackSuffixes = [' 포함', ' 명소 탐방', ' 일정 포함', ' 코스 구성'];
    return `${clean}${fallbackSuffixes[variantIdx % fallbackSuffixes.length]}`;
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

    // 1. Parsed Existing KeyPoints (prioritize real sentences from API/scraping)
    if (Array.isArray(result.keyPoints) && result.keyPoints.length > 0) {
        for (const pt of result.keyPoints) {
            if (pt && pt.length > 3 && !hasSimilar(pt.substring(0, 4))) {
                points.push(pt);
            }
        }
    }

    // 2. Extract Rich KeyPoints from Page Original Text if available!
    if (originalText) {
        const richPoints = extractRichKeyPointsFromText(originalText);
        for (const rp of richPoints) {
            if (!hasSimilar(rp.substring(0, 4))) {
                points.push(rp);
            }
            if (points.length >= 8) break;
        }
    }

    // 3. Title Hashtags (Supplement to reach 5 key points)
    if (points.length < 5) {
        const hashtags = title.match(/#[^\s#]+/g) || [];
        for (let i = 0; i < hashtags.length; i++) {
            const clean = hashtags[i].replace(/^#/, '').trim();
            if (clean.length < 2) continue;
            if (/PICK|담당자|추천|인기|^TOP$|^BEST$|^HOT$|^NEW$|^MD$|^VIP$|핫딜|특가|얼리버드/i.test(clean)) continue;

            const formatted = formatTagToSentence(clean, i);
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

    // 모두투어 URL인 경우에만 AI로 전체 일정표/포함사항을 몽땅 읽어 풍부한 5줄 문장 생성
    const isModeTour = result.url?.includes('modetour.com') || result.url?.includes('modetour.co.kr');
    if (!isModeTour) {
        return rawPoints.slice(0, 5);
    }

    try {
        const { analyzeWithGemini } = require('../../crawler-base-utils');
        
        // 모두투어 일차별 주요 명소 축약 (속도 최적화: 긴 설명문 제거하고 1~2줄 핵심 명소만)
        let itinerarySummary = '';
        if (Array.isArray(result.itinerary) && result.itinerary.length > 0) {
            itinerarySummary = result.itinerary.map((d: any) => {
                const spots = (d.items || d.timeline || []).map((i: any) => typeof i === 'string' ? i : i.title).filter(Boolean).slice(0, 4).join(', ');
                const hotelStr = d.hotel ? ` (${d.hotel})` : '';
                return `${d.day}일차: ${spots}${hotelStr}`;
            }).join(' / ');
        }

        const prompt = `아래 모두투어 패키지 여행 상품의 정보를 바탕으로, 고객이 한눈에 반할 만한 [매력적인 핵심 상품 포인트 5줄]을 작성해줘.

[작성 지침 - 필수]:
1. 너무 길고 장황하게 쓰지 마. 한 줄당 15자~30자 내외로 매우 깔끔하고 명확한 개조식 표현으로 작성해.
2. 예시 스타일 참고:
   - "일본 소도시의 여유를 만끽하는 유유자적 탐방"
   - "도시별 매력을 경험하는 시내호텔 1박 + 온천호텔 1박 구성"
   - "에어부산 직항으로 편안하게 출발"
   - "마츠야마, 타카마츠의 핵심 명소 알찬 방문"
   - "일상에서 벗어나 힐링할 수 있는 실속 여행"
3. "오사카", "베스트셀러" 같은 단순 단어 나열 절대 금지.
4. 반드시 서로 다른 혜택 5개의 줄로 반환해.

[상품 제목]: ${result.title || ''}
[항공/출발]: ${result.airline || ''} (${result.departureAirport || '인천'} 출발)
[숙소/특전]: ${result.hotel || ''}
[일정 요약]: ${itinerarySummary.substring(0, 1500)}

반드시 아래 JSON 형식으로만 응답해줘:
{
  "keyPoints": [
    "포인트 1",
    "포인트 2",
    "포인트 3",
    "포인트 4",
    "포인트 5"
  ]
}`;
        const aiResult = await analyzeWithGemini(prompt, result.title || '', false);
        if (aiResult) {
            let parsedPoints: string[] = [];
            if (Array.isArray(aiResult.keyPoints) && aiResult.keyPoints.length > 0) {
                parsedPoints = aiResult.keyPoints;
            } else if (Array.isArray(aiResult) && aiResult.length > 0) {
                parsedPoints = aiResult.filter((v: any) => typeof v === 'string');
            } else if (typeof aiResult === 'object') {
                const vals = Object.values(aiResult).flat();
                parsedPoints = vals.filter((v: any) => typeof v === 'string' && v.length > 5);
            }
            if (parsedPoints.length >= 3) {
                return parsedPoints.slice(0, 5);
            }
        }
    } catch (e) {
        console.error('[Modetour KeyPoints AI Error]:', e);
    }

    return rawPoints.slice(0, 5);
}


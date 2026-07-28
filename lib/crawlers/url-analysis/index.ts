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
            try {
                const { quickFetch, htmlToText } = await import('../../crawler-base-utils');
                const { html } = await quickFetch(url).catch(() => ({ html: '' }));
                const pageText = html ? htmlToText(html, url) : undefined;
                result.departureAirport = formatAirportWithCode(result.departureAirport);
                result.keyPoints = enrichKeyPointsToAtLeastFive(result, pageText);
            } catch (e) {
                result.departureAirport = formatAirportWithCode(result.departureAirport);
                result.keyPoints = enrichKeyPointsToAtLeastFive(result);
            }
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

        // Normalize text for comparison: remove all spaces, punctuation, stop words
        const normNew = noEmoji
            .replace(/[^\w\u3131-\u318E\uAC00-\uD7A3]/g, '')
            .replace(/(이용|포함|제공|포함된|특전|혜택|전일정)/g, '');

        let isDup = false;
        for (const existing of cleaned) {
            const normExisting = existing
                .replace(/[^\w\u3131-\u318E\uAC00-\uD7A3]/g, '')
                .replace(/(이용|포함|제공|포함된|특전|혜택|전일정)/g, '');

            if (normNew === normExisting) {
                isDup = true;
                break;
            }
            if (normNew.length >= 8 && normExisting.length >= 8) {
                if (normNew.includes(normExisting) || normExisting.includes(normNew)) {
                    isDup = true;
                    break;
                }
            }
        }

        if (!isDup) {
            cleaned.push(noEmoji);
        }
    }
    
    return cleaned.slice(0, 8);
}

export function formatTagToSentence(tag: string): string {
    let clean = tag.replace(/#rr#/gi, '').replace(/#\w+#/g, '').replace(/^#/, '').replace(/:\s*$/, '').trim();
    if (!clean) return '';

    // Europe / Eastern Europe
    if (clean.includes('비엔나음악회') || clean.includes('음악회')) return '음악의 도시 비엔나에서 즐기는 클래식 음악회 감상';
    if (clean.includes('프라하시내호텔') || clean.includes('프라하호텔')) return '낭만의 도시 프라하 시내 중심 우수 호텔 숙박';
    if (clean.includes('잘츠카머구트')) return '알프스 호수 마을 잘츠카머구트 및 유람선 관람';
    if (clean.includes('할슈타트')) return '세계문화유산 동화 같은 호수 마을 할슈타트 탐방';
    if (clean.includes('로컬미식') || clean.includes('미식')) return '지역 전통 미식 및 현지 로컬 맛집 특식 제공';
    if (clean.includes('부다페스트야경') || clean === '다뉴브강야경') return '세계 3대 야경 부다페스트 다뉴브강 야경 관람';
    if (clean.includes('체스키크롬로프') || clean.includes('체스키')) return '중세의 모습을 간직한 체스키 크롬로프 고성 탐방';
    if (clean.includes('잘츠부르크')) return '모차르트의 고향 잘츠부르크 음악과 문화 기행';
    if (clean.includes('쇤브룬')) return '합스부르크 왕가의 화려한 쇤브룬 궁전 내관';

    // Hanjin / America / Europe General
    if (clean.includes('비즈니스')) return '비즈니스석 탑승으로 편안한 이동 혜택';
    if (clean.includes('한진단독')) return '한진트래블 단독 기획 및 단독 행사 상품';
    if (clean.includes('나이아가라') && clean.includes('숙박')) return '나이아가라 폭포 뷰 객실 및 퀘백 숙박 포함';
    if (clean.includes('준특급')) return '전일정 엄선된 준특급 호텔 숙박 포함';
    if (clean.includes('상당옵션') || clean.includes('옵션포함')) return '$330 상당의 인기 선택 옵션 포함 혜택';
    if (clean.includes('NO팁') || clean.includes('노팁')) return '가이드 및 기사 경비 포함 (추가 NO팁)';

    // Southeast Asia / Thailand / Bangkok / Bohol
    if (clean.includes('5성급')) return '프리미엄 5성급 호텔 전일정 쾌적한 투숙';
    if (clean.includes('칸차나부리')) return '호랑이 사원과 협곡열차로 떠나는 칸차나부리 데이투어';
    if (clean.includes('차이나타운')) return '화려한 네온과 로컬 감성이 살아있는 차이나타운 거리 탐방';
    if (clean.includes('아이콘시암')) return '방콕 대표 초대형 쇼핑몰 아이콘시암 및 분수쇼 관람';
    if (clean.includes('새벽사원') || clean.includes('왓아룬')) return '새벽사원(왓아룬) 명소 탐방 및 다이닝';
    if (clean.includes('왓빡남')) return '웅장한 불상과 조화로운 왓빡남 사원 관람';
    if (clean.includes('딸랏노이')) return '레트로 감성 가득한 딸랏노이 골목투어';
    if (clean.includes('재즈바')) return '감미로운 음악을 즐기는 감성 재즈바 탐방';
    if (clean.includes('미슐랭')) return '태국 미슐랭 빕구르망 선정 정통 맛집 탐방';
    if (clean.includes('차오프라야')) return '차오프라야 강 위에서 느끼는 여유 및 주요 명소 조망';
    if (clean.includes('방파인')) return '여러 나라의 전통 건축양식을 토대로 지어진 방파인 여름별궁 관람';
    if (clean.includes('유네스코') || clean.includes('아유타야')) return '유네스코 세계문화유산으로 지정된 역사 도시 아유타야 탐방';
    if (clean.includes('황금 불상') || clean.includes('황금 절벽')) return '거대한 절벽 위에 눈부시게 새겨진 황금 절벽 사원 탐방';
    if (clean.includes('수상시장') || clean.includes('플로팅마켓')) return '태국 전통 수상시장을 재현해 놓은 플로팅마켓 체험';
    if (clean.includes('진리의 성전')) return '높이 105m의 거대한 목조 건축물의 극치 진리의 성전 관람';
    if (clean.includes('망고')) return '상큼 달콤한 생망고 및 현지 로컬 디저트 특식 제공';
    if (clean.includes('한식') || clean.includes('삼겹살')) return '우리나라 최애 한식 메뉴 삼겹살 및 찌개 특식 제공';
    
    // Fix hallucination: "마사지" or "야경" shouldn't be hardcoded to specific countries!
    if (clean.includes('타이마사지') || clean.includes('태국전통안마')) return '피로를 풀어주는 태국 전통 안마 체험 포함';
    if (clean === '야경') return '아름다운 야경 관람';
    if (clean.includes('마사지') || clean.includes('전통안마')) return `피로를 풀어주는 ${clean} 체험 포함`;

    if (clean.includes('다이빙강습') || clean.includes('다이빙')) return '초보자도 즐기는 체험 다이빙 강습 제공';
    if (clean.includes('알로나비치') || clean === '알로나 비치') return '보홀 최고의 힐링 휴양지 알로나 비치 탐방';

    if (clean.includes('시티투어')) return '핵심 시티 투어 및 주요 명소 관람';
    if (clean.match(/특식\s*\d*회/) || clean.includes('특식')) return clean.includes('회') ? `${clean} 특식 제공` : '현지 맛집 특식 포함';
    if (clean.includes('호핑') || clean.includes('요트투어')) return '청정 바다 아름다운 해안선 호핑 및 요트 투어 포함';
    if (clean.includes('라메디')) return '라메디 리조트 쾌적한 전일정 숙박';

    // Japan / East Asia
    if (clean.includes('온천호텔')) return '전일정 특급 온천 호텔 숙박 및 온천욕 포함';
    if (clean.includes('무제한')) return '식사 시 주류 및 음료 무제한 제공 혜택';
    if (clean.includes('3개도시')) return '핵심 3개 인기 관광 도시 일정 포함';
    if (clean.includes('핵심일정')) return '핵심 관광지를 놓침 없이 둘러보는 완벽 동선';

    // Golf / Resort / Special Theme
    if (clean.includes('파크골프')) return '파크골프 전문 라운딩 및 쾌적한 구장 환경 제공';
    if (clean.includes('골프텔')) return '전일정 구장 내 쾌적한 골프텔 숙박 포함';
    if (clean.includes('허니퀸')) return '허니퀸 파크골프 빌리지 단독 및 쾌적한 라운딩';
    if (clean.includes('무제한라운드') || clean.includes('무제한 라운드')) return '원 없이 즐기는 매일 무제한 라운딩 혜택';
    if (clean.includes('45홀') || clean.includes('36홀') || clean.includes('18홀')) return `${clean} 대규모 구장의 탁 트인 라운딩 환경`;
    if (clean.includes('2인출발') || clean.includes('2인 출발')) return '2인부터 부담 없이 출발 가능';
    if (clean.includes('관광포함') || clean.includes('관광 포함')) return '라운딩과 더불어 주요 명소 관광 포함';

    // Auto-fix incomplete clause endings for structured 개조식 output
    if (clean.endsWith('밀집한') || clean.endsWith('가득한') || clean.endsWith('유명한')) {
        return `${clean} 인기 명소 탐방`;
    }
    if (clean.endsWith('이루어지는') || clean.endsWith('전시되는')) {
        return `${clean} 문화 예술 공간 관람`;
    }
    if (clean.endsWith('있는') || clean.endsWith('보이는') || clean.endsWith('곳')) {
        return `${clean} 주요 랜드마크 관람`;
    }

    // Prevent redundant "특전 포함 특전 포함"
    if (clean.endsWith(' 특전 포함')) return clean;

    // Ensure raw short tags turn into complete natural sentences instead of bare single words
    if (!/(포함|제공|탐방|숙박|관람|투어|라운딩|혜택|체험|기행|조망|내관|특식|출발|일정)$/.test(clean)) {
        if (clean.length <= 6) {
            return `${clean} 혜택 및 알찬 일정 포함`;
        }
    }

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

            const isJunkDisclaimer = /배송비|관세|환불|마일리지|접수는|항공의|기사 경비|단체쇼핑|쇼핑센터|흡연|금지된|국가를|단체 여행객|상품가는|유류할증료|취소 수수료/i.test(cleaned);

            if (cleaned.length > 5 && !points.includes(cleaned) && !isJunkDisclaimer) {
                points.push(cleaned);
            }
        }

        if (points.length >= 10) break;
    }

    return points;
}

export function enrichKeyPointsToAtLeastFive(result: DetailedProductInfo, originalText?: string): string[] {
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

    // 3. Parsed Existing KeyPoints (filtered from junk disclaimers)
    const rawExisting = cleanAndDeduplicateKeyPoints(result.keyPoints);
    for (const pt of rawExisting) {
        const formatted = formatTagToSentence(pt);
        const isJunkDisclaimer = /배송비|관세|환불|마일리지|접수는|항공의|기사 경비|단체쇼핑|쇼핑센터|흡연|금지된|국가를|단체 여행객|자유일정 포함|관광 등 포함|특식 제공 특식/i.test(formatted);
        if (formatted && !isJunkDisclaimer && !hasSimilar(formatted.substring(0, 4))) {
            points.push(formatted);
        }
        if (points.length >= 8) break;
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

    return cleanAndDeduplicateKeyPoints(points);
}


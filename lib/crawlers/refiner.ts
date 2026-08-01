import type { DetailedProductInfo } from '../../types';
import { formatDateString } from '../crawler-base-utils';
import { CITY_CODE_MAP } from '../constants/travel-data';

export function refineData(info: DetailedProductInfo, originalText: string, url: string): DetailedProductInfo {
    const refined = { ...info };
    const stripQuotes = (s: string) => (s || '').replace(/^"|"$/g, '').trim();

    if (!refined.title || refined.title.length < 5) {
        const titleMatch = originalText.match(/TARGET_TITLE:\s*"?([^"\n]*)"?/);
        if (titleMatch) refined.title = stripQuotes(titleMatch[1]);
    }
    
    if (refined.price) {
        const priceStr = refined.price.toString();
        
        if (priceStr.includes('~')) {
            const parts = priceStr.split('~').map(p => {
                const digits = p.replace(/[^0-9]/g, '');
                return digits && digits !== '0' ? parseInt(digits, 10) : null;
            });
            
            if (parts.length === 2 && parts[0] && parts[1]) {
                refined.price = `${parts[0].toLocaleString()} ~ ${parts[1].toLocaleString()}원`;
            } else if (parts[0]) {
                refined.price = `${parts[0].toLocaleString()}원~`;
            } else {
                refined.price = '';
            }
        } else {
            const digits = priceStr.replace(/[^0-9]/g, '');
            if (digits && digits !== '0') {
                let pNum = parseInt(digits, 10);
                const fuelMatch = originalText.match(/유류\s*할증료[^\d]*([\d,]{5,7})\s*원?/i) ||
                                  (originalText.includes('100,000원') ? ['100000', '100000'] : null);
                if (fuelMatch && fuelMatch[1]) {
                    const fuelNum = parseInt(fuelMatch[1].replace(/,/g, ''), 10);
                    if (fuelNum >= 10000 && fuelNum <= 1000000 && pNum < 10000000) {
                        const candidateTotal = (pNum + fuelNum).toLocaleString();
                        if (!String(refined.price || '').includes(candidateTotal)) {
                            pNum += fuelNum;
                        }
                    }
                }
                refined.price = pNum.toLocaleString() + '원';
            } else {
                refined.price = priceStr || '가격 정보 문의 (선착순 특가)';
            }
        }
    }
    
    // ★ 가격 fallback: originalText에서 가격 패턴 검색
    if (!refined.price || refined.price === '원' || refined.price === '0원') {
        // TARGET_PRICE 메타데이터에서 검색
        const metaPriceMatch = originalText.match(/TARGET_PRICE:\s*"(\d+)"/);
        if (metaPriceMatch && metaPriceMatch[1] !== '0') {
            refined.price = parseInt(metaPriceMatch[1], 10).toLocaleString() + '원';
        } else {
            // 본문에서 가격 패턴 검색 (N,NNN,NNN원 또는 NNN만원)
            const pricePatterns = [
                /(\d{1,3}(?:,\d{3})+)\s*원/,
                /(\d+)\s*만\s*원/,
                /[\"'](?:price|Price|SalePrice|sellingPrice)[\"']\s*[:=]\s*[\"']?(\d+)/i
            ];
            for (const pattern of pricePatterns) {
                const match = originalText.match(pattern);
                if (match) {
                    const priceStr = match[1].replace(/,/g, '');
                    const priceNum = parseInt(priceStr, 10);
                    if (priceNum >= 500000 && priceNum <= 20000000) { // 패키지 투어 최소 50만원 이상만 유효 (선택옵션 30만원 방지)
                        refined.price = priceNum.toLocaleString() + '원';
                        break;
                    }
                }
            }
        }
    }
    
    if (refined.departureDate) refined.departureDate = formatDateString(refined.departureDate);
    if (refined.returnDate) refined.returnDate = formatDateString(refined.returnDate);
    
    // ★ [자가 치유] 날짜 0일 버그 수정 (출발일 === 귀국일인데 일정이 있는 경우)
    if (refined.departureDate && refined.returnDate && refined.departureDate === refined.returnDate) {
        const itineraryLen = Array.isArray(refined.itinerary) ? refined.itinerary.length : 0;
        if (itineraryLen > 1) {
            const depDate = new Date(refined.departureDate);
            if (!isNaN(depDate.getTime())) {
                const correctedArrDate = new Date(depDate);
                // 3일 일정이면 2박 3일이므로 +2일을 해줌
                correctedArrDate.setDate(depDate.getDate() + (itineraryLen - 1));
                const year = correctedArrDate.getFullYear();
                const month = String(correctedArrDate.getMonth() + 1).padStart(2, '0');
                const day = String(correctedArrDate.getDate()).padStart(2, '0');
                refined.returnDate = `${year}-${month}-${day}`;
                console.log(`[Refiner] Date self-healed: ${refined.departureDate} ~ ${refined.returnDate} (${itineraryLen} days)`);
            }
        }
    }

    // --- [목적지(Destination) 정제 및 보강] ---
    const forbiddenWords = ['노팁', '노쇼핑', '노옵션', '출발', '확정', '특가', '단독', '기획', '모객', '특전', '스마일', '명부터', '예약', '마감', '할인', '이벤트', '시그니처', '선착순', '베스트', '홈쇼핑'];

    // 1. 기존 목적지 오염 제거
    if (refined.destination && forbiddenWords.some(w => refined.destination.includes(w))) {
        refined.destination = '';
    }

    // 2. UI 직접 추출 (TARGET_DESTINATION) 우선 순위
    const targetDestMatch = originalText.match(/TARGET_DESTINATION:\s*([^\n\r]+)/);
    if (targetDestMatch) {
        const extracted = targetDestMatch[1].trim();
        if (extracted.length > 1 && !forbiddenWords.some(w => extracted.includes(w))) {
            refined.destination = extracted;
        }
    }

    // 3. 제목 기반 목적지 우선 추출 (API가 리턴한 잡다한 경유지 등 제거)
    const domesticCities = ['인천', '김포', '서울', '김해', '부산', '대구', '청주', '제주', '무안', '양양', '광주', '기내', '경유', '출발'];
    const cities = Object.keys(CITY_CODE_MAP)
        .filter(city => !domesticCities.includes(city))
        .sort((a, b) => b.length - a.length);

    const titleTokens = refined.title.split(/[\/\s#\[\]\(\),\+\-\:]+/).filter(Boolean);
    const titleCities = [];
    for (const city of cities) {
        const isMatch = titleTokens.some(t => t === city || t.split(/[\/]/).includes(city));
        if (isMatch) {
            titleCities.push(city);
        }
    }

    if (titleCities.length > 0) {
        // 이미 찾은 도시들의 부분 문자열인 경우는 제외 (예: 오사카, 사카 -> 오사카)
        const filteredCities = titleCities.filter(c1 => !titleCities.some(c2 => c1 !== c2 && c2.includes(c1)));
        // 제목에 나오는 순서대로 정렬하기
        filteredCities.sort((a, b) => refined.title.indexOf(a) - refined.title.indexOf(b));
        refined.destination = filteredCities.join(', ');
    } else if (!refined.destination || refined.destination.length < 2) {
        refined.destination = '해외';
    }

    if (!refined.duration || refined.duration === '미정' || refined.duration.includes('0일')) {
        const itineraryLen = Array.isArray(refined.itinerary) ? refined.itinerary.length : 0;
        if (itineraryLen > 1) {
            refined.duration = `${itineraryLen - 1}박 ${itineraryLen}일`;
        } else {
            const durationMatch = (refined.title + ' ' + originalText).match(/(\d+)\s*박\s*(\d+)\s*일/);
            if (durationMatch) {
                refined.duration = `${durationMatch[1]}박 ${durationMatch[2]}일`;
            }
        }
    }

    // 핵심포인트(keyPoints) 약관 쓰레기 문구 강력 필터링 및 순수 포인트 보강
    let currentPoints = Array.isArray(refined.keyPoints) ? [...refined.keyPoints] : [];
    
    // 약관/배송비/주의사항 쓰레기 문구 100% 제거
    currentPoints = currentPoints.filter(pt => {
        const str = String(pt || '');
        return !/배송비|관세|환불|마일리지|접수는|항공의|경비|불포함|의거|사정|여행요금|단체|쇼핑센터|흡연|금지된|국가|상품가|유류할증료|취소수수료|스페셜포함|출발\s*후|가이드|기사|현지필수|하나투어|목적만을|공항/i.test(str) && str.length > 2;
    });
    
    if (currentPoints.length < 10) {
        const points: string[] = [...currentPoints];
        
        // 제목의 대괄호([]) 내용이나 특징적인 키워드 추출
        const titlePoints = refined.title.match(/\[(.*?)\]/g);
        if (titlePoints) {
            titlePoints.forEach((p: string) => {
                const clean = p.replace(/[\[\]]/g, '').trim();
                // 너무 짧거나 핵심적이지 않은 키워드 제외
                if (clean.length > 2 && clean.length < 15 && !['설연휴특가', '단독상품', '모두투어', '출발확정', '긴급모객'].includes(clean)) {
                    if (!points.includes(clean)) points.push(clean);
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
            /([가-힣\w\s]+투어)/g,
            /[#♥★■]\s*([가-힣\w\s&]{4,40})/g  // 기호로 시작하는 상품 포인트 (길이 제한 상향)
        ];
        
        patterns.forEach(regex => {
            const matches = originalText.match(regex);
            if (matches) {
                // 상위 매칭 결과들을 순회하며 중복 없이 추가
                matches.slice(0, 8).forEach(m => {
                    const clean = m.trim().replace(/^[#♥★■]\s*/, '').replace(/[\r\n]+/g, '').replace(/^n(?=[가-힣])/, '').replace(/^\d+회\s*/, '').replace(/^["]\s*/, '').trim();
                    if (clean.length > 3 && clean.length < 35 && !points.some(p => p.includes(clean) || clean.includes(p))) {
                        points.push(clean);
                    }
                });
            }
        });
        
        if (points.length > 0) refined.keyPoints = points;
    }

    if (refined.keyPoints && Array.isArray(refined.keyPoints)) {
        refined.keyPoints = refined.keyPoints
            .filter((p: any) => typeof p === 'string' && p.length > 2)
            .map((p: string) => p.replace(/^[#♥★■]\s*/, '').replace(/[\r\n]+/g, '').trim());
    } else {
        refined.keyPoints = [];
    }

    refined.url = url;
    if (Array.isArray(refined.keyPoints)) {
        const noiseSet = new Set(['ALL포함', '원 포함', '상품특전', '롯데관광 스페셜 특전', '롯데관광이 준비한 특전', '상품 특전', '정보제공', '국외여행상품 정보제공', 'top_banner', 'top_banner input', '한국출발', '크루즈 전세선 20만원할인', 'devSerchCate_Top', '256AC7', 'ffffff', 'app_banner', '_none', 'menu09', 'menu12', 'menu01']);
        const { formatTagToSentence } = require('./url-analysis');
        
        refined.keyPoints = refined.keyPoints.map((kp: string) => {
            let clean = (kp || '').trim();
            if (clean.endsWith('국제공')) clean += '항';
            return formatTagToSentence(clean);
        }).filter((clean: string) => {
            if (clean.length < 3) return false;
            if (noiseSet.has(clean)) return false;
            if (/가축|전염병|현금영수증|할부|제세공과금|특수기호|여행서비스|안전정보|국내여행|해외호텔|배송비|관세|경비|불포함|의거|출발\s*후|사정|요금|스페셜포함|단체쇼핑|친지|환불|타\s*업체|하나투어|목적만을|공항세|쇼핑센터|디자인|석식\s*후|중식\s*후|공항\s*이동/i.test(clean)) return false;
            return true;
        });
    }

    return refined;
}

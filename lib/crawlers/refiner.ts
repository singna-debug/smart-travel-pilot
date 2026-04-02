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
        const digits = refined.price.toString().replace(/[^0-9]/g, '');
        if (digits && digits !== '0') {
            refined.price = parseInt(digits, 10).toLocaleString() + '원';
        } else {
            refined.price = ''; // will trigger fallback below
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
                    if (priceNum > 10000) { // 만원 이상만 유효
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

    // 3. CITY_CODE_MAP 기반 키워드 매칭
    if (!refined.destination || refined.destination.length < 2) {
        const cities = Object.keys(CITY_CODE_MAP).sort((a, b) => b.length - a.length);
        for (const city of cities) {
            if (refined.title.includes(city)) {
                refined.destination = city;
                break;
            }
        }
    }

    // 4. 슬래시(/) 및 대괄호([]) 패턴
    if (!refined.destination || refined.destination.length < 2) {
        if (refined.title.includes('/')) {
            const titleMatchRegex = /([가-힣]{2,5}(?:\/[가-힣]{2,5})+)/g;
            let match;
            let bestDest = '';
            while ((match = titleMatchRegex.exec(refined.title)) !== null) {
                const candidate = match[1].replace(/\//g, ', ');
                const isForbidden = forbiddenWords.some(w => candidate.includes(w));
                if (!isForbidden && candidate.length > bestDest.length) {
                    bestDest = candidate;
                }
            }
            if (bestDest) refined.destination = bestDest;
        }
    }
    
    if (!refined.destination || refined.destination.length < 2) {
        const titleMatchRegex = /\[(.*?)\]/g;
        let match;
        while ((match = titleMatchRegex.exec(refined.title)) !== null) {
            const candidate = match[1];
            const isForbidden = forbiddenWords.some(w => candidate.includes(w));
            if (!isForbidden && candidate.length > 1 && candidate.length < 10) {
                refined.destination = candidate;
                break;
            }
        }
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

    // 핵심포인트(keyPoints) 보강: Gemini 결과가 부족(3개 미만)할 때 실행하거나 제목 정보를 추가
    const currentPoints = Array.isArray(refined.keyPoints) ? [...refined.keyPoints] : [];
    
    if (currentPoints.length < 3) {
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
                    const clean = m.trim().replace(/^[#♥★■]\s*/, '');
                    if (clean.length > 3 && clean.length < 35 && !points.includes(clean)) {
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
            .map((p: string) => p.replace(/^[#♥★■]\s*/, '').trim());
    } else {
        refined.keyPoints = [];
    }

    refined.url = url;
    return refined;
}

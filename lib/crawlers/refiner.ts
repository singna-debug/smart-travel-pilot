
import type { DetailedProductInfo } from '../../types';
import { formatDateString } from '../crawler-base-utils';

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
    
    if (!refined.duration || refined.duration === '미정') {
        const durationMatch = (refined.title + ' ' + originalText).match(/(\d+)\s*박\s*(\d+)\s*일/);
        if (durationMatch) {
            refined.duration = `${durationMatch[1]}박 ${durationMatch[2]}일`;
        }
    }
    
    if (refined.title.includes('/')) {
        const titleCities = refined.title.match(/([가-힣]{2,5}(?:\/[가-힣]{2,5})+)/);
        if (titleCities) {
            const cities = titleCities[1].replace(/\//g, ', ');
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

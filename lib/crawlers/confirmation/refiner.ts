/**
 * ★ 확정서 모드 전용 데이터 정제(refiner) ★
 * 
 * 이 파일은 확정서 모드만을 위한 독립 복사본입니다.
 * 노말 모드의 ../refiner.ts와 완전히 분리되어 있습니다.
 * 확정서 관련 수정은 이 파일만 수정하세요.
 */

import type { DetailedProductInfo } from '../../../types';
import { formatDateString } from '../../crawler-base-utils';

export function refineConfirmationData(info: DetailedProductInfo, originalText: string, url: string): DetailedProductInfo {
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
            refined.price = '';
        }
    }
    
    // 가격 fallback: originalText에서 가격 패턴 검색
    if (!refined.price || refined.price === '원' || refined.price === '0원') {
        const metaPriceMatch = originalText.match(/TARGET_PRICE:\s*"(\d+)"/);
        if (metaPriceMatch && metaPriceMatch[1] !== '0') {
            refined.price = parseInt(metaPriceMatch[1], 10).toLocaleString() + '원';
        } else {
            const pricePatterns = [
                /(\d{1,3}(?:,\d{3})+)\s*원/,
                /(\d+)\s*만\s*원/,
                /["'](?:price|Price|SalePrice|sellingPrice)["']\s*[:=]\s*["']?(\d+)/i
            ];
            for (const pattern of pricePatterns) {
                const match = originalText.match(pattern);
                if (match) {
                    const priceStr = match[1].replace(/,/g, '');
                    const priceNum = parseInt(priceStr, 10);
                    if (priceNum > 10000) {
                        refined.price = priceNum.toLocaleString() + '원';
                        break;
                    }
                }
            }
        }
    }
    
    if (refined.departureDate) refined.departureDate = formatDateString(refined.departureDate);
    if (refined.returnDate) refined.returnDate = formatDateString(refined.returnDate);
    
    if (!refined.duration || refined.duration === '미정') {
        const durationMatch = (refined.title + ' ' + originalText).match(/(\d+)\s*박\s*(\d+)\s*일/);
        if (durationMatch) {
            refined.duration = `${durationMatch[1]}박 ${durationMatch[2]}일`;
        }
    }
    const forbiddenWords = ['노팁', '노쇼핑', '노옵션', '출발', '확정', '특가', '단독', '기획', '모객', '특전', '스마일', '명부터', '예약', '마감', '할인', '이벤트', '시그니처', '선착순', '베스트', '홈쇼핑'];

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
        if (bestDest && (!refined.destination || refined.destination.length < bestDest.length)) {
            refined.destination = bestDest;
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

    // keyPoints 보강
    const currentPoints = Array.isArray(refined.keyPoints) ? [...refined.keyPoints] : [];
    
    if (currentPoints.length < 3) {
        const points: string[] = [...currentPoints];
        const titlePoints = refined.title.match(/\[(.*?)\]/g);
        if (titlePoints) {
            titlePoints.forEach((p: string) => {
                const clean = p.replace(/[\[\]]/g, '').trim();
                if (clean.length > 2 && clean.length < 15 && !['설연휴특가', '단독상품', '모두투어', '출발확정', '긴급모객'].includes(clean)) {
                    if (!points.includes(clean)) points.push(clean);
                }
            });
        }
        
        const patterns = [
            /([가-힣\w\s]+포함)/g,
            /([가-힣\w\s]+특전)/g,
            /([가-힣\w\s]+증정)/g,
            /([가-힣\w\s]+숙박)/g,
            /([가-힣\w\s]+체험)/g,
            /([가-힣\w\s]+방문)/g,
            /([가-힣\w\s]+제공)/g,
            /([가-힣\w\s]+투어)/g,
            /[#♥★■]\s*([가-힣\w\s&]{4,40})/g
        ];
        
        patterns.forEach(regex => {
            const matches = originalText.match(regex);
            if (matches) {
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

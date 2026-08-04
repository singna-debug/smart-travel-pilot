import type { DetailedProductInfo } from '../../types';
import { analyzeWithGemini, htmlToText, fallbackParse } from '../crawler-base-utils';
import { fetchContent, scrapeWithStealthFetch } from './fetcher';
import { refineData } from './refiner';
import { scrapeWithBrowser } from '../browser-crawler';

/**
 * 일반 URL 분석 (노멀 모드)
 */
export async function crawlTravelProduct(url: string, source?: string, apiKey?: string | null): Promise<DetailedProductInfo | null> {
    console.log(`[NormalCrawler] Start. URL=${url}`);
    const isVercel = process.env.VERCEL === '1';

    // 1. 데이터 확보
    const { text, nextData, nativeData } = await fetchContent(url, { isSummaryOnly: true });
    let finalText = text;
    let finalNextData = nextData;
    
    // 2. 브라우저 스크래핑 (데이터가 너무 부족할 때만 최후의 수단으로 사용)
    const needsMoreData = !nativeData && ((!finalText || finalText.length < 500));
    
    if (needsMoreData) {
        if (!isVercel) {
            try {
                console.log(`[NormalCrawler] Scraping with Browser for more data...`);
                const browserHtml = await scrapeWithBrowser(url, { skipClicks: true });
                if (browserHtml) {
                    if (browserHtml.length > finalText.length) finalText = browserHtml;
                }
            } catch (e) {}
        } else {
            try {
                console.log(`[NormalCrawler] Scraping with Stealth Fetch (Fallback)...`);
                const stealthHtml = await scrapeWithStealthFetch(url);
                if (stealthHtml) {
                    if (stealthHtml.length > finalText.length) finalText = stealthHtml;
                }
            } catch (e) {}
        }
    }

    // 3. 컨텍스트 구성
    let contextText = finalText;
    if (nativeData) {
        const nativePoints = Array.isArray(nativeData.keyPoints) ? nativeData.keyPoints : (typeof nativeData.keyPoints === 'string' ? [nativeData.keyPoints] : []);
        const nativeSummary = nativeData ? 
            `--- [Native API Data Summary] ---\n` +
            `상품명: ${nativeData.title || '-'}\n` +
            `가격: ${nativeData.price || '-'}\n` +
            `항공: ${nativeData.airline || '정보없음'} (${nativeData.departureAirport || '인천'} 출발)\n` +
            `[원본 상품 포인트]:\n${nativePoints.map((p: string) => '- ' + p).join('\n') || 'Native API에서 찾지 못함'}\n` +
            `----------------------------------\n\n` : '';
        // 🚀 [강화] Native 데이터가 존재하더라도 그 형식이 객체가 아니거나 가격이 '0'이면 데이터가 불완전한 것입니다.
        const isNativeValid = nativeData && typeof nativeData === 'object' && !Array.isArray(nativeData);
        const isPriceValid = isNativeValid && nativeData.price && nativeData.price !== '0' && nativeData.price !== '';
        const isDataComplete = isNativeValid && isPriceValid && nativeData.title && nativeData.title.length > 5;
        
        if (isDataComplete) {
            console.log(`[NormalCrawler] Native 데이터가 완벽하여(가격:${nativeData.price}) 초경량 AI 모드로 3초 이내 분석을 시도합니다.`);
            contextText = nativeSummary; // HTML 텍스트 제외!
        } else {
            console.log(`[NormalCrawler] Native 데이터 불충분/오류(가격:${nativeData?.price || 'null'}). 심층 분석을 위해 전체 HTML을 포함합니다.`);
            contextText = (nativeSummary || '') + (finalText || '');
        }
    }

    // 4. Gemini 분석 (최적화된 프롬프트 사용 - 초경량 모드인 경우 1~2초 소요)
    const aiResult = await analyzeWithGemini(contextText, url, true, finalNextData, apiKey);
    
    if (aiResult) {
        const merged = { ...aiResult };
        if (nativeData) {
            // [MASTER DATA 우선순위] Native API 데이터가 있다면 AI 결과보다 우선시합니다 (정확도 100%)
            // Gemini가 'undefined'를 문자열로 반환하거나 일정을 뭉개는 현상을 완벽 차단합니다.
            if (nativeData.title) merged.title = nativeData.title;
            if (nativeData.price && nativeData.price !== '0') merged.price = nativeData.price;
            if (nativeData.airline) merged.airline = nativeData.airline;
            if (nativeData.departureDate) merged.departureDate = nativeData.departureDate;
            if (nativeData.returnDate) merged.returnDate = nativeData.returnDate;
            if (nativeData.departureAirport) merged.departureAirport = nativeData.departureAirport;
            if (nativeData.destination) merged.destination = nativeData.destination;
            if (nativeData.duration && nativeData.duration !== '미정') merged.duration = nativeData.duration;
            
            if (nativeData.itinerary && Array.isArray(nativeData.itinerary) && nativeData.itinerary.length > 0) {
                merged.itinerary = nativeData.itinerary;
            }
            if (nativeData.hotels) merged.hotels = nativeData.hotels;
            if (nativeData.inclusions) merged.inclusions = nativeData.inclusions;
            if (nativeData.exclusions) merged.exclusions = nativeData.exclusions;
            if (nativeData.cancellationPolicy) merged.cancellationPolicy = nativeData.cancellationPolicy;
            if (nativeData.departureSegments) merged.departureSegments = nativeData.departureSegments;
            if (nativeData.returnSegments) merged.returnSegments = nativeData.returnSegments;

            if (String(merged.airline).toLowerCase() === 'undefined') merged.airline = nativeData.airline || '';
            if (String(merged.departureAirport).toLowerCase() === 'undefined') merged.departureAirport = nativeData.departureAirport || '인천';
            
            if ((!merged.keyPoints || merged.keyPoints.length < 3) && nativeData.keyPoints) {
                merged.keyPoints = [...new Set([...(merged.keyPoints || []), ...nativeData.keyPoints])];
            }
        }
        merged.keyPoints = synthesizeKeyPoints(merged);
        const finalResult = refineData(merged, contextText, url);
        // --- [3] 최종 반환 데이터 (CCTV 3) ---
        console.log('--- [3] 최종 반환 데이터 ---', JSON.stringify(finalResult).substring(0, 300));
        return finalResult;
    }
    
    const finalFallback = nativeData 
        ? refineData(nativeData, contextText, url) 
        : refineData(fallbackParse(finalText), finalText, url);
    if (finalFallback) {
        finalFallback.keyPoints = synthesizeKeyPoints(finalFallback);
    }
    // --- [3] 최종 반환 데이터 (CCTV 3 - Fallback) ---
    console.log('--- [3] 최종 반환 데이터 (Fallback) ---', JSON.stringify(finalFallback).substring(0, 300));
    return finalFallback;
}

/** 이모지 및 특수기호 접두사 제거 */
function stripEmoji(text: string): string {
    return text
        .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}✈🧚🍗♨🍷🏨🚌🌟★♥▶▒◆•●📌🍽🎑🌊🧧🚢✨]+/gu, '')
        .replace(/^\s+/, '')
        .trim();
}

/** 비교를 위한 텍스트 정규화 (공백, 기호, 추임새 제거) */
function normalizeTextForComparison(str: string): string {
    return stripEmoji(str)
        .replace(/[^\w\u3131-\u318E\uAC00-\uD7A3]/g, '')
        .replace(/(이용|포함|제공|포함된|특전|혜택|포함|전일정)/g, '');
}

/** 이모지 및 어휘 차이를 무시하고 핵심 내용이 동일/유사한지 비교 */
function isSimilarContent(a: string, b: string): boolean {
    const sa = stripEmoji(a);
    const sb = stripEmoji(b);
    if (sa === sb) return true;
    
    const na = normalizeTextForComparison(a);
    const nb = normalizeTextForComparison(b);
    if (na === nb) return true;
    if (na.length >= 8 && nb.length >= 8) {
        if (na.includes(nb) || nb.includes(na)) return true;
    }
    return false;
}

/**
 * keyPoints가 부실하면 제목+일정 데이터를 종합하여 상품 포인트를 자동 생성한다.
 * - 이미 이모지 헤더가 있는 rich point는 이모지 제거 후 텍스트만 유지
 * - #해시태그만 있거나 아예 없을 때: 제목에서 주요 키워드를 뽑고, itinerary를 분석하여 개조식 포인트 생성
 */
function synthesizeKeyPoints(data: any): string[] {
    const existing: string[] = Array.isArray(data.keyPoints) ? data.keyPoints : [];
    
    // 이미 이모지/특수기호로 시작하는 풍부한 포인트가 3개 이상이면 이모지 제거 후 중복 제거하여 반환
    const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const richPoints = existing.filter(p => emojiRegex.test(p) && p.length > 10);
    if (richPoints.length >= 3) {
        return deduplicatePoints(existing.map(stripEmoji).filter(p => p.length > 3));
    }

    const title = data.title || '';
    const synthesized: string[] = [];
    
    // 기존 rich 포인트만 보존 (이모지 시작 + 충분한 길이)
    for (const p of existing) {
        if (emojiRegex.test(p) && p.length > 10) {
            synthesized.push(p);
        }
    }

    // Helper: 이미 비슷한 내용이 있는지 확인
    const hasSimilar = (keyword: string) => synthesized.some(p => p.includes(keyword));

    // 1. 항공사 포인트
    const airline = data.airline || '';
    if (airline && airline !== '정보없음' && !hasSimilar(airline)) {
        const depAirport = data.departureAirport || '인천';
        synthesized.push(`✈️ ${airline} 탑승 (${depAirport} 출발)`);
    }

    // 2. 목적지 도시 분석 → 핵심 관광 포인트
    const titleCities: string[] = [];
    const cityKeywords = ['홍콩', '마카오', '심천', '오사카', '교토', '나라', '도쿄', '후쿠오카', '삿포로', 
        '다낭', '호이안', '나트랑', '하노이', '방콕', '파타야', '푸켓', '세부', '보라카이', '싱가포르',
        '이네', '우지', '아라시야마', '나고야', '시라하마', '와카야마', '노보리베츠', '오타루', '도야'];
    for (const city of cityKeywords) {
        if (title.includes(city)) titleCities.push(city);
    }
    if (titleCities.length >= 2 && !hasSimilar('핵심 관광')) {
        synthesized.push(`🌟 ${titleCities.join('/')} ${titleCities.length}개 도시 핵심 관광!`);
    }

    // 3. 제목 해시태그 → 카테고리별 이모지 포인트 변환
    const hashtags = title.match(/#[^\s#]+/g) || [];
    for (const tag of hashtags) {
        const clean = tag.replace(/^#/, '').replace(/!$/, '').trim();
        if (clean.length < 2) continue;
        if (hasSimilar(clean)) continue;
        // PICK, 담당자 등 내부용 태그는 스킵
        if (/PICK|담당자|추천|인기/i.test(clean)) continue;
        
        if (clean.includes('온천') || clean.includes('노천')) {
            synthesized.push(`♨️ ${clean} 포함`);
        } else if (clean.includes('호텔') || clean.includes('숙박') || clean.includes('리조트')) {
            synthesized.push(`🏨 ${clean}`);
        } else if (clean.includes('특식') || clean.includes('뷔페') || clean.includes('무제한') || clean.includes('주류') || clean.includes('음료')) {
            synthesized.push(`🍽️ ${clean}`);
        } else if (clean.includes('노옵션') || clean.includes('노쇼핑')) {
            synthesized.push(`🌟 ${clean}`);
        } else if (clean.includes('전세기') || clean.includes('직항')) {
            synthesized.push(`✈️ ${clean}`);
        } else if (clean.length >= 3 && !clean.match(/^\d/)) {
            // 일반 태그: 관광지명이나 특징
            synthesized.push(`📌 ${clean}`);
        }
    }

    // 4. 일정에서 특식/온천/유람선 등 하이라이트 추출
    const itinerary = Array.isArray(data.itinerary) ? data.itinerary : [];
    
    let hasOnsen = false;
    let hasSpecialMeal = false;
    let hasCruise = false;
    
    for (const day of itinerary) {
        const items = day.items || day.timeline || [];
        for (const item of items) {
            const itemTitle = typeof item === 'string' ? item : (item?.title || '');
            if (!itemTitle) continue;
            
            // 특식 감지
            if (!hasSpecialMeal && (itemTitle.includes('특식') || itemTitle.includes('뷔페') || 
                itemTitle.includes('무제한') || itemTitle.includes('노미호다이') || 
                itemTitle.includes('샤브샤브') || itemTitle.includes('대게'))) {
                if (!hasSimilar('특식') && !hasSimilar('무제한') && !hasSimilar('뷔페')) {
                    synthesized.push('🍽️ 지역 특색을 살린 현지 특식 포함!');
                    hasSpecialMeal = true;
                }
            }
            // 온천 감지
            if (!hasOnsen && (itemTitle.includes('온천') || itemTitle.includes('♨'))) {
                if (!hasSimilar('온천')) {
                    synthesized.push('♨️ 온천 체험 포함');
                    hasOnsen = true;
                }
            }
            // 유람선/크루즈 감지
            if (!hasCruise && (itemTitle.includes('유람선') || itemTitle.includes('크루즈') || itemTitle.includes('모노레일'))) {
                if (!hasSimilar('유람선') && !hasSimilar('크루즈')) {
                    synthesized.push('🚢 유람선/크루즈 탑승 포함');
                    hasCruise = true;
                }
            }
        }
    }

    // 5. 제목에서 특별 키워드 추출 (해시태그 외)
    if (title.includes('추석') && !hasSimilar('추석')) {
        synthesized.push('🎑 추석 연휴 특별 기획 상품');
    } else if (title.includes('여름') && !hasSimilar('여름')) {
        synthesized.push('🌊 여름 시즌 특별 기획');
    } else if (title.includes('설날') || title.includes('설연휴')) {
        synthesized.push('🧧 설 연휴 특별 기획 상품');
    }

    // 최종: 이모지 제거 + 내용 기반 중복 제거 + 최대 6개
    const stripped = synthesized.map(stripEmoji).filter(p => p.length > 3);
    return deduplicatePoints(stripped);
}

/** 내용 기반 중복 제거 (앞쪽 우선) */
function deduplicatePoints(points: string[]): string[] {
    const result: string[] = [];
    for (const p of points) {
        if (!result.some(existing => isSimilarContent(existing, p))) {
            result.push(p);
        }
        if (result.length >= 6) break;
    }
    return result;
}

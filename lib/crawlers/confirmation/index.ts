
import type { DetailedProductInfo } from '../../../types';
import { analyzeWithGemini } from '../../crawler-base-utils';
import { fetchContent } from '../fetcher';
import { refineData } from '../refiner';
import { fetchModeTourNative } from '../modetour-utils';
import { scrapeForConfirmation } from './crawler';
import { CONFIRMATION_PROMPT } from './prompt';
import { mergeNativeData, logDiagnostic } from './utils';

/**
 * 최종 확정용 심층 분석 (컨퍼메이션 모드)
 * 모든 상세 정보를 가장 정밀하게 추출합니다.
 */
export async function crawlForConfirmation(url: string, providedText?: string, providedNextData?: string): Promise<DetailedProductInfo | null> {
    console.log(`[Confirmation/Index] Start. URL=${url}, hasProvidedText: ${!!providedText}`);

    // 1. 데이터 확보
    let text = providedText || '';
    let nextData = providedNextData || '';
    let nativeData: any = null;

    if (!text) {
        console.log('[Confirmation/Index] No text provided. Attempting Specialized Browser Scraper and Native API...');
        const [browserText, fetchedNative] = await Promise.all([
            scrapeForConfirmation(url),
            fetchModeTourNative(url, false).catch(() => null)
        ]);
        
        text = browserText || '';
        nativeData = fetchedNative;
        
        if (!text) {
            console.log('[Confirmation/Index] Falling back to fetchContent (Regular Fetch)...');
            const { text: fallbackText, nativeData: fallbackNative } = await fetchContent(url, { isSummaryOnly: false });
            text = fallbackText;
            if (!nativeData) nativeData = fallbackNative;
        }
    }
    
    // [심층 진단] 파일로 저장하여 확인 가능하게 함
    try {
        const fs = require('fs');
        const path = require('path');
        const debugPath = path.join(process.cwd(), 'tmp', 'last_confirmation_debug.json');
        fs.writeFileSync(debugPath, JSON.stringify({ 
            timestamp: new Date().toISOString(),
            url, 
            textLength: text.length, 
            hasNativeData: !!nativeData,
            nativeDataSummary: nativeData ? { 
                title: nativeData.title, 
                itineraryDays: nativeData.itinerary?.length || 0 
            } : null,
            textSample: text.substring(0, 2000)
        }, null, 2));
        console.log(`[Confirmation/Index] Debug info saved to: ${debugPath}`);
    } catch (e: any) {
        console.warn('[Confirmation/Index] Failed to save debug log:', e.message);
    }

    if (!text) {
        console.error('[Confirmation/Index] Failed to acquire text content.');
        return null;
    }
    
    // [진단 로그]
    logDiagnostic(url, text, nativeData);

    // [Lite AI 모드 적용] Normal 모드와 동일하게 Native 데이터가 충분하면 HTML 전송을 최소화합니다.
    const isNativeGood = nativeData && nativeData.title && nativeData.price && nativeData.itinerary?.length > 0;
    
    let contextText = '';
    const nativeSummary = nativeData ? 
        `--- [AI-Ready Native API Data] ---\n` +
        `상품명: ${nativeData.title}\n` +
        `가격: ${nativeData.price}\n` +
        `항공: ${nativeData.airline} (${nativeData.departureAirport} 출발)\n` +
        `편명: 가는편(${nativeData.departureFlightNumber}), 오는편(${nativeData.returnFlightNumber})\n` +
        `시간: 가는편(${nativeData.departureTime} 출발), 오는편(${nativeData.returnDepartureTime} 출발)\n` +
        `호텔: ${nativeData.hotels?.map((h: any) => h.name).join(', ') || '정보없음'}\n` +
        `미팅: ${nativeData.meetingInfo?.map((m: any) => `${m.location} (${m.time})`).join(' | ') || '정보없음'}\n` +
        `취소규정: ${nativeData.cancellationPolicy?.substring(0, 1000) || '정보없음'}\n` +
        `일정표데이터: ${JSON.stringify(nativeData.itinerary).substring(0, 15000)}\n` +
        `----------------------------------\n\n` : '';

    if (isNativeGood) {
        console.log('[Confirmation/Index] Native 데이터가 완벽하여 Lite AI 모드로 정밀 분석을 수행합니다.');
        contextText = nativeSummary; // 7만자 HTML 대신 요약본만!
    } else {
        console.log('[Confirmation/Index] Native 데이터 불충분. HTML 전체 분석을 수행합니다.');
        contextText = nativeSummary + text.substring(0, 50000); // 7만 -> 5만으로 약간 축소
    }

    const fullPrompt = `${CONFIRMATION_PROMPT}
    
    입력된 데이터:
    URL: ${url}
    ${contextText}`;

    // 2. 분석 수행
    const result = await analyzeWithGemini(fullPrompt, url, false, nextData);
    console.log(`[Confirmation/Index] Gemini Analysis Result:`, result ? 'Success' : 'Failed');

    // AI 분석 결과 (성공/실패 모두) 디버그에 기록
    try {
        const fs = require('fs');
        const path = require('path');
        const debugPath = path.join(process.cwd(), 'tmp', 'last_confirmation_debug.json');
        const currentDebug = JSON.parse(fs.readFileSync(debugPath, 'utf8'));
        currentDebug.geminiResult = result ? 'SUCCESS' : 'FAILED (null)';
        currentDebug.geminiRawKeys = result ? Object.keys(result) : [];
        currentDebug.geminiSample = result ? {
            airline: result.airline,
            departureFlightNumber: result.departureFlightNumber,
            departureTime: result.departureTime,
            hotels: result.hotels?.length || 0,
            itinerary: result.itinerary?.length || 0,
            inclusions: result.inclusions?.length || 0,
            exclusions: result.exclusions?.length || 0,
            meetingInfo: result.meetingInfo?.length || 0,
        } : null;
        fs.writeFileSync(debugPath, JSON.stringify(currentDebug, null, 2));
    } catch (e) {}
    
    if (result) {
        let merged = result;
        // Native 데이터가 있다면 보강
        if (nativeData) {
            merged = mergeNativeData(result, nativeData);
        }

        const refined = refineData(merged, text, url);
        
        // 최종 결과도 로그에 기록
        try {
            const fs = require('fs');
            const path = require('path');
            const debugPath = path.join(process.cwd(), 'tmp', 'last_confirmation_debug.json');
            const currentDebug = JSON.parse(fs.readFileSync(debugPath, 'utf8'));
            currentDebug.finalResult = refined;
            fs.writeFileSync(debugPath, JSON.stringify(currentDebug, null, 2));
        } catch (e) {}

        console.log(`[Confirmation/Index] Refined Result finalized.`);
        return refined;
    }
    
    // 분석 실패 시 Native 데이터라도 있다면 활용
    const finalResult = nativeData ? refineData(nativeData, text, url) : null;
    return finalResult;
}

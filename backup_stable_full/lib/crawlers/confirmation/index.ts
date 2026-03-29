
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

    const fullPrompt = `${CONFIRMATION_PROMPT}
    
    입력된 데이터(HTML 텍스트 요약 및 Native API 데이터):
    URL: ${url}
    ${nativeData ? `--- [Native API Data] ---\n${JSON.stringify(nativeData)}\n` : ''}
    --- [Page Scraped Content] ---
    ${text.substring(0, 70000)}`;

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

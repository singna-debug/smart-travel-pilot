
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
 * 핵심 원칙: Native API 데이터가 충분하면 Gemini를 거치지 않고 직접 사용.
 * Gemini를 통과시키면 할루시네이션이 발생하므로, AI는 최후의 수단으로만 사용.
 */
export async function crawlForConfirmation(url: string, providedText?: string, providedNextData?: string): Promise<DetailedProductInfo | null> {
    console.log(`[Confirmation/Index] Start. URL=${url}, hasProvidedText: ${!!providedText}`);

    let text = providedText || '';
    let nextData = providedNextData || '';
    let nativeData: any = null;

    // ===== 1단계: Native API로 구조화된 데이터 확보 =====
    try {
        nativeData = await fetchModeTourNative(url, false).catch(() => null);
        console.log(`[Confirmation/Index] Native API result: ${nativeData ? 'SUCCESS' : 'FAILED'}`);
    } catch (e) {
        console.error('[Confirmation/Index] Native API error:', e);
    }

    // ===== 2단계: Native 데이터가 충분한지 판단 =====
    const nativeHasItinerary = nativeData?.itinerary && Array.isArray(nativeData.itinerary) && nativeData.itinerary.length > 0;
    const nativeHasTitle = !!nativeData?.title;
    const nativeIsSufficient = nativeHasItinerary && nativeHasTitle;

    console.log(`[Confirmation/Index] Native sufficient: ${nativeIsSufficient} (itinerary: ${nativeData?.itinerary?.length || 0} days, title: ${nativeHasTitle})`);

    // [진단 로그 저장]
    try {
        const fs = require('fs');
        const path = require('path');
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const debugPath = path.join(tmpDir, 'last_confirmation_debug.json');
        fs.writeFileSync(debugPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            url,
            strategy: nativeIsSufficient ? 'NATIVE_DIRECT (no Gemini)' : 'GEMINI_FALLBACK',
            hasNativeData: !!nativeData,
            nativeDataSummary: nativeData ? {
                title: nativeData.title,
                airline: nativeData.airline,
                departureFlightNumber: nativeData.departureFlightNumber,
                itineraryDays: nativeData.itinerary?.length || 0,
                hotelsCount: nativeData.hotels?.length || 0,
                inclusionsCount: nativeData.inclusions?.length || 0,
            } : null,
        }, null, 2));
    } catch (e) {}

    // ===== 3단계: 충분하면 Gemini 없이 직접 반환 =====
    if (nativeIsSufficient) {
        console.log('[Confirmation/Index] Native data is sufficient. SKIPPING Gemini to avoid hallucinations.');
        const refined = refineData(nativeData, text || JSON.stringify(nativeData), url);
        
        // 최종 결과 로그
        try {
            const fs = require('fs');
            const path = require('path');
            const debugPath = path.join(process.cwd(), 'tmp', 'last_confirmation_debug.json');
            const currentDebug = JSON.parse(fs.readFileSync(debugPath, 'utf8'));
            currentDebug.finalResult = refined;
            currentDebug.geminiResult = 'SKIPPED (native sufficient)';
            fs.writeFileSync(debugPath, JSON.stringify(currentDebug, null, 2));
        } catch (e) {}

        return refined;
    }

    // ===== 4단계: Native 부족 시 텍스트 확보 후 Gemini 분석 =====
    console.log('[Confirmation/Index] Native data insufficient. Falling back to Gemini analysis...');
    
    if (!text) {
        const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
        if (!isVercel) {
            // 로컬: 브라우저 스크래핑 시도
            text = await scrapeForConfirmation(url) || '';
        }
        if (!text) {
            const { text: fallbackText, nativeData: fallbackNative } = await fetchContent(url, { isSummaryOnly: false });
            text = fallbackText;
            if (!nativeData) nativeData = fallbackNative;
        }
    }

    if (!text) {
        console.error('[Confirmation/Index] No text available for Gemini.');
        // Native 데이터라도 있으면 그걸 반환
        return nativeData ? refineData(nativeData, '', url) : null;
    }

    logDiagnostic(url, text, nativeData);

    const fullPrompt = `${CONFIRMATION_PROMPT}
    
    입력된 데이터(HTML 텍스트 요약):
    URL: ${url}
    --- [Page Scraped Content] ---
    ${text.substring(0, 70000)}`;

    const result = await analyzeWithGemini(fullPrompt, url, false, nextData);
    console.log(`[Confirmation/Index] Gemini Result:`, result ? 'Success' : 'Failed');

    // 결과 로그
    try {
        const fs = require('fs');
        const path = require('path');
        const debugPath = path.join(process.cwd(), 'tmp', 'last_confirmation_debug.json');
        const currentDebug = JSON.parse(fs.readFileSync(debugPath, 'utf8'));
        currentDebug.geminiResult = result ? 'SUCCESS' : 'FAILED';
        currentDebug.geminiSample = result ? {
            airline: result.airline,
            itinerary: result.itinerary?.length || 0,
            hotels: result.hotels?.length || 0,
        } : null;
        currentDebug.finalResult = result;
        fs.writeFileSync(debugPath, JSON.stringify(currentDebug, null, 2));
    } catch (e) {}

    if (result) {
        let merged = result;
        if (nativeData) merged = mergeNativeData(result, nativeData);
        return refineData(merged, text, url);
    }

    return nativeData ? refineData(nativeData, text, url) : null;
}

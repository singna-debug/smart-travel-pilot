
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
        if (url.includes('modetour.com') || url.includes('modetour.co.kr')) {
            const { crawlConfirmationModeTour } = await import('./modetour');
            nativeData = await crawlConfirmationModeTour(url).catch(() => null);
        } else if (url.includes('hanatour.com')) {
            const { crawlConfirmationHanaTour } = await import('./hanatour');
            nativeData = await crawlConfirmationHanaTour(url).catch(() => null);
        } else if (url.includes('ybtour.co.kr') || url.includes('yellowballoon.co.kr')) {
            const { crawlConfirmationYellowBalloon } = await import('./yellowballoon');
            nativeData = await crawlConfirmationYellowBalloon(url).catch(() => null);
        } else if (url.includes('lottetour.com')) {
            const { crawlConfirmationLotteTour } = await import('./lottetour');
            nativeData = await crawlConfirmationLotteTour(url).catch(() => null);
        } else if (url.includes('hanjintravel.com') || url.includes('kaltour.com')) {
            const { crawlConfirmationHanjinTravel } = await import('./hanjintravel');
            nativeData = await crawlConfirmationHanjinTravel(url).catch(() => null);
        }
        console.log(`[Confirmation/Index] Native API result: ${nativeData ? 'SUCCESS' : 'FAILED'}`);
    } catch (e) {
        console.error('[Confirmation/Index] Native API error:', e);
    }

    // ===== 2단계: Native 데이터가 충분한지 판단 =====
    const nativeHasItinerary = nativeData?.itinerary && Array.isArray(nativeData.itinerary) && nativeData.itinerary.length > 0;
    const nativeHasTitle = !!nativeData?.title && nativeData.title.length > 3;
    const isYBOrLT = url.includes('ybtour.co.kr') || url.includes('yellowballoon.co.kr') || url.includes('lottetour.com');
    // 노랑풍선, 롯데관광은 native 일정표가 없으면 Puppeteer + Gemini로 이동하여 완벽한 일정표 생성
    const nativeIsSufficient = isYBOrLT ? (nativeHasTitle && nativeHasItinerary) : nativeHasTitle;

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

        // [추가] 원본 데이터 무조건 저장 (필드 추적용)
        if (nativeData) {
            fs.writeFileSync(path.join(tmpDir, 'full_native_data.json'), JSON.stringify(nativeData, null, 2));
        }
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

    // 하단 약관 및 가축/현금영수증/마일리지 쓰레기 텍스트 완전 제거
    const cleanText = text
        .split('\n')
        .filter(l => !/가축전염병|현금영수증|할부\s*서비스|제공하는\s*서비스|개인정보|이용약관|사업자등록번호|통신판매업|저작권|부동산|배송비|관세/i.test(l))
        .join('\n');

    const fullPrompt = `${CONFIRMATION_PROMPT}
    
    입력된 데이터(HTML 텍스트 요약):
    URL: ${url}
    --- [Page Scraped Content] ---
    ${cleanText.substring(0, 50000)}`;

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

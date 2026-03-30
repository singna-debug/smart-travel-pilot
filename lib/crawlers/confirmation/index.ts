import type { DetailedProductInfo } from '../../../types';
import { analyzeWithGemini } from '../../crawler-base-utils';
import { fetchConfirmationNative } from './modetour-native';
import { refineConfirmationData } from './refiner';
import { scrapeForConfirmation } from './crawler';
import { CONFIRMATION_PROMPT } from './prompt';
import { mergeNativeData, logDiagnostic } from './utils';

/**
 * ★ 확정서 전용 심층 분석 (v3 초고속) ★
 * 목표: 20~28초. Vercel 30초 타임아웃 준수.
 * 
 * 최적화:
 *   1. Native API + Scraper 병렬 실행 (Promise.all)
 *   2. 텍스트 초강력 다이어트 (불필요한 약관/정책 제거, 핵심만 8000자)
 *   3. 프롬프트 극단적 축소 (1800 bytes)
 *   4. itinerary JSON은 Native에서 이미 구조화 → AI에게는 최소 힌트만
 */

// ── 텍스트 정제: 모드투어 약관/정책/광고 등 불필요한 텍스트 제거 ──
function dietText(raw: string, maxLen: number): string {
    let t = raw;
    // 1. 약관/정책/광고 블록 제거
    const junkPatterns = [
        /취소\s*및\s*환불\s*규정[\s\S]{0,3000}?(?=\n\n|\n---|\n[A-Z가-힣]|$)/gi,
        /여행약관[\s\S]{0,2000}?(?=\n\n|$)/gi,
        /특별약관[\s\S]{0,2000}?(?=\n\n|$)/gi,
        /개인정보[\s\S]{0,1500}?(?=\n\n|$)/gi,
        /보험\s*안내[\s\S]{0,1000}?(?=\n\n|$)/gi,
        /예약\s*시\s*유의[\s\S]{0,1500}?(?=\n\n|$)/gi,
        /고객\s*센터[\s\S]{0,500}?(?=\n\n|$)/gi,
        /Copyright[\s\S]{0,500}?(?=\n\n|$)/gi,
        /모두투어\s*소개[\s\S]{0,1000}?(?=\n\n|$)/gi,
        /쿠키\s*정책[\s\S]{0,500}?(?=\n\n|$)/gi,
        /관련\s*상품\s*추천[\s\S]{0,2000}?(?=\n\n|$)/gi,
    ];
    junkPatterns.forEach(p => { t = t.replace(p, ''); });
    
    // 2. 빈 줄 정리
    t = t.replace(/\n{3,}/g, '\n\n').replace(/\s{3,}/g, ' ').trim();
    
    // 3. 강제 절단
    return t.substring(0, maxLen);
}

export async function crawlForConfirmation(url: string, providedText?: string, providedNextData?: string): Promise<DetailedProductInfo | null> {
    console.time('[Confirm] TOTAL');
    const startTime = Date.now();
    const isVercel = process.env.VERCEL === '1';
    console.log(`[Confirm] Start. URL=${url}, isVercel=${isVercel}`);

    // ═══════════════════════════════════════════════════════
    // 1. 데이터 확보 — 무조건 병렬 (Promise.all)
    // ═══════════════════════════════════════════════════════
    console.time('[Confirm] FETCH');
    let text = providedText || '';
    let nextData = providedNextData || '';
    let nativeData: any = null;

    if (text) {
        nativeData = await fetchConfirmationNative(url).catch(() => null);
    } else {
        const [fetchedNative, browserText] = await Promise.all([
            fetchConfirmationNative(url).catch(() => null),
            scrapeForConfirmation(url).catch(() => null)
        ]);
        nativeData = fetchedNative;
        text = browserText || '';

        if (!text && !nativeData) {
            nativeData = await fetchConfirmationNative(url).catch(() => null);
        }
    }
    console.timeEnd('[Confirm] FETCH');
    console.log(`[Confirm] TextLen=${text.length}, HasNative=${!!nativeData}`);

    // ═══════════════════════════════════════════════════════
    // 2. Native 품질 평가 + 조기 반환
    // ═══════════════════════════════════════════════════════
    const isNativeGood = nativeData && nativeData.title && nativeData.price && nativeData.itinerary?.length > 0;
    
    if (!text && !isNativeGood) {
        console.timeEnd('[Confirm] TOTAL');
        return nativeData ? refineConfirmationData(nativeData, '', url) : null;
    }

    logDiagnostic(url, text, nativeData);

    // ═══════════════════════════════════════════════════════
    // 3. 초강력 텍스트 다이어트 + AI 컨텍스트 구성
    // ═══════════════════════════════════════════════════════
    console.time('[Confirm] DIET');
    
    // Native 골격 (핵심 정보만, 취소규정은 500자로 자르기)
    const nativeSkeleton = nativeData ?
        `[Native]\n` +
        `상품:${nativeData.title}\n` +
        `가격:${nativeData.price}\n` +
        `항공:${nativeData.airline}\n` +
        `공항:${nativeData.departureAirport||'인천'}\n` +
        `출발:${nativeData.departureDate||''}\n` +
        `귀국:${nativeData.returnDate||''}\n` +
        `기간:${nativeData.duration||''}\n` +
        `호텔:${(nativeData.hotels||[]).map((h:any)=>h.name).join(',')}\n` +
        `미팅:${JSON.stringify(nativeData.meetingInfo||[])}\n` +
        `포함:${JSON.stringify(nativeData.inclusions||[])}\n` +
        `불포함:${JSON.stringify(nativeData.exclusions||[])}\n` +
        `취소규정:${(nativeData.cancellationPolicy||'').substring(0,500)}\n` +
        `일정:${JSON.stringify(nativeData.itinerary||[]).substring(0,20000)}` : '';

    let contextText: string;

    if (isNativeGood) {
        // Lite: Native 완벽 → 스크랩은 일정 및 항공 확인용 20000자
        const dietedText = text ? dietText(text, 20000) : '';
        contextText = `${nativeSkeleton}\n\n[본문-간략일정의 모든 관광지를 여기서 확인]\n${dietedText}`;
    } else {
        // Full: Native 부족 → 스크랩 25000자
        const dietedText = text ? dietText(text, 25000) : '';
        contextText = `${nativeSkeleton}\n\n[본문-간략일정의 모든 관광지를 여기서 추출]\n${dietedText}`;
    }
    
    console.timeEnd('[Confirm] DIET');
    console.log(`[Confirm] Context size: ${contextText.length} chars (Native:${nativeSkeleton.length} + Text:${contextText.length - nativeSkeleton.length})`);
    console.log(`--- Vercel 전송 텍스트 길이 ---`, contextText.length);

    // Fail Fast: 텍스트가 너무 짧으면 제미나이 호출 취소
    if (contextText.length < 1000) {
        throw new Error("크롤링 실패: 텍스트가 너무 짧습니다 (1000자 이하). Vercel 환경에서 데이터 수집에 실패했습니다.");
    }

    const fullPrompt = `${CONFIRMATION_PROMPT}\n\nURL:${url}\n${contextText}`;

    // ═══════════════════════════════════════════════════════
    // 4. Gemini AI 분석 (타이밍 측정)
    // ═══════════════════════════════════════════════════════
    console.time('[Confirm] GEMINI');
    const result = await analyzeWithGemini(fullPrompt, url, false, nextData);
    console.timeEnd('[Confirm] GEMINI');

    if (result) {
        let merged = result;
        if (nativeData) merged = mergeNativeData(result, nativeData);
        const refined = refineConfirmationData(merged, text, url);
        const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Confirm] ✅ Done in ${totalSec}s`);
        console.timeEnd('[Confirm] TOTAL');
        return refined;
    }

    // AI 실패 → Native fallback
    if (nativeData) {
        const refined = refineConfirmationData(nativeData, text, url);
        const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[Confirm] ✅ Native fallback in ${totalSec}s`);
        console.timeEnd('[Confirm] TOTAL');
        return refined;
    }

    console.timeEnd('[Confirm] TOTAL');
    return null;
}

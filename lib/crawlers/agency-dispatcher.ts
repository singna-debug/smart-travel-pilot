import type { DetailedProductInfo } from '../types';

/**
 * 여행사별 전용 크롤링 모듈 디스패처
 * - 각 여행사별 크롤링 로직은 전용 파일에 격리되어 있습니다:
 *   1. 모두투어: modetour-utils.ts
 *   2. 한진트래블: hanjintravel-utils.ts
 */
export async function dispatchToAgency(
    url: string, 
    mode: 'normal' | 'confirmation' | 'booking' = 'normal'
): Promise<DetailedProductInfo | null> {
    const isSummaryOnly = mode === 'normal';

    try {
        // 1. 모두투어 (ModeTour)
        if (url.includes('modetour.com') || url.includes('modetour.co.kr')) {
            console.log(`[AgencyDispatcher] Dispatching to ModeTour for mode: ${mode}`);
            const { fetchModeTourNative } = await import('./modetour-utils');
            return await fetchModeTourNative(url, isSummaryOnly);
        }

        // 2. 하나투어 (HanaTour)
        if (url.includes('hanatour.com')) {
            console.log(`[AgencyDispatcher] Dispatching to HanaTour for mode: ${mode}`);
            const { fetchHanaTourNative } = await import('./hanatour-utils');
            return await fetchHanaTourNative(url, isSummaryOnly);
        }


        // 3. 한진트래블 (Hanjin Travel)
        if (url.includes('hanjintravel.com') || url.includes('kaltour.com')) {
            console.log(`[AgencyDispatcher] Dispatching to HanjinTravel for mode: ${mode}`);
            const { fetchHanjinTravelNative } = await import('./hanjintravel-utils');
            return await fetchHanjinTravelNative(url, isSummaryOnly);
        }


    } catch (e) {
        console.error(`[AgencyDispatcher] Error dispatching URL: ${url}`, e);
    }

    return null;
}

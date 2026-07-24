import type { DetailedProductInfo } from '../types';

export async function dispatchToAgency(
    url: string, 
    mode: 'normal' | 'confirmation' | 'booking' = 'normal'
): Promise<DetailedProductInfo | null> {
    const isSummaryOnly = mode === 'normal';

    try {
        // 1. 노랑풍선 (Yellow Balloon)
        if (url.includes('ybtour.co.kr') || url.includes('yellowballoon.co.kr')) {
            console.log(`[AgencyDispatcher] Dispatching to YellowBalloon for mode: ${mode}`);
            const { fetchYellowBalloonNative } = await import('./yellowballoon-utils');
            return await fetchYellowBalloonNative(url, isSummaryOnly);
        }

        // 2. 롯데관광 (Lotte Tour)
        if (url.includes('lottetour.com')) {
            console.log(`[AgencyDispatcher] Dispatching to LotteTour for mode: ${mode}`);
            const { fetchLotteTourNative } = await import('./lottetour-utils');
            return await fetchLotteTourNative(url, isSummaryOnly);
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

    return null; // fallthrough to existing Modetour & Hanatour crawlers
}

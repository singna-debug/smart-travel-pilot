import { fetchHanjinTravelNative } from '../hanjintravel-utils';
import type { DetailedProductInfo } from '../../types';

export async function analyzeHanjinTravelUrl(url: string): Promise<DetailedProductInfo | null> {
    console.log(`[URL-Analysis/HanjinTravel] Parsing summary for: ${url}`);
    let native = await fetchHanjinTravelNative(url, true);
    
    // Fallback to AI scraper if native parser returned empty or generic placeholder data
    if (!native || !native.title || native.title === '한진관광 패키지 상품' || native.title === '한진트래블' || !native.price || !/\d/.test(native.price) || native.price.includes('없음')) {
        try {
            const { crawlTravelProduct } = await import('../../url-crawler');
            const aiRes = await crawlTravelProduct(url).catch(() => null);
            if (aiRes && aiRes.title && !aiRes.title.includes('한진트래블')) {
                return aiRes;
            }
        } catch (e) {
            console.error('[URL-Analysis/HanjinTravel] AI fallback error:', e);
        }
    }
    return native;
}

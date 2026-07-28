import { fetchHanjinTravelNative } from '../hanjintravel-utils';
import type { DetailedProductInfo } from '../../types';

export async function analyzeHanjinTravelUrl(url: string): Promise<DetailedProductInfo | null> {
    console.log(`[URL-Analysis/HanjinTravel] Parsing summary for: ${url}`);
    return await fetchHanjinTravelNative(url, false);
}

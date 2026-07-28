import { fetchModeTourNative } from '../modetour-utils';
import type { DetailedProductInfo } from '../../types';

export async function analyzeModeTourUrl(url: string): Promise<DetailedProductInfo | null> {
    console.log(`[URL-Analysis/ModeTour] Parsing summary for: ${url}`);
    return await fetchModeTourNative(url, false);
}

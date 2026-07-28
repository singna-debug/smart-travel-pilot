import { fetchModeTourNative } from '../modetour-utils';
import type { DetailedProductInfo } from '../../types';

export async function crawlConfirmationModeTour(url: string): Promise<DetailedProductInfo | null> {
    console.log(`[Confirmation/ModeTour] Deep confirmation scraping for: ${url}`);
    return await fetchModeTourNative(url, false);
}

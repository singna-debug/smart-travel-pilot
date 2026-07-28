import { fetchHanjinTravelNative } from '../hanjintravel-utils';
import type { DetailedProductInfo } from '../../types';

export async function crawlConfirmationHanjinTravel(url: string): Promise<DetailedProductInfo | null> {
    console.log(`[Confirmation/HanjinTravel] Deep confirmation scraping for: ${url}`);
    return await fetchHanjinTravelNative(url, false);
}

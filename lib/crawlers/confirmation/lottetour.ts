import { fetchLotteTourNative } from '../lottetour-utils';
import type { DetailedProductInfo } from '../../types';

export async function crawlConfirmationLotteTour(url: string): Promise<DetailedProductInfo | null> {
    return fetchLotteTourNative(url, false);
}

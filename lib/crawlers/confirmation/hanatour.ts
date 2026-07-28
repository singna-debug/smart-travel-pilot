import { fetchHanaTourNative } from '../hanatour-utils';
import type { DetailedProductInfo } from '../../types';

export async function crawlConfirmationHanaTour(url: string): Promise<DetailedProductInfo | null> {
    return fetchHanaTourNative(url, false);
}
// Turbopack HMR refresh


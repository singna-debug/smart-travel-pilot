import { fetchHanaTourNative } from '../hanatour-utils';
import type { DetailedProductInfo } from '../../types';

export async function analyzeHanaTourUrl(url: string): Promise<DetailedProductInfo | null> {
    return fetchHanaTourNative(url, true);
}

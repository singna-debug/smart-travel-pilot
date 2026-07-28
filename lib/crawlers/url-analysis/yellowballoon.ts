import { fetchYellowBalloonNative } from '../yellowballoon-utils';
import type { DetailedProductInfo } from '../../types';

export async function analyzeYellowBalloonUrl(url: string): Promise<DetailedProductInfo | null> {
    return fetchYellowBalloonNative(url, true);
}

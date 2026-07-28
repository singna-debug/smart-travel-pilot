import { fetchYellowBalloonNative } from '../yellowballoon-utils';
import type { DetailedProductInfo } from '../../types';

export async function crawlConfirmationYellowBalloon(url: string): Promise<DetailedProductInfo | null> {
    return fetchYellowBalloonNative(url, false);
}

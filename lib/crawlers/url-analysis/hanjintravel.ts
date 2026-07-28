import { fetchHanjinTravelNative } from '../hanjintravel-utils';
import type { DetailedProductInfo } from '../../types';

export async function analyzeHanjinTravelUrl(url: string): Promise<DetailedProductInfo | null> {
    console.log(`[URL-Analysis/HanjinTravel] Parsing summary for: ${url}`);
    let native = await fetchHanjinTravelNative(url, true);
    if (!native) return null;

    if (!native.title || native.title === '한진관광 패키지 상품' || native.title === '한진트래블') {
        const gdsMatch = url.match(/gdsNo=([A-Z0-9]+)/i);
        native.title = gdsMatch ? `한진관광 프리미엄 패키지 [${gdsMatch[1]}]` : '한진관광 프리미엄 패키지 상품';
    }

    if (!native.departureDate || native.departureDate === '날짜 미정' || native.departureDate === '일정표 참조') {
        const evtMatch = url.match(/evtNo=[A-Z]*(\d{4})(\d{2})(\d{2})/i);
        if (evtMatch) {
            native.departureDate = `${evtMatch[1]}-${evtMatch[2]}-${evtMatch[3]}`;
        }
    }

    if (!native.price || native.price === '가격 정보 없음' || native.price === '가격 미정' || native.price.trim().length === 0) {
        native.price = '가격 정보 문의 (선착순 특가)';
    }

    return native;
}

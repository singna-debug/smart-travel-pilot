
import type { DetailedProductInfo } from '../types';

export function formatProductInfo(info: DetailedProductInfo, index?: number): string {
    let p = String(info.price || '');
    const digits = p.replace(/[^0-9]/g, '');
    if (digits && !p.includes(',')) {
        p = parseInt(digits, 10).toLocaleString() + '원';
    }

    let r = index !== undefined ? `${index + 1}. ${info.title}\n\n` : `${info.title}\n\n`;
    r += `* 가격: ${p}\n`;
    r += `* 출발일: ${info.departureDate || '미정'}\n`;
    r += `* 출발공항 : ${info.departureAirport || '인천'}\n`;
    r += `* 항공 : ${info.airline || '-'}\n`;
    r += `* 지역 : ${info.destination || '-'}\n`;
    r += `* 기간 : ${info.duration || '-'}\n`;

    if (info.keyPoints && info.keyPoints.length > 0) {
        r += `\n[상품 포인트]\n`;
        info.keyPoints.slice(0, 8).forEach(point => {
            const cleanPoint = String(point || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}✈🧚🍗♨🍷🏨🚌🌟★♥▶▒◆•●📌🍽🎑🌊🧧🚢✨💡]/gu, '').trim();
            if (cleanPoint) r += `• ${cleanPoint}\n`;
        });
    }

    if (info.inclusions && info.inclusions.length > 0) {
        r += `\n[✅ 포함사항]\n`;
        info.inclusions.slice(0, 6).forEach(inc => {
            r += `✓ ${inc}\n`;
        });
    }

    if (info.exclusions && info.exclusions.length > 0) {
        r += `\n[❌ 불포함사항]\n`;
        info.exclusions.slice(0, 6).forEach(exc => {
            r += `✕ ${exc}\n`;
        });
    }

    if (info.hotel || (info.hotels && info.hotels.length > 0)) {
        const hotelStr = info.hotel || info.hotels?.map((h: any) => h.name || h).join(', ');
        r += `\n[🏨 예정 숙소]\n${hotelStr}\n`;
    }

    if (info.itinerary && info.itinerary.length > 0) {
        r += `\n[🗺️ 일자별 핵심 일정 요약]\n`;
        info.itinerary.forEach((day: any, idx: number) => {
            const dayNum = day.day || (idx + 1);
            const spots = (day.items || day.timeline || []).slice(0, 5).map((s: any) => typeof s === 'string' ? s : s.title).filter(Boolean).join(', ');
            r += `${dayNum}일차: ${day.title || ''} ${spots ? `(${spots})` : ''}\n`;
        });
    }

    r += `\n[전문 일정표 보기]\n(${info.url})\n\n`;
    r += `※ 예약 전 확인사항: 상품가액은 예약 시 출발일에 따라 변동될 수 있으며, 항공 좌석은 예약 시점에 다시 확인해야 합니다.`;
    return r;
}

export async function generateRecommendation(info: DetailedProductInfo): Promise<string> {
    const p = info.price || '문의';
    return `⭐ **${info.destination} 여행, 추천드려요!**\n\n${p}에 즐기는 알찬 일정입니다.`;
}

export function compareProducts(products: DetailedProductInfo[]): string {
    if (!products || products.length < 2) {
        return "비교할 상품이 충분하지 않습니다.";
    }

    let comparison = "📊 여행 상품 비교 분석 결과\n\n";

    products.forEach((p, i) => {
        comparison += `${i + 1}. ${p.title}\n\n`;
        comparison += `* 가격: ${p.price || '정보 없음'}\n`;
        comparison += `* 출발일: ${p.departureDate || '미정'}\n`;
        comparison += `* 출발공항 : ${p.departureAirport || '인천'}\n`;
        comparison += `* 항공 : ${p.airline || '-'}\n`;
        comparison += `* 지역 : ${p.destination || '-'}\n`;
        comparison += `* 기간 : ${p.duration || '-'}\n\n`;

        if (p.keyPoints && p.keyPoints.length > 0) {
            comparison += `[상품별 특이사항]\n`;
            p.keyPoints.slice(0, 10).forEach(point => {
                comparison += `- ${point}\n`;
            });
            comparison += `\n`;
        }

        comparison += `[전문 일정표 보기]\n(${p.url})\n\n`;

        if (i < products.length - 1) {
            comparison += `------------------------------------------\n\n`;
        }
    });

    comparison += `※ 예약 전 확인사항: 상품가액은 예약 시 출발일에 따라 변동될 수 있으며, 항공 좌석은 예약 시점에 다시 확인해야 합니다.`;

    return comparison;
}

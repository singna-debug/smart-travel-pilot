
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
        r += `\n[여행 준비물 및 핵심 포인트]\n`;
        // 사용자 요청 필수 준비물 상단 배치
        const essentialItems = [
            '여권, 항공권',
            '바람막이 또는 가디건',
            '수영복, 아쿠아슈즈',
            '220V 사용가능 여부 확인',
            '보조배터리(반드시 기내 휴대)',
            '멀티 어댑터',
            '상비약(감기약, 소화제, 지사제, 밴드)',
            '자외선 차단제',
            '개인 세면도구',
            '중요한 약(혈압, 당뇨약 등)은 반드시 기내 휴대'
        ];
        
        essentialItems.forEach(item => { r += `- ${item}\n`; });
        r += `\n[상품별 특이사항]\n`;
        info.keyPoints.slice(0, 10).forEach(point => {
            r += `- ${point}\n`;
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
            comparison += `[여행 준비물 및 핵심 포인트]\n`;
            const essentialItems = [
                '여권, 항공권',
                '바람막이 또는 가디건',
                '수영복, 아쿠아슈즈',
                '220V 사용가능 여부 확인',
                '보조배터리(반드시 기내 휴대)',
                '멀티 어댑터',
                '상비약(감기약, 소화제, 지사제, 밴드)',
                '자외선 차단제',
                '개인 세면도구',
                '중요한 약(혈압, 당뇨약 등)은 반드시 기내 휴대'
            ];
            essentialItems.forEach(item => { comparison += `- ${item}\n`; });
            
            comparison += `\n[상품별 특이사항]\n`;
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

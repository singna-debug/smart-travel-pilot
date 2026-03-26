
import type { DetailedProductInfo } from '../../types';
import { 
    fetchContent, 
    analyzeWithGemini, 
    refineData
} from '../crawler-utils';
import { scrapeWithBrowser } from '../browser-crawler';

/**
 * 예약 안내 멘트 제작용 정보 추출 (예약안내모드)
 * 가격, 일정, 포함/불포함 핵심 사항을 고객 안내용으로 추출합니다.
 */
export async function crawlForReservationGuide(url: string): Promise<DetailedProductInfo | null> {
    console.log(`[ReservationGuideCrawler] Start. URL=${url}`);

    // 1. 데이터 확보
    const { text, nextData, nativeData } = await fetchContent(url, { isSummaryOnly: false, skipHtml: false });
    
    // 2. 예약 안내 전용 프롬프트 구성
    const prompt = `고객에게 보낼 '예약 및 결제 안내' 메시지를 작성하기 위해 다음 여행 상품 정보를 추출하세요.
고객이 안심하고 예약할 수 있도록 핵심적인 혜택과 주의사항, 그리고 정확한 항공 일정을 포함해야 합니다.

URL: ${url}
${nativeData ? `--- [Native API 정보] ---\n${JSON.stringify(nativeData)}\n` : ''}

반환 JSON 형식:
{
  "isProduct": true,
  "title": "상품명",
  "price": "성인 1인 가격(숫자만)",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "airline": "항공사명",
  "duration": "X박 Y일",
  "destination": "여행 지역",
  "itinerary": [
    { 
      "day": "1일차", 
      "transport": { 
        "airline": "항공사", 
        "flightNo": "편명", 
        "departureTime": "HH:mm", 
        "arrivalTime": "HH:mm" 
      } 
    }
  ],
  "keyPoints": [
    "고객이 매력을 느낄만한 핵심 포인트 1",
    "포인트 2",
    "포인트 3"
  ],
  "inclusions": ["핵심 포함 사항 1", "2"],
  "exclusions": ["주요 불포함 사항 1", "2"],
  "specialTerms": "취소 규정 및 예약 시 유의사항 요약"
}

[RULES]
1. 항공권 정보(출도착 시간, 편명)를 아주 정확하게 추출하세요. 
2. keyPoints는 고객 안내용으로 가장 매력적인 3~4개를 추출하세요.
3. specialTerms는 예약 시점에 꼭 알아야 할 취소료 규정을 반드시 포함하세요.

입력 데이터:
${text.substring(0, 25000)}`;

    // 3. AI 분석 실행
    const result = await analyzeWithGemini(prompt, url, false, nextData);
    
    if (result) {
        if (nativeData) {
            // Native 데이터로 보강
            if (!result.price) result.price = nativeData.price;
            if (!result.airline) result.airline = nativeData.airline;
            if (!result.itinerary || result.itinerary.length === 0) result.itinerary = nativeData.itinerary;
            if (nativeData.keyPoints && (!result.keyPoints || result.keyPoints.length === 0)) {
                result.keyPoints = nativeData.keyPoints.slice(0, 4);
            }
        }
        return refineData(result, text, url);
    }
    
    return nativeData ? refineData(nativeData, text, url) : null;
}

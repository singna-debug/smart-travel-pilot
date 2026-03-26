
import type { DetailedProductInfo } from '../../types';
import { 
    fetchContent, 
    analyzeWithGemini, 
    refineData, 
    fallbackParse
} from '../crawler-utils';
import { scrapeWithBrowser } from '../browser-crawler';

/**
 * 예약 상세 정보 추출 (부킹 모드)
 * 항공 스케줄, 취소 규정, 불포함 사항 등 상세 데이터를 추출합니다.
 */
export async function crawlForBooking(url: string): Promise<DetailedProductInfo | null> {
    console.log(`[BookingCrawler] Start. URL=${url}`);

    // 1. 데이터 확보 (isSummaryOnly=false로 상세 데이터 요청)
    const { text, nextData, nativeData } = await fetchContent(url, { isSummaryOnly: false, skipHtml: true });
    
    // [최적화] Native API 데이터가 충분하면 Gemini 분석을 건너뛰고 바로 반환 (1-2초 내 완료)
    if (nativeData && nativeData.title && nativeData.price && nativeData.airline && nativeData.departureDate) {
        console.log(`[BookingCrawler] Native API data is sufficient. Skipping Gemini for speed.`);
        return refineData(nativeData, text, url);
    }
    
    // 2. 부킹 모드 전용 프롬프트 구성
    const prompt = `다음 여행 상품 페이지에서 '예약 및 결제'에 필요한 상세 정보를 추출하여 JSON으로 반환하세요.
URL: ${url}
${nativeData ? `--- [중요: Native API 데이터] ---\n${JSON.stringify(nativeData)}\n` : ''}

반환 JSON 형식:
{
  "isProduct": true,
  "title": "상품명",
  "price": "성인 가격(숫자만)",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "airline": "항공사명",
  "itinerary": [
    { "day": "1일차", "transport": { "airline": "항공사", "flightNo": "편명", "departureTime": "HH:mm", "arrivalTime": "HH:mm" } }
  ],
  "inclusions": ["포함사항 1", "포함사항 2"],
  "exclusions": ["불포함사항 1", "불포함사항 2"],
  "specialTerms": "취소 규정 및 특별 약관 요약",
  "keyPoints": ["상품 특징 1", "특징 2"]
}

입력 텍스트:
${text.substring(0, 10000)}`;

    // 3. AI 분석 실행
    const result = await analyzeWithGemini(prompt, url, false, nextData);
    
    if (result) {
        // Native 데이터가 있다면 보강
        if (nativeData) {
            if (!result.itinerary || result.itinerary.length === 0) result.itinerary = nativeData.itinerary;
            if (!result.specialTerms) result.specialTerms = nativeData.specialTerms;
        }
        return refineData(result, text, url);
    }
    
    return nativeData ? refineData(nativeData, text, url) : null;
}

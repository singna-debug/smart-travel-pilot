import type { DetailedProductInfo } from '../../types';
import { analyzeWithGemini } from '../crawler-base-utils';
import { fetchContent } from './fetcher';
import { refineData } from './refiner';
import { scrapeWithBrowser } from '../browser-crawler';

/**
 * 예약 상세 정보 추출 (부킹 모드)
 * 항공 스케줄, 취소 규정, 불포함 사항 등 상세 데이터를 추출합니다.
 */
export async function crawlForBooking(url: string): Promise<DetailedProductInfo | null> {
    console.log(`[BookingCrawler] Start. URL=${url}`);

    // [개선] skipHtml: false로 변경하여 더 정확한 데이터 확보 (부킹 모드는 상세 정보가 중요함)
    const { text, nextData, nativeData } = await fetchContent(url, { isSummaryOnly: false, skipHtml: false });
    
    // 2. 부킹 모드 전용 프롬프트 구성 (간략화 버전)
    const prompt = `다음 여행 상품 페이지에서 핵심 정보만 추출하여 JSON으로 반환하세요.
URL: ${url}
${nativeData ? `--- [중요: Native API 데이터] ---\n${JSON.stringify(nativeData)}\n` : ''}

반환 JSON 형식:
{
  "isProduct": true,
  "title": "상품명",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD"
}

[RULES]
1. 상품명(title)을 정확하게 추출하세요.
2. 출발일(departureDate)과 귀국일(returnDate)을 YYYY-MM-DD 형식으로 정확하게 추출하세요.

입력 텍스트:
${text.substring(0, 25000)}`;

    // 3. AI 분석 실행
    const result = await analyzeWithGemini(prompt, url, false, nextData);
    console.log(`[BookingCrawler] Gemini Analysis Result:`, result ? 'Success' : 'Failed');
    
    if (result) {
        // Native 데이터가 있다면 보강
        if (nativeData) {
            if (!result.title) result.title = nativeData.title;
            if (!result.departureDate) result.departureDate = nativeData.departureDate;
            if (!result.returnDate) result.returnDate = nativeData.returnDate;
        }
        return refineData(result, text, url);
    }
    
    return nativeData ? refineData(nativeData, text, url) : null;
}

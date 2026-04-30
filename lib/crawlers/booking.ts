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

    // [개정] 속도 최적화: skipHtml: true로 설정하여 불필요한 브라우저 크롤러 실행을 방지하고 Native API만 사용하여 3초 내 응답 보장
    const { text, nextData, nativeData } = await fetchContent(url, { isSummaryOnly: false, skipHtml: true });
    
    // 2. 부킹 모드 전용 프롬프트 구성 (간략화 버전)
    const prompt = `다음 여행 상품 페이지에서 핵심 정보만 추출하여 JSON으로 반환하세요.
URL: ${url}
${nativeData ? `--- [중요: Native API 데이터] ---\n${JSON.stringify(nativeData)}\n` : ''}

반환 JSON 형식:
{
  "isProduct": true,
  "title": "상품명",
  "destination": "목적지 (국가 또는 도시명)",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD"
}

[RULES]
1. 상품명(title)을 정확하게 추출하세요.
2. 목적지(destination)는 반드시 국가명 또는 도시명(예: 일본, 오사카, 몽골, 다낭)으로 추출하세요. 행사나 특전, 상품명은 제외하세요.
3. 출발일(departureDate)과 귀국일(returnDate)을 YYYY-MM-DD 형식으로 정확하게 추출하세요.

입력 텍스트:
${text.substring(0, 1000)}`;

    // 3. AI 분석 실행
    const result = await analyzeWithGemini(prompt, url, false, nextData);
    console.log(`[BookingCrawler] Gemini Analysis Result:`, result ? 'Success' : 'Failed');
    
    // 최종 데이터 조합 (Native 우선 전략)
    const finalResult = (result || { isProduct: true }) as DetailedProductInfo;
    
    if (nativeData) {
        // AI가 놓친 정보를 Native에서 보충 (비어있으면 채움)
        if (!finalResult.title || finalResult.title === '상품명') finalResult.title = nativeData.title || '';
        if (!finalResult.departureDate) finalResult.departureDate = nativeData.departureDate || '';
        if (!finalResult.returnDate) finalResult.returnDate = nativeData.returnDate || '';
    }
    
    return refineData(finalResult, text, url);
}

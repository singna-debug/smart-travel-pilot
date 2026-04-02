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
    
    // 2. 부킹 모드 전용 프롬프트 구성 (전체 상세 데이터 요청)
    const prompt = `다음 여행 상품 페이지에서 상세 정보를 추출하여 JSON으로 반환하세요.
URL: ${url}
${nativeData ? `--- [중요: Native API 데이터] ---\n${JSON.stringify(nativeData)}\n` : ''}

반환 JSON 형식:
{
  "isProduct": true,
  "title": "상품명",
  "destination": "목적지",
  "price": "숫자만",
  "departureDate": "YYYY-MM-DD",
  "returnDate": "YYYY-MM-DD",
  "departureAirport": "인천/부산 등",
  "airline": "항공사 및 전 노선 정보",
  "duration": "N박 M일",
  "itinerary": [
    { "day": 1, "title": "일정 제목", "route": "이동 경로", "hotel": "숙박 정보" }
  ],
  "hotels": [{ "name": "호텔명", "address": "주소" }],
  "inclusions": ["포함사항 리스트"],
  "exclusions": ["불포함사항 리스트"],
  "meetingInfo": [{ "type": "미팅안내", "location": "장소", "time": "시간" }]
}

[RULES]
1. Native API 데이터를 최우선으로 참고하여 사실 관계를 정확히 추출하세요.
2. 항공사(airline) 정보는 가는편/오는편 편명과 시간을 상세히 적어주세요.
3. 일정(itinerary)은 대표적인 관광지와 숙박 정보를 요약해서 채워주세요.

입력 텍스트:
${text.substring(0, 25000)}`;

    // 3. AI 분석 실행
    const result = await analyzeWithGemini(prompt, url, false, nextData);
    console.log(`[BookingCrawler] Gemini Analysis Result:`, result ? 'Success' : 'Failed');
    
    // 최종 데이터 조합 (Native 우선 및 보강 전략)
    const finalResult = (result || { isProduct: true }) as DetailedProductInfo;
    
    if (nativeData) {
        // AI가 놓쳤거나 미흡한 정보를 Native에서 보강
        if (!finalResult.title || finalResult.title === '상품명') finalResult.title = nativeData.title || '';
        if (!finalResult.departureDate) finalResult.departureDate = nativeData.departureDate || '';
        if (!finalResult.returnDate) finalResult.returnDate = nativeData.returnDate || '';
        if (!finalResult.price) finalResult.price = String(nativeData.price || '');
        if (!finalResult.destination) finalResult.destination = nativeData.destination || '';
        if (!finalResult.airline) finalResult.airline = nativeData.airline || '';
        if (!finalResult.duration) finalResult.duration = nativeData.duration || '';
        
        // 리스트형 데이터가 비어있을 경우 Native에서 강제 보강
        if (!finalResult.hotels || finalResult.hotels.length === 0) finalResult.hotels = nativeData.hotels || [];
        if (!finalResult.inclusions || finalResult.inclusions.length === 0) finalResult.inclusions = nativeData.inclusions || [];
        if (!finalResult.exclusions || finalResult.exclusions.length === 0) finalResult.exclusions = nativeData.exclusions || [];
        if (!finalResult.meetingInfo || finalResult.meetingInfo.length === 0) finalResult.meetingInfo = nativeData.meetingInfo || [];
        if (!finalResult.itinerary || finalResult.itinerary.length === 0) finalResult.itinerary = nativeData.itinerary || [];
    }
    
    return refineData(finalResult, text, url);
}

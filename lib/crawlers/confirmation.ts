
import type { DetailedProductInfo } from '../../types';
import { 
    fetchContent, 
    analyzeWithGemini, 
    refineData, 
    fallbackParse,
    fetchModeTourNative
} from '../crawler-utils';
import { scrapeWithBrowser } from '../browser-crawler';

/**
 * 최종 확정용 심층 분석 (컨퍼메이션 모드)
 * 모든 상세 정보를 가장 정밀하게 추출합니다.
 */
export async function crawlForConfirmation(url: string, providedText?: string, providedNextData?: string): Promise<DetailedProductInfo | null> {
    console.log(`[ConfirmationCrawler] Start. URL=${url}, hasProvidedText: ${!!providedText}`);

    // 1. 데이터 확보
    let text = providedText || '';
    let nextData = providedNextData || '';
    let nativeData: any = null;

    if (!text) {
        console.log('[ConfirmationCrawler] No text provided. Attempting Browser Scraper and Native API...');
        // 병렬로 브라우저 스크레핑과 Native API 호출 진행
        const [browserText, fetchedNative] = await Promise.all([
            scrapeWithBrowser(url, { skipClicks: false }),
            fetchModeTourNative(url).catch(() => null)
        ]);
        
        text = browserText || '';
        nativeData = fetchedNative;
        
        // [수정] text가 없으면 nativeData 여부와 상관없이 fetchContent로 재시도
        if (!text) {
            console.log('[ConfirmationCrawler] Falling back to fetchContent (Regular Fetch)...');
            const { text: fallbackText, nativeData: fallbackNative } = await fetchContent(url, { isSummaryOnly: false });
            text = fallbackText;
            if (!nativeData) nativeData = fallbackNative;
        }
    }
    
    if (!text) {
        console.error('[ConfirmationCrawler] Failed to acquire text content.');
        return null;
    }
    
    // 2. 심층 분석 프롬프트 (정밀 분석용)
    const prompt = `여행 상품의 모든 상세 정보를 확정서(Confirmation) 제작을 위해 가장 정밀하게 분석하여 JSON으로 반환하세요.
    
    [필수 추출 항목 지침]
    1. 항공 정보 (Summary):
       - 전체 여행의 핵심 항공 정보(가는편/오는편)를 추출하세요.
    2. 숙박 정보:
       - 모든 숙박 예정 호텔의 '정확한 이름'과 '주소'를 추출하세요.
       - **추출 소스 (중요)**: 상품 페이지에 '간략일정(또는 요약일정)'과 '상세일정'이 모두 있다면, 반드시 **'간략일정'의 텍스트를 최우선으로 분석**하여 가독성 있게 추출하세요. 상세일정의 너무 방대한 설명보다는 핵심 위주의 간략일정 텍스트를 선호합니다.
       - **아름다운 구성을 위한 activities 필드 작성**: 
         - \`activities\`를 **문자열 배열**로 반환하세요.
         - 각 항목의 **첫 줄은 '제목(Header)'**으로 쓰세요. (예: "가이드와 공항 밖에서 미팅")
         - 둘째 줄부터는 상세 설명을 쓰세요. (상세 설명이 길면 뷰어에서 자동으로 '더보기'가 생성됩니다.)
         - 핵심 키워드나 강조할 부분은 **\`<b>내용</b>\`** 태그를 사용하세요.
         - 중요한 안내나 포인트는 **\`<font color="#e11d48">강조문구</font>\`** 등을 적절히 섞어 '이쁘게 정리' 하세요.
         - 문단 나누기는 \`\\n\`을 사용하여 가독성을 높이세요.
       - **일별 교통 정보 (transport) - 복구 필수**:
         - 항공 이동이 있는 날은 반드시 \`transport\` 객체를 포함시키세요. (출발편 시간, 소요시간 등 포함)
         - 구조: { "departureCity": "인천", "arrivalCity": "나트랑", "departureTime": "20:15", "arrivalTime": "23:35", "airline": "제주항공", "flightNo": "7C2243", "duration": "5시간 20분" }
    4. 미팅 및 수하물:
       - 공항 미팅 장소, 시간, 상세 설명 및 수하물 규정(kg)을 상세히 추출하세요.

    [반환 JSON 구조]
    {
      "isProduct": true,
      "title": "상품명",
      "destination": "여행지/도시",
      "departureDate": "YYYY-MM-DD",
      "returnDate": "YYYY-MM-DD",
      "airline": "항공사명",
      "departureAirport": "출발공항",
      "duration": "X박 Y일",
      "hotels": [
        { "name": "호텔명", "address": "주소", "amenities": ["와이파이"] }
      ],
      "itinerary": [
        { 
          "day": "1일차", 
          "title": "일정 제목", 
          "transport": { 
             "departureCity": "인천", "arrivalCity": "나트랑", 
             "departureTime": "20:15", "arrivalTime": "23:35", 
             "airline": "제주항공", "flightNo": "7C2243", "duration": "5시간 20분" 
          },
          "activities": [
             "인천 공항 출발\\n상세 설명...",
             "현지 도착 및 가이드 미팅\\n상세 설명..."
          ], 
          "meals": { "breakfast": "기내식", "lunch": "현지식", "dinner": "한식" } 
        }
      ],
      "meetingInfo": [
        { "type": "수속카운터", "location": "T1 3층 N카운터", "time": "17:00", "description": "안내문구" }
      ],
      "inclusions": ["포함사항"],
      "exclusions": ["불포함사항"],
      "cancellationPolicy": "취소규정",
      "baggageNote": "기내 10kg / 위탁 15kg",
      "notices": ["기타 유의사항"]
    }

    입력된 데이터(HTML 텍스트 요약 및 Native API 데이터):
    URL: ${url}
    ${nativeData ? `--- [Native API Data (Contains Detailed Schedules)] ---\n${JSON.stringify(nativeData)}\n` : ''}
    --- [Page Scraped Content] ---
    ${text.substring(0, 70000)}`;

    // 3. 분석 수행
    const result = await analyzeWithGemini(prompt, url, false, nextData);
    
    if (result) {
        return refineData(result, text, url);
    }
    
    return nativeData ? refineData(nativeData, text, url) : null;
}

import type { DetailedProductInfo } from '../../types';
import { analyzeWithGemini } from '../crawler-base-utils';
import { fetchContent } from './fetcher';
import { refineData } from './refiner';
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
    
    // 최종 결과 객체 준비
    let finalInfo: DetailedProductInfo | null = result;

    if (!finalInfo) {
        console.warn(`[ReservationGuideCrawler] Gemini Failed. Falling back to NativeData.`);
        finalInfo = nativeData ? { ...nativeData } : null;
    }

    if (finalInfo) {
        console.log(`[ReservationGuideCrawler] Base Info Extracted. Merging/Refining...`);
        
        // 4. 데이터 보강 (Gemini 결과가 부족할 때 Native 데이터 또는 정규식 활용)
        
        // 가격(price) 보강
        if (!finalInfo.price || finalInfo.price === '0' || finalInfo.price === '추출 실패' || finalInfo.price === '') {
            if (nativeData?.price && nativeData.price !== '0') {
                finalInfo.price = nativeData.price;
            } else {
                // 본문 텍스트에서 가격 패턴 직접 검색 (마지막 수단)
                const pricePatterns = [
                    /([0-9,]{4,10})\s*원/g,
                    /판매가\s*[:\s]*([0-9,]{4,10})/i,
                    /성인\s*[:\s]*([0-9,]{4,10})/i
                ];
                for (const reg of pricePatterns) {
                    const match = text.match(reg);
                    if (match) {
                        const digits = match[0].replace(/[^0-9]/g, '');
                        if (digits.length >= 4) {
                            finalInfo.price = digits;
                            console.log(`[ReservationGuideCrawler] Price Found via Regex: ${finalInfo.price}`);
                            break;
                        }
                    }
                }
            }
        }

        // 항공사(airline) 보강
        if (!finalInfo.airline || finalInfo.airline === '추출 실패' || finalInfo.airline.length < 2) {
            if (nativeData?.airline) {
                finalInfo.airline = nativeData.airline;
            } else {
                const airlineMatch = text.match(/(제주항공|대한항공|아시아나항공|진에어|티웨이|이스타|에어서울|에어부산|비엣젯|필리핀항공|베트남항공|캐세이|타이항공)/);
                if (airlineMatch) {
                    finalInfo.airline = airlineMatch[1];
                    console.log(`[ReservationGuideCrawler] Airline Found via Regex: ${finalInfo.airline}`);
                }
            }
        }

        // 일정(itinerary) 보강
        if ((!finalInfo.itinerary || finalInfo.itinerary.length === 0) && nativeData?.itinerary) {
            finalInfo.itinerary = nativeData.itinerary;
        }

        // 핵심포인트(keyPoints) 보강
        if ((!finalInfo.keyPoints || finalInfo.keyPoints.length === 0) && nativeData?.keyPoints) {
            finalInfo.keyPoints = nativeData.keyPoints.slice(0, 4);
        }

        const refinedResult = refineData(finalInfo, text, url);

        // 5. 추가 보강: 불포함 사항(exclusions) 및 특별약관(specialTerms)
        if (!refinedResult.exclusions || refinedResult.exclusions.length === 0) {
            console.log(`[ReservationGuideCrawler] Exclusions empty. Searching via regex...`);
            const exclusionMatch = text.match(/불포함\s*사항\s*[:\s]*([\s\S]{10,300}?)(?=\n\n|\n[가-힣]+:|\n[#■●]|참고사항|$)/);
            if (exclusionMatch) {
                const items = exclusionMatch[1].split(/,|\n/).map(s => s.replace(/^[-\s]*|[*]/g, '').trim()).filter(s => s.length > 2);
                if (items.length > 0) {
                    refinedResult.exclusions = items;
                    console.log(`[ReservationGuideCrawler] Exclusions Found via Regex:`, items);
                }
            }
        }

        if (!refinedResult.specialTerms || refinedResult.specialTerms.length < 10) {
            console.log(`[ReservationGuideCrawler] SpecialTerms empty. Searching via regex...`);
            const termsMatch = text.match(/(취소\s*규정|특별\s*약관|취소\s*수수료)\s*[:\s]*([\s\S]{20,800}?)(?=\n\n|\n[#■●]|참고사항|$)/);
            if (termsMatch) {
                refinedResult.specialTerms = termsMatch[2].trim();
                console.log(`[ReservationGuideCrawler] SpecialTerms Found via Regex (Length=${refinedResult.specialTerms.length})`);
            }
        }

        // 6. 추가 보강: 항공 일정 (itinerary) - 더 유연한 패턴 추가
        if (!refinedResult.itinerary || refinedResult.itinerary.length === 0) {
            console.log(`[ReservationGuideCrawler] Itinerary empty. Searching via multiple regex patterns...`);
            const flights: any[] = [];
            
            // 패턴 1: 한 줄에 항공사, 편명, 시간 다 있는 경우
            const fullPattern = /(?:가는편|출발편|오는편|귀국편)?\s*([가-힣]{2,6}항공|[A-Z]{2,3})\s*([A-Z0-9]{3,6})?\s*\(?\s*([가-힣\w\s]*?)\s*(\d{2}:\d{2})\s*(?:출발|->|~)\s*([가-힣\w\s]*?)\s*(\d{2}:\d{2})\s*(?:도착)?\s*\)?/g;
            
            // 패턴 2: 출발/도착 키워드가 별도로 있는 경우
            const splitPattern = /(?:출발|인천|현지)?\s*(\d{2}:\d{2})\s*(?:출발|~)\s*(?:도착|현지|인천)?\s*(\d{2}:\d{2})\s*(?:도착)?/g;
            
            // 항공사 정보 먼저 확보
            const currentAirline = refinedResult.airline || '';

            let match;
            // 우선 패턴 1 시도
            while ((match = fullPattern.exec(text)) !== null) {
                flights.push({
                    day: flights.length === 0 ? "1일차" : "마지막날",
                    transport: {
                        airline: match[1]?.trim() || currentAirline,
                        flightNo: match[2]?.trim() || '',
                        departureTime: match[4],
                        arrivalTime: match[6]
                    }
                });
                if (flights.length >= 2) break;
            }

            // 패턴 1 실패 시 패턴 2 시도
            if (flights.length === 0) {
                let match2;
                while ((match2 = splitPattern.exec(text)) !== null) {
                    flights.push({
                        day: flights.length === 0 ? "1일차" : "마지막날",
                        transport: {
                            airline: currentAirline,
                            flightNo: '',
                            departureTime: match2[1],
                            arrivalTime: match2[2]
                        }
                    });
                    if (flights.length >= 2) break;
                }
            }

            if (flights.length > 0) {
                refinedResult.itinerary = flights;
                console.log(`[ReservationGuideCrawler] Flights Found via Regex:`, flights.map(f => `${f.transport.departureTime}->${f.transport.arrivalTime}`));
            }
        }

        console.log(`[ReservationGuideCrawler] Final Refined Result:`, {
            title: refinedResult.title,
            price: refinedResult.price,
            airline: refinedResult.airline,
            departureDate: refinedResult.departureDate,
            itineraryCount: refinedResult.itinerary?.length,
            hasSpecialTerms: !!refinedResult.specialTerms
        });
        return refinedResult;
    }
    
    return null;
}

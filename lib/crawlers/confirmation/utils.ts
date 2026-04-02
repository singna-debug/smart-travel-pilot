
import type { DetailedProductInfo } from '../../../types';

/**
 * Native API 데이터로부터 비어있는 필드를 보강합니다.
 */
export function mergeNativeData(result: DetailedProductInfo, nativeData: any): DetailedProductInfo {
    if (!nativeData) return result;

    console.log('[Confirmation/Utils] Merging with NativeData...');
    
    if (!result.airline || result.airline === '추출 실패') result.airline = nativeData.airline;
    if (!result.departureAirport || result.departureAirport === '추출 실패') result.departureAirport = nativeData.departureAirport;
    if (!result.duration || result.duration === '미정') result.duration = nativeData.duration;
    if (!result.destination || result.destination === '추출 실패') result.destination = nativeData.destination;
    
    // 일정 보강 (AI 결과가 부실하고 Native 데이터가 존재할 때만)
    if ((!result.itinerary || result.itinerary.length < 2) && nativeData.itinerary && nativeData.itinerary.length > 0) {
        console.log('[Confirmation/Utils] Itinerary missing in AI result. Using Native Itinerary.');
        result.itinerary = nativeData.itinerary;
    } else {
        // 이미 일정이 있다면, 첫날과 마지막날의 항공편명/시간 보강 시도
        const firstDay = result.itinerary[0];
        const lastDay = result.itinerary[result.itinerary.length - 1];
        
        if (firstDay && !result.departureFlightNumber) {
            result.departureFlightNumber = firstDay.transport?.flightNo;
            result.departureTime = firstDay.transport?.departureTime;
            result.arrivalTime = firstDay.transport?.arrivalTime;
        }
        
        if (lastDay && !result.returnFlightNumber) {
            result.returnFlightNumber = lastDay.transport?.flightNo;
            result.returnDepartureTime = lastDay.transport?.departureTime;
            result.returnArrivalTime = lastDay.transport?.arrivalTime;
        }
    }

    // 추가 필드 보강: 호텔, 미팅정보, 포함/불포함
    if (!result.hotels || result.hotels.length === 0) result.hotels = nativeData.hotels || [];
    if (!result.meetingInfo || result.meetingInfo.length === 0) result.meetingInfo = nativeData.meetingInfo || [];
    if (!result.inclusions || result.inclusions.length === 0) result.inclusions = nativeData.inclusions || [];
    if (!result.exclusions || result.exclusions.length === 0) result.exclusions = nativeData.exclusions || [];

    return result;
}

/**
 * 진단 로그 출력
 */
export function logDiagnostic(url: string, text: string, nativeData: any) {
    console.log(`[Confirmation/Diagnostic] URL=${url}, TextLength=${text?.length || 0}, NativeData=${!!nativeData}`);
    if (nativeData) {
        console.log(`[Confirmation/Diagnostic] NativeData keys: ${Object.keys(nativeData).join(', ')}`);
        console.log(`[Confirmation/Diagnostic] Native Itinerary: ${nativeData.itinerary?.length || 0} days`);
    }
    if (text) {
        console.log(`[Confirmation/Diagnostic] Text Top 500 chars: ${text.substring(0, 500).replace(/\n/g, ' ')}`);
        console.log(`[Confirmation/Diagnostic] Text Tail 2000 chars: ${text.substring(Math.max(0, text.length - 2000)).replace(/\n/g, ' ')}`);
    }
}

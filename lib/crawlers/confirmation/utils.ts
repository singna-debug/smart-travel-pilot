
import type { DetailedProductInfo } from '../../../types';

/**
 * Native API 데이터로부터 비어있는 필드를 보강합니다.
 */
export function mergeNativeData(result: DetailedProductInfo, nativeData: any): DetailedProductInfo {
    if (!nativeData) return result;

    console.log('[Confirmation/Utils] Merging with NativeData...');
    
    // [시각적 실재성(Visual Truth) 보호 원칙] 
    // AI가 화면상의 텍스트에서 09:30등 상품 변종 정보를 똑똑하게 추출했다면, 
    // 대표 상품 코드(Native API)의 12:15 데이터로 절대 덮어씌워서는 안 됩니다.
    
    const isPopulated = (val: any) => val && typeof val === 'string' && val.length > 0 && val !== '00:00' && val !== '미정';

    // 1. 공통 정보 보강 (비어있을 때만)
    if (!isPopulated(result.airline)) result.airline = nativeData.airline;
    if (!isPopulated(result.departureAirport)) result.departureAirport = nativeData.departureAirport;
    if (!isPopulated(result.duration)) result.duration = nativeData.duration;
    if (!isPopulated(result.destination)) result.destination = nativeData.destination;
    
    // 2. 항공 정보 방어 (AI 추출값이 우선이므로 덮어쓰기 금지)
    if (!isPopulated(result.departureFlightNumber)) result.departureFlightNumber = nativeData.departureFlightNumber;
    if (!isPopulated(result.departureTime)) result.departureTime = nativeData.departureTime;
    if (!isPopulated(result.arrivalTime)) result.arrivalTime = nativeData.arrivalTime;
    
    if (!isPopulated(result.returnFlightNumber)) result.returnFlightNumber = nativeData.returnFlightNumber;
    if (!isPopulated(result.returnDepartureTime)) result.returnDepartureTime = nativeData.returnDepartureTime;
    if (!isPopulated(result.returnArrivalTime)) result.returnArrivalTime = nativeData.returnArrivalTime;

    // 3. 일정표 방어 (AI가 추출한 일정이 상품 변종에 맞는 '실제' 일정이므로 덮어쓰기 금지)
    if (!result.itinerary || result.itinerary.length < 1) {
        console.log('[Confirmation/Utils] Itinerary missing in AI result. Using Native Itinerary.');
        result.itinerary = nativeData.itinerary;
    }
    
    // 4. 호텔/미팅/취소규정 보강 (정적 속성들이므로 비어있을 때 안전하게 보충)
    if (!result.hotels || result.hotels.length === 0) result.hotels = nativeData.hotels || [];
    if (!result.meetingInfo || result.meetingInfo.length === 0) result.meetingInfo = nativeData.meetingInfo || [];
    if (!result.inclusions || result.inclusions.length === 0) result.inclusions = nativeData.inclusions || [];
    if (!result.exclusions || result.exclusions.length === 0) result.exclusions = nativeData.exclusions || [];

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

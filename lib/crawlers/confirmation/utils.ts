
import type { DetailedProductInfo } from '../../../types';

/**
 * Native API 데이터로부터 비어있는 필드를 보강합니다.
 */
export function mergeNativeData(result: any, nativeData: any): DetailedProductInfo {
    if (!nativeData) return result as DetailedProductInfo;

    console.log('[Confirmation/Utils] Merging with NativeData...');
    
    // 1. 기본 정보 보강
    if (!result.title || result.title === '추출 실패') result.title = nativeData.title;
    if (!result.airline || result.airline === '추출 실패') result.airline = nativeData.airline;
    if (!result.departureAirport || result.departureAirport === '추출 실패') result.departureAirport = nativeData.departureAirport;
    if (!result.duration || result.duration === '미정') result.duration = nativeData.duration;
    if (!result.destination || result.destination === '추출 실패') result.destination = nativeData.destination;
    
    // 3. 호텔 정보 매핑 (AI의 단수 hotel -> 복수 hotels로 변환)
    if (result.hotel && (!result.hotels || result.hotels.length === 0)) {
        const hotelName = typeof result.hotel.name === 'string' ? result.hotel.name : (result.hotel.name?.name || '');
        // 쉼표(,)나 슬래시(/)로 구분된 멀티 호텔명 처리
        const names = hotelName.split(/[,/]/).map((n: string) => n.trim()).filter((n: string) => n.length > 1);
        
        if (names.length > 1) {
            result.hotels = names.map((n: string) => ({
                name: n,
                englishName: '',
                address: result.hotel.address || '',
                images: [],
                amenities: []
            }));
        } else {
            result.hotels = [{
                name: hotelName || '전일정 호텔(예정)',
                englishName: result.hotel.englishName || '',
                address: result.hotel.address || '',
                checkIn: result.hotel.checkIn || '',
                checkOut: result.hotel.checkOut || '',
                images: result.hotel.images || [],
                amenities: result.hotel.amenities || []
            }];
        }
    }
    
    if (!result.hotels || result.hotels.length === 0) {
        result.hotels = nativeData.hotels || [];
    }
    
    // 4. 일정표 및 항공 정보 상호 보강
    if ((!result.itinerary || result.itinerary.length < 2) && nativeData.itinerary && nativeData.itinerary.length > 0) {
        console.log('[Confirmation/Utils] Using Native Itinerary as Fallback.');
        result.itinerary = nativeData.itinerary;
    }

    if (result.itinerary && result.itinerary.length > 0) {
        const firstDay = result.itinerary[0];
        const lastDay = result.itinerary[result.itinerary.length - 1];

        // 일정표 -> 최상위 필드 보강
        if (!result.departureFlightNumber) result.departureFlightNumber = firstDay.transport?.flightNo;
        if (!result.departureTime) result.departureTime = firstDay.transport?.departureTime;
        if (!result.arrivalTime) result.arrivalTime = firstDay.transport?.arrivalTime;
        
        if (!result.returnFlightNumber) result.returnFlightNumber = lastDay.transport?.flightNo;
        if (!result.returnDepartureTime) result.returnDepartureTime = lastDay.transport?.returnDepartureTime || lastDay.transport?.departureTime;
        if (!result.returnArrivalTime) result.returnArrivalTime = lastDay.transport?.returnArrivalTime || lastDay.transport?.arrivalTime;

        // 최상위 필드 -> 일정표 보강 (상호 작용)
        if (result.departureFlightNumber && firstDay.transport) firstDay.transport.flightNo = result.departureFlightNumber;
        if (result.returnFlightNumber && lastDay.transport) lastDay.transport.flightNo = result.returnFlightNumber;
    }

    // 5. 기타 상세 정보 보강
    if (!result.meetingInfo || result.meetingInfo.length === 0) result.meetingInfo = nativeData.meetingInfo || [];
    if (!result.inclusions || result.inclusions.length === 0) result.inclusions = nativeData.inclusions || [];
    if (!result.exclusions || result.exclusions.length === 0) result.exclusions = nativeData.exclusions || [];
    if (!result.keyPoints || result.keyPoints.length === 0) result.keyPoints = nativeData.keyPoints || [];
    if (!result.specialOffers || result.specialOffers.length === 0) result.specialOffers = nativeData.specialOffers || [];

    return result as DetailedProductInfo;
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

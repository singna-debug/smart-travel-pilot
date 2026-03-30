
import type { DetailedProductInfo } from '../../../types';

/**
 * Native API 데이터로부터 비어있는 필드를 보강합니다.
 * ── v2: 가격/출발공항 보강 강화 ──
 */
export function mergeNativeData(result: DetailedProductInfo, nativeData: any): DetailedProductInfo {
    if (!nativeData) return result;

    console.log('[Confirmation/Utils] Merging with NativeData...');
    
    const isPopulated = (val: any) => {
        if (!val) return false;
        if (typeof val === 'string') {
            const clean = val.trim().toLowerCase();
            if (clean === '' || clean === 'null' || clean === 'undefined' || clean === '00:00' || clean === '0' || clean.includes('미정') || clean.includes('추출 실패') || clean.includes('정보 없음') || clean.includes('가격 정보 없음')) return false;
        }
        return true;
    };

    // 1. 공통 정보 보강 (비어있을 때만)
    if (!isPopulated(result.airline)) result.airline = nativeData.airline;
    if (!isPopulated(result.duration)) result.duration = nativeData.duration;
    if (!isPopulated(result.destination)) result.destination = nativeData.destination;
    
    // ★ 출발공항: "인천"도 유효한 값이므로 무조건 보강
    if (!isPopulated(result.departureAirport) && nativeData.departureAirport) {
        result.departureAirport = nativeData.departureAirport;
    }

    // ★ 가격: Native에 있으면 무조건 보강 (AI가 가격을 못 읽는 경우가 많음)
    if (!isPopulated(result.price) && nativeData.price) {
        console.log(`[Confirmation/Utils] Price补강: "${result.price}" → "${nativeData.price}"`);
        result.price = nativeData.price;
    }

    // ★ 출발일/귀국일 보강
    if (!isPopulated(result.departureDate) && nativeData.departureDate) {
        result.departureDate = nativeData.departureDate;
    }
    if (!isPopulated(result.returnDate) && nativeData.returnDate) {
        result.returnDate = nativeData.returnDate;
    }
    
    // 2. 항공 정보 보강 (AI 추출값이 우선이므로 비어있을 때만)
    if (!isPopulated(result.departureFlightNumber)) result.departureFlightNumber = nativeData.departureFlightNumber;
    if (!isPopulated(result.departureTime)) result.departureTime = nativeData.departureTime;
    if (!isPopulated(result.arrivalTime)) result.arrivalTime = nativeData.arrivalTime;
    if (!isPopulated(result.flightDuration)) result.flightDuration = nativeData.flightDuration;
    
    if (!isPopulated(result.returnFlightNumber)) result.returnFlightNumber = nativeData.returnFlightNumber;
    if (!isPopulated(result.returnDepartureTime)) result.returnDepartureTime = nativeData.returnDepartureTime;
    if (!isPopulated(result.returnArrivalTime)) result.returnArrivalTime = nativeData.returnArrivalTime;
    if (!isPopulated(result.returnFlightDuration)) result.returnFlightDuration = nativeData.returnFlightDuration;

    // 3. 일정표 보강 (AI가 일부 일차만 생성했을 때 Native로 보충)
    const nativeItinerary = nativeData.itinerary || [];
    if (!result.itinerary || result.itinerary.length < 1) {
        console.log('[Confirmation/Utils] Itinerary missing. Using Native Itinerary.');
        result.itinerary = nativeItinerary;
    } else if (result.itinerary.length < nativeItinerary.length) {
        // AI가 1~2일차만 생성하고 나머지를 누락 → Native에서 빠진 일차 보충
        console.log(`[Confirmation/Utils] AI returned ${result.itinerary.length} days, Native has ${nativeItinerary.length}. Appending missing days.`);
        for (let i = result.itinerary.length; i < nativeItinerary.length; i++) {
            result.itinerary.push(nativeItinerary[i]);
        }
    }
    
    // 4. 호텔/미팅/취소규정 보강
    if (!result.hotels || result.hotels.length === 0) result.hotels = nativeData.hotels || [];
    if (!result.meetingInfo || result.meetingInfo.length === 0) result.meetingInfo = nativeData.meetingInfo || [];
    if (!result.inclusions || result.inclusions.length === 0) result.inclusions = nativeData.inclusions || [];
    if (!result.exclusions || result.exclusions.length === 0) result.exclusions = nativeData.exclusions || [];
    if (!isPopulated(result.cancellationPolicy) && nativeData.cancellationPolicy) {
        result.cancellationPolicy = nativeData.cancellationPolicy;
    }

    // 5. keyPoints 보강
    if ((!result.keyPoints || result.keyPoints.length === 0) && nativeData.keyPoints?.length > 0) {
        result.keyPoints = nativeData.keyPoints;
    }

    return result;
}

/**
 * 진단 로그 출력 (콘솔만, 파일 I/O 없음)
 */
export function logDiagnostic(url: string, text: string, nativeData: any) {
    console.log(`[Confirmation/Diagnostic] URL=${url}, TextLength=${text?.length || 0}, NativeData=${!!nativeData}`);
    if (nativeData) {
        console.log(`[Confirmation/Diagnostic] Native: title="${nativeData.title}", price="${nativeData.price}", airport="${nativeData.departureAirport}", itinerary=${nativeData.itinerary?.length || 0} days`);
    }
}

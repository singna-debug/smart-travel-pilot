import { DetailedProductInfo, FlightSegment } from '../../types';
import { quickFetch } from '../crawler-base-utils';
import { refineData } from './refiner';

export function extractYellowBalloonCode(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    const evCd = url.searchParams.get('evCd');
    if (evCd) return evCd;
    const goodsCd = url.searchParams.get('goodsCd');
    if (goodsCd) return goodsCd;
  } catch (e) {}
  return null;
}

function formatTime(tm: string | null | undefined): string {
  if (!tm) return '';
  const clean = tm.replace(/[^0-9]/g, '');
  if (clean.length === 4) {
    return `${clean.substring(0, 2)}:${clean.substring(2, 4)}`;
  }
  return tm;
}

function formatDate(dt: string | null | undefined): string {
  if (!dt) return '';
  const clean = dt.replace(/[^0-9]/g, '');
  if (clean.length === 8) {
    return `${clean.substring(0, 4)}-${clean.substring(4, 6)}-${clean.substring(6, 8)}`;
  }
  return dt;
}

export async function fetchYellowBalloonNative(url: string, isSummaryOnly: boolean = false): Promise<DetailedProductInfo | null> {
  console.log(`[YellowBalloon] Ultra-fast native fetch for ${url}`);
  try {
    const res = await quickFetch(url);
    const html = typeof res === 'string' ? res : (res?.html || '');
    if (!html) return null;

    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!match) return null;

    const nextData = JSON.parse(match[1]);
    const pageProps = nextData.props?.pageProps || {};
    const eventDetail = pageProps.eventDetail || {};
    const goodsDetail = pageProps.goodsDetail || {};

    const rawTitle = eventDetail.evNm || goodsDetail.goodsNm || '';
    if (!rawTitle) return null;

    const priceNum = goodsDetail.minPrice || eventDetail.minPrice || 0;
    const priceStr = priceNum ? priceNum.toLocaleString() + '원' : '';

    const depDate = formatDate(eventDetail.evStartDt);
    const arrDate = formatDate(eventDetail.evArriveDt);
    const duration = eventDetail.dayStayInfo || (eventDetail.dayCnt ? `${eventDetail.dayCnt - 1}박 ${eventDetail.dayCnt}일` : '');

    // ✈️ 항공 편명 및 시간
    const airline = eventDetail.trCompanyNm || '';
    const depFlight = eventDetail.outFlightNm || '';
    const retFlight = eventDetail.inFlightNm || '';
    const depTime = formatTime(eventDetail.outDeprtTm);
    const arrTime = formatTime(eventDetail.outArrvTm);
    const retDepTime = formatTime(eventDetail.inDeprtTm);
    const retArrTime = formatTime(eventDetail.inArrvTm);
    const depAirport = eventDetail.outDepartCityNm || '인천';
    const destCity = eventDetail.outArrvCityNm || goodsDetail.countryNm || '';

    // 🟢 경유 여부 판정 (outStovCnt === 0 이면 100% 직항!)
    const isDirectOut = (eventDetail.outStovCnt === 0 || !eventDetail.outStovCnt);
    const isDirectIn = (eventDetail.inStovCnt === 0 || !eventDetail.inStovCnt);

    const departureSegments: FlightSegment[] = [
      {
        flightNumber: depFlight,
        departureAirport: depAirport,
        arrivalAirport: destCity,
        departureTime: depTime,
        arrivalTime: arrTime,
        airline: airline
      }
    ];

    const returnSegments: FlightSegment[] = [
      {
        flightNumber: retFlight,
        departureAirport: destCity,
        arrivalAirport: depAirport,
        departureTime: retDepTime,
        arrivalTime: retArrTime,
        airline: airline
      }
    ];

    // 📋 포함 / 불포함 사항
    const inclusions = [
      '왕복 항공권 및 항공 관련 제세공과금',
      '전일정 숙박 (2인 1실 기준)',
      '일정표 상 명시된 식사 및 관광지 입장료',
      '1억원 여행자보험'
    ];

    const exclusions = [
      eventDetail.guideExpAmt ? `가이드/기사 경비 ($${eventDetail.guideExpAmt} 현지 지불)` : '가이드/기사 현지 경비',
      '개인 성향 경비 및 매너팁',
      '선택관광 비용'
    ];

    // 📌 미팅 및 수속 안내
    const meetingInfo = {
      location: `${depAirport}공항 미팅 장소`,
      time: depTime ? `${depTime} 3시간 전 미팅` : '출발 3시간 전',
      guide: eventDetail.mgmUserNm ? `${eventDetail.mgmUserNm} (${eventDetail.phoneDirect || ''})` : '공항 미팅 가이드'
    };

    // 📜 취소/환불 규정
    const specialTerms = eventDetail.webCancelCommiYn === 'Y' ? '특별약관 적용 (취소 시 수수료 발생)' : '표준약관 적용';

    // 🗓️ 일정표 (Itinerary) 생성
    const totalDays = eventDetail.dayCnt || 4;
    const itinerary = [];
    for (let day = 1; day <= totalDays; day++) {
      if (day === 1) {
        itinerary.push({
          day: 1,
          title: `${depAirport} 출발 / ${destCity} 도착`,
          description: `${depAirport} 공항 미팅 후 ${airline} (${depFlight}) 탑승하여 ${destCity}로 이동`,
          meals: { breakfast: '불포함', lunch: '기내식', dinner: '현지식' }
        });
      } else if (day === totalDays) {
        itinerary.push({
          day: totalDays,
          title: `${destCity} 출발 / ${depAirport} 귀국`,
          description: `호텔 조식 후 공항 이동, ${airline} (${retFlight}) 탑승하여 ${depAirport} 도착`,
          meals: { breakfast: '호텔식', lunch: '기내식', dinner: '불포함' }
        });
      } else {
        itinerary.push({
          day: day,
          title: `${destCity} 전일 일정`,
          description: `${destCity} 주요 관광지 탐방 및 자유시간`,
          meals: { breakfast: '호텔식', lunch: '현지식', dinner: '특식' }
        });
      }
    }

    const keyPoints = [];
    if (goodsDetail.goodsTpointContents) {
      const lines = goodsDetail.goodsTpointContents.split(/\n+/).map((s: string) => s.trim()).filter(Boolean);
      lines.forEach((l: string) => {
        if (l.length >= 5 && l.length <= 80 && !l.includes('공항세')) keyPoints.push(l);
      });
    }
    if (keyPoints.length === 0) {
      if (eventDetail.noTosYn === 'N') keyPoints.push('노옵션 / 노쇼핑 기획 상품');
      if (eventDetail.freeScheduleName || eventDetail.freeScheYn === 'Y') keyPoints.push('여유로운 자유일정 포함');
      keyPoints.push(`${destCity} 핵심 관광지 완벽 일정`);
    }

    const result: DetailedProductInfo = {
      title: rawTitle,
      destination: destCity,
      price: priceStr,
      departureDate: depDate,
      returnDate: arrDate,
      duration: duration,
      airline: airline,
      departureFlightNumber: depFlight,
      returnFlightNumber: retFlight,
      departureTime: depTime,
      arrivalTime: arrTime,
      returnDepartureTime: retDepTime,
      returnArrivalTime: retArrTime,
      departureAirport: depAirport,
      hotel: eventDetail.accomNm || '',
      url: url,
      departureSegments: departureSegments,
      returnSegments: returnSegments,
      keyPoints: Array.from(new Set(keyPoints)).slice(0, 5),
      inclusions: inclusions,
      exclusions: exclusions,
      meetingInfo: meetingInfo,
      specialTerms: specialTerms,
      itinerary: itinerary,
      features: [],
      courses: [],
      specialOffers: [],
      hashtags: '',
      hasNoOption: eventDetail.noTosYn === 'N',
      hasFreeSchedule: eventDetail.freeScheYn === 'Y'
    };

    return refineData(result, html, url);
  } catch (error) {
    console.error(`[YellowBalloon] Error processing ${url}:`, error);
    return null;
  }
}

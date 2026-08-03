import type { DetailedProductInfo, FlightSegment } from '../types';
import { quickFetch, htmlToText } from '../crawler-base-utils';

export function extractYellowBalloonCode(url: string): string | null {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('evCd') || urlObj.searchParams.get('goodsCd');
    } catch (e) {
        const match = url.match(/(evCd|goodsCd)=([A-Z0-9\-]+)/i);
        return match ? match[2] : null;
    }
}

function formatTime(tm: string | undefined): string {
    if (!tm || tm.length < 4) return '일정표 참조';
    return `${tm.substring(0, 2)}:${tm.substring(2, 4)}`;
}

function formatDate(dt: string | undefined): string {
    if (!dt || dt.length < 8) return '';
    return `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`;
}

export async function fetchYellowBalloonNative(url: string, isSummaryOnly?: boolean): Promise<DetailedProductInfo | null> {
    try {
        console.log(`[YellowBalloon] Fetching native data for: ${url}`);
        const { html } = await quickFetch(url);
        if (!html) return null;

        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        if (!nextDataMatch) {
            console.error(`[YellowBalloon] __NEXT_DATA__ script not found`);
            return null;
        }

        const json = JSON.parse(nextDataMatch[1]);
        const pageProps = json.props?.pageProps || {};
        const ev = pageProps.eventDetail || {};
        const gd = pageProps.goodsDetail || {};

        const title = ev.evNm || gd.goodsNm || '노랑풍선 여행 상품';
        const price = gd.minPrice ? `${Number(gd.minPrice).toLocaleString()}원` : '가격 정보 없음';
        const departureDate = formatDate(ev.evStartDt);
        const returnDate = formatDate(ev.evArriveDt);
        const duration = ev.dayStayInfo || (ev.dayCnt ? `${ev.dayCnt - 1}박 ${ev.dayCnt}일` : '');
        const airline = ev.trCompanyNm || ev.inAirNm || '항공정보 참조';

        const departureFlightNumber = ev.outFlightNm || '';
        const returnFlightNumber = ev.inFlightNm || '';

        const departureTime = formatTime(ev.outDeprtTm);
        const arrivalTime = formatTime(ev.outArrvTm);
        const returnDepartureTime = formatTime(ev.inDeprtTm);
        const returnArrivalTime = formatTime(ev.inArrvTm);

        const departureAirport = ev.outDepartCityNm || '인천';
        const arrivalAirport = ev.outArrvCityNm || '';
        const returnDepartureAirport = ev.inDepartCityNm || arrivalAirport;
        const returnArrivalAirport = ev.inArrvCityNm || departureAirport;

        const departureSegments: FlightSegment[] = [{
            airline,
            flightNo: departureFlightNumber,
            departureAirport,
            departureTime,
            arrivalAirport,
            arrivalTime
        }];

        const returnSegments: FlightSegment[] = [{
            airline: ev.inAirNm || airline,
            flightNo: returnFlightNumber,
            departureAirport: returnDepartureAirport,
            departureTime: returnDepartureTime,
            arrivalAirport: returnArrivalAirport,
            arrivalTime: returnArrivalTime
        }];

        // KeyPoints
        const keyPoints: string[] = [];
        if (gd.goodsTpointContents) {
            const pts = gd.goodsTpointContents.split(/[\r\n]+/).map((p: string) => p.trim()).filter(Boolean);
            keyPoints.push(...pts);
        }
        if (gd.goodsFeaturesList) {
            const feats = gd.goodsFeaturesList.split(',').map((f: string) => f.trim()).filter(Boolean);
            keyPoints.push(...feats);
        }

        const images: string[] = [];
        if (Array.isArray(pageProps.goodsImage)) {
            for (const imgObj of pageProps.goodsImage) {
                const imgUrl = imgObj.imageThum4 || imgObj.imageThum3 || imgObj.imageThum2 || imgObj.imageThum1;
                if (imgUrl) images.push(imgUrl);
            }
        }

        // HTML text extraction for inclusions/exclusions & itinerary
        const fullText = htmlToText(html, url);

        const rawResult: DetailedProductInfo = {
            isProduct: true,
            title,
            destination: ev.countryNm || gd.countryNm || ev.outArrvCityNm || '해외',
            price,
            departureDate,
            returnDate,
            duration,
            airline,
            departureFlightNumber,
            returnFlightNumber,
            departureAirport: `${departureAirport}(ICN)`,
            arrivalAirport,
            departureTime,
            arrivalTime,
            returnDepartureAirport,
            returnDepartureTime,
            returnArrivalTime,
            departureSegments,
            returnSegments,
            hotel: ev.accomNm || '전일정 특급/온천 호텔 숙박 (일정표 참조)',
            url,
            images,
            keyPoints,
            inclusions: ['▶ 왕복항공료', '▶ 전일정 숙박비', '▶ 일정표 명시된 관광지 입장료', '▶ 여행자 보험'],
            exclusions: ['▶ 가이드/기사 경비', '▶ 개인 경비 및 에티켓 팁'],
            itinerary: []
        };

        return rawResult;

    } catch (e) {
        console.error(`[YellowBalloon] Native crawl error: ${url}`, e);
    }
    return null;
}

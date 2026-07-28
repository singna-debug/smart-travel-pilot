import type { DetailedProductInfo, FlightSegment } from '../types';
import { quickFetch, htmlToText } from '../crawler-base-utils';

export function extractLotteTourCode(url: string): string | null {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('godId');
    } catch (e) {
        const match = url.match(/godId=([0-9]+)/i);
        return match ? match[1] : null;
    }
}

export async function fetchLotteTourNative(url: string, isSummaryOnly?: boolean): Promise<DetailedProductInfo | null> {
    try {
        console.log(`[LotteTour] Fetching native data for: ${url}`);
        const { html } = await quickFetch(url);
        if (!html) return null;

        const text = htmlToText(html, url);

        // 1. OG Title & OG Description
        const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                             html.match(/<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i);
        const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);

        let title = ogTitleMatch ? ogTitleMatch[1].trim() : '롯데관광 여행 상품';
        title = title.replace(/^롯데관광\s*[:-]?\s*/i, '').trim();

        const description = ogDescMatch ? ogDescMatch[1].trim() : '';

        // 2. Price (Ignore deposit / 계약금 300,000원)
        let price = '가격 정보 문의 (선착순 특가)';
        
        // Find price numbers greater than 400,000 KRW
        const allPrices = text.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/g) || [];
        const validPrices = allPrices.filter(p => {
            const num = parseInt(p.replace(/[^0-9]/g, ''), 10);
            return num > 400000 && !p.includes('300,000');
        });

        if (validPrices.length > 0) {
            price = validPrices[0];
        } else {
            const scriptPrice = html.match(/(?:godAmt|evtAmt|minPrice|price)["']?\s*[:=]\s*["']?([0-9]{6,})/i);
            if (scriptPrice && Number(scriptPrice[1]) > 400000) {
                price = `${Number(scriptPrice[1]).toLocaleString()}원`;
            }
        }

        if (!price || price.trim().length === 0) {
            price = '가격 정보 문의 (선착순 특가)';
        }

        // 3. Airline Code & Name
        let airline = '대한항공';
        if (title.includes('아시아나') || title.includes('[OZ]')) airline = '아시아나항공';
        else if (title.includes('대한항공') || title.includes('[KE]')) airline = '대한항공';
        else if (title.includes('제주항공') || title.includes('[7C]')) airline = '제주항공';
        else if (title.includes('진에어') || title.includes('[LJ]')) airline = '진에어';
        else if (title.includes('티웨이') || title.includes('[TW]')) airline = '티웨이항공';

        // 4. Duration (Format as X박 Y일)
        let duration = '3박 5일';
        const durMatch = title.match(/(\d+)박\s*(\d+)일/);
        if (durMatch) {
            duration = `${durMatch[1]}박 ${durMatch[2]}일`;
        } else {
            const dayOnlyMatch = title.match(/(\d+)일/);
            if (dayOnlyMatch) {
                const days = parseInt(dayOnlyMatch[1], 10);
                if (days === 5) duration = '3박 5일';
                else if (days === 4) duration = '3박 4일';
                else if (days === 6) duration = '4박 6일';
                else if (days === 7) duration = '5박 7일';
                else if (days === 8) duration = '6박 8일';
                else duration = `${days - 1}박 ${days}일`;
            }
        }

        // 5. Destination
        let destination = '해외';
        if (title.includes('하노이') || title.includes('하롱베이') || title.includes('옌뜨')) destination = '하노이, 하롱베이';
        else if (title.includes('삿포로') || title.includes('오타루') || title.includes('북해도')) destination = '삿포로, 북해도';
        else if (title.includes('도쿄')) destination = '도쿄';
        else if (title.includes('오사카')) destination = '오사카';
        else if (title.includes('후쿠오카')) destination = '후쿠오카';
        else if (title.includes('다낭')) destination = '다낭';
        else if (title.includes('방콕')) destination = '방콕';
        else if (title.includes('유럽')) destination = '유럽';

        // 6. Benefit-Oriented KeyPoints Extraction
        const keyPoints: string[] = [];

        // Airline benefit
        keyPoints.push(`${airline} 국적기 직항 탑승으로 편안하고 품격 있는 이동`);

        // Dollar value & Special benefits
        if (html.includes('$150') || title.includes('150') || html.includes('150상당')) {
            keyPoints.push('[$150 상당 무료 혜택] 하롱베이 야시장, 롯데센터 전망대, 전신 마사지 등 포함');
        }

        if (title.includes('5성급') || title.includes('윈덤') || html.includes('5성급')) {
            keyPoints.push('월드체인 5성급 호텔 숙박 및 바다전망 객실 무료 업그레이드 혜택');
        }

        if (title.includes('미슐랭') || html.includes('미슐랭')) {
            keyPoints.push('미슐랭 빕구르망 선정 정통 맛집 및 호텔식 특식 제공');
        }

        if (title.includes('옌뜨') || html.includes('케이블카')) {
            keyPoints.push('유네스코 세계자연유산 옌뜨 국립공원 케이블카 체험 포함');
        }

        if (description) {
            const parts = description.split(/[♥+/,]/).map(p => p.trim()).filter(p => p.length > 5 && !p.includes('만 12세') && !p.includes('추가요금'));
            for (const pt of parts) {
                if (!keyPoints.some(k => k.includes(pt.substring(0, 4)))) {
                    keyPoints.push(pt);
                }
            }
        }

        // Departure Date Extraction
        let departureDate = '일정표 참조';
        let returnDate = '일정표 참조';

        const dataDepDtMatch = html.match(/var\s+dataDepDt\s*=\s*['"](\d{8})['"]/i) ||
                               html.match(/depDt\s*=\s*['"](\d{8})['"]/i);
        if (dataDepDtMatch) {
            const dt = dataDepDtMatch[1];
            departureDate = `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`;
        } else {
            const evtCdMatch = url.match(/evtCd=[A-Z0-9]*?(\d{2})(\d{2})(\d{2})/i);
            if (evtCdMatch) {
                departureDate = `20${evtCdMatch[1]}-${evtCdMatch[2]}-${evtCdMatch[3]}`;
            }
        }

        // Return Date calculation if departureDate is available and duration is e.g. 3박 5일
        if (departureDate && departureDate.includes('-')) {
            const d = new Date(departureDate);
            if (!isNaN(d.getTime())) {
                const daysAdd = duration.includes('5일') ? 4 : duration.includes('4일') ? 3 : duration.includes('6일') ? 5 : 4;
                d.setDate(d.getDate() + daysAdd);
                returnDate = d.toISOString().split('T')[0];
            }
        }

        const departureSegments: FlightSegment[] = [{
            airline,
            flightNo: '',
            departureAirport: '인천',
            departureTime: '일정표 참조',
            arrivalAirport: destination,
            arrivalTime: '일정표 참조'
        }];

        const returnSegments: FlightSegment[] = [{
            airline,
            flightNo: '',
            departureAirport: destination,
            departureTime: '일정표 참조',
            arrivalAirport: '인천',
            arrivalTime: '일정표 참조'
        }];

        const rawResult: DetailedProductInfo = {
            isProduct: true,
            title,
            destination,
            price,
            departureDate,
            returnDate,
            duration,
            airline,
            departureFlightNumber: '',
            returnFlightNumber: '',
            departureAirport: '서울(ICN)',
            arrivalAirport: destination,
            departureTime: '일정표 참조',
            arrivalTime: '일정표 참조',
            returnDepartureAirport: destination,
            returnDepartureTime: '일정표 참조',
            returnArrivalTime: '일정표 참조',
            departureSegments,
            returnSegments,
            hotel: '전일정 특특급/온천 호텔 숙박',
            url,
            keyPoints,
            inclusions: ['전일정 항공권 및 숙박', '여행자 보험'],
            exclusions: ['기사/가이드 경비', '개인 경비'],
            itinerary: []
        };

        const { refineData } = require('./refiner');
        return refineData(rawResult, text, url);

    } catch (e) {
        console.error(`[LotteTour] Native crawl error: ${url}`, e);
    }
    return null;
}

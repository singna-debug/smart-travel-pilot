import type { DetailedProductInfo, FlightSegment } from '../types';
import { quickFetch, htmlToText, inferDestination } from '../crawler-base-utils';

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
        const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);

        let title = ogTitleMatch ? ogTitleMatch[1].trim() : '롯데관광 여행 상품';
        title = title.replace(/^롯데관광\s*[:-]?\s*/i, '').trim();

        const description = ogDescMatch ? ogDescMatch[1].trim() : '';

        // Extract evtCd from URL parameter or script
        let evtCd = '';
        const evtCdMatch = url.match(/[?&]evtCd=([A-Za-z0-9_-]+)/i) || html.match(/m_evtCd_basicInfo\s*=\s*['"]([A-Za-z0-9_-]+)['"]/i);
        if (evtCdMatch) {
            evtCd = evtCdMatch[1];
        }

        // Try calling Lotte Tour's native price API
        let apiData: any = null;
        if (evtCd) {
            try {
                const apiRes = await fetch('https://www.lottetour.com/evtDetail/totalPriceArea', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Referer': url,
                        'User-Agent': 'Mozilla/5.0'
                    },
                    body: `evtCd=${evtCd}`
                });
                if (apiRes.ok) {
                    const json = await apiRes.json();
                    if (json && json.priceDetail) {
                        apiData = json.priceDetail;
                    }
                }
            } catch (e) {
                console.log('[LotteTour] API price fetch failed:', e);
            }
        }

        // 2. Price
        let price = '가격 정보 문의 (선착순 특가)';
        if (apiData && apiData.priceAdt && apiData.priceAdt > 0) {
            price = `${Number(apiData.priceAdt).toLocaleString()}원`;
        } else {
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
        }

        // 3. Airline Code & Name
        let airline = '대한항공';
        if (title.includes('아시아나') || title.includes('[OZ]')) airline = '아시아나항공';
        else if (title.includes('대한항공') || title.includes('[KE]')) airline = '대한항공';
        else if (title.includes('제주항공') || title.includes('[7C]')) airline = '제주항공';
        else if (title.includes('진에어') || title.includes('[LJ]')) airline = '진에어';
        else if (title.includes('티웨이') || title.includes('[TW]')) airline = '티웨이항공';
        else if (title.includes('에어서울') || title.includes('[RS]')) airline = '에어서울';
        else if (title.includes('에어부산') || title.includes('[BX]')) airline = '에어부산';

        // 4. Duration
        let duration = '3박 4일';
        const durMatch = title.match(/(\d+)박\s*(\d+)일/);
        if (durMatch) {
            duration = `${durMatch[1]}박 ${durMatch[2]}일`;
        } else {
            const dayOnlyMatch = title.match(/(\d+)일/);
            if (dayOnlyMatch) {
                const days = parseInt(dayOnlyMatch[1], 10);
                duration = days > 1 ? `${days - 1}박 ${days}일` : '당일';
            }
        }

        // 5. Destination
        const destination = inferDestination(title, text, url) || '해외';

        // 6. KeyPoints
        const keyPoints: string[] = [];
        if (description) {
            description.split(/[♥+/,▶\n]/).forEach(p => {
                const pt = p.trim();
                if (pt.length > 5 && !pt.includes('만 12세') && !pt.includes('추가요금')) {
                    keyPoints.push(pt);
                }
            });
        }
        if (keyPoints.length === 0) {
            keyPoints.push(`${airline} 국적기 직항 탑승으로 편안한 이동`);
            keyPoints.push('전일정 엄선된 특급/온천 호텔 숙박');
            keyPoints.push('지역 대표 명소 및 맛집 미식 코스 포함');
        }

        // Images
        const images: string[] = [];
        if (ogImageMatch && ogImageMatch[1]) {
            images.push(ogImageMatch[1]);
        }
        const imgMatches = html.match(/src=["'](https?:\/\/[^"']+\.(?:jpg|png|jpeg))["']/gi);
        if (imgMatches) {
            for (const m of imgMatches.slice(0, 10)) {
                const srcMatch = m.match(/src=["']([^"']+)["']/i);
                if (srcMatch && !srcMatch[1].includes('logo') && !srcMatch[1].includes('icon') && !images.includes(srcMatch[1])) {
                    images.push(srcMatch[1]);
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

        if (departureDate && departureDate.includes('-')) {
            const d = new Date(departureDate);
            if (!isNaN(d.getTime())) {
                const daysAdd = duration.includes('일') ? (parseInt(duration.match(/\d+일/)?.[0] || '4', 10) - 1) : 3;
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
            hotel: '전일정 특급/온천 호텔 숙박 (상세 일정 참조)',
            url,
            images,
            keyPoints,
            inclusions: ['▶ 왕복항공료', '▶ 전일정 숙박비', '▶ 일정표 명시된 관광지 입장료', '▶ 여행자 보험'],
            exclusions: ['▶ 가이드/기사 경비', '▶ 개인 경비 및 에티켓 팁'],
            itinerary: []
        };

        return rawResult;

    } catch (e) {
        console.error(`[LotteTour] Native crawl error: ${url}`, e);
    }
    return null;
}

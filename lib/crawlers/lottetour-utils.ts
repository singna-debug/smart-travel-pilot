import type { DetailedProductInfo, FlightSegment, ItineraryDay, TimelineItem } from '../types';
import { quickFetch, htmlToText, inferDestination } from '../crawler-base-utils';

export function extractLotteTourCode(url: string): string | null {
    try {
        const urlObj = new URL(url);
        return urlObj.searchParams.get('godId') || urlObj.searchParams.get('evtCd');
    } catch (e) {
        const match = url.match(/(godId|evtCd)=([A-Za-z0-9_-]+)/i);
        return match ? match[2] : null;
    }
}

export async function fetchLotteTourNative(url: string, isSummaryOnly?: boolean): Promise<DetailedProductInfo | null> {
    try {
        console.log(`[LotteTour] Fetching native data for: ${url}`);
        const cleanUrl = url.split('#')[0];
        const evtCdMatch = cleanUrl.match(/[?&]evtCd=([A-Za-z0-9_-]+)/i);
        let evtCd = evtCdMatch ? evtCdMatch[1] : '';

        // 1. Fetch main page HTML
        const { html } = await quickFetch(cleanUrl);
        if (!html) return null;

        if (!evtCd) {
            const m = html.match(/m_evtCd_basicInfo\s*=\s*['"]([A-Za-z0-9_-]+)['"]/i) ||
                      html.match(/frm_evt_cd["']\s+value=["']([A-Za-z0-9_-]+)["']/i) ||
                      html.match(/name=["']evtCd["']\s+value=["']([A-Za-z0-9_-]+)["']/i);
            if (m) evtCd = m[1];
        }

        // 2. Parallel fetch of AJAX Schedule & Price endpoints
        const scheAjaxUrl = evtCd ? `https://www.lottetour.com/evtDetailScheduleAjax?evtCd=${evtCd}&viewType=basic` : '';
        const priceAjaxUrl = evtCd ? 'https://www.lottetour.com/evtDetail/totalPriceArea' : '';

        const [scheHtml, priceRes] = await Promise.all([
            scheAjaxUrl ? fetch(scheAjaxUrl, {
                headers: { 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': 'Mozilla/5.0', 'Referer': cleanUrl }
            }).then(r => r.ok ? r.text() : '').catch(() => '') : Promise.resolve(''),
            priceAjaxUrl ? fetch(priceAjaxUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': cleanUrl,
                    'User-Agent': 'Mozilla/5.0'
                },
                body: `evtCd=${evtCd}`
            }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null)
        ]);

        const text = htmlToText(html, cleanUrl);
        const scheText = scheHtml ? htmlToText(scheHtml, cleanUrl) : '';

        // Title
        const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
        let title = ogTitleMatch ? ogTitleMatch[1].trim() : '롯데관광 여행 상품';
        title = title.replace(/^롯데관광\s*[:-]?\s*/i, '').trim();

        // Price
        let price = '가격 정보 문의 (선착순 특가)';
        if (priceRes?.priceDetail?.priceAdt && priceRes.priceDetail.priceAdt > 0) {
            price = `${Number(priceRes.priceDetail.priceAdt).toLocaleString()}원`;
        } else {
            const scriptPrice = html.match(/(?:godAmt|evtAmt|minPrice|priceAdt|price)["']?\s*[:=]\s*["']?([0-9]{6,})/i);
            if (scriptPrice && Number(scriptPrice[1]) > 400000) {
                price = `${Number(scriptPrice[1]).toLocaleString()}원`;
            }
        }

        // ─── Flight & Airport Parsing from Schedule HTML & evtCd ───
        let airline = '';
        let departureFlightNumber = '';
        let returnFlightNumber = '';
        let departureTime = '09:30';
        let arrivalTime = '12:10';
        let returnDepartureTime = '16:00';
        let returnArrivalTime = '19:00';

        const LOTTE_AIRLINE_MAP: Record<string, string> = {
            OZ: '아시아나항공',
            KE: '대한항공',
            '7C': '제주항공',
            LJ: '진에어',
            TW: '티웨이항공',
            RS: '에어서울',
            BX: '에어부산',
            VJ: '비엣젯항공',
            ZE: '이스타항공',
            MU: '중국동방항공',
            CZ: '중국남방항공',
            CA: '중국국제항공',
            CX: '캐세이퍼시픽',
            SQ: '싱가포르항공',
            VN: '베트남항공',
            TG: '타이항공',
            PR: '필리핀항공',
            '5J': '세부패시픽',
            JL: '일본항공(JAL)',
            NH: '전일본공수(ANA)',
            MM: '피치항공',
            TR: '스쿠트',
            EK: '에미레이트항공',
            EY: '에티하드항공',
            QR: '카타르항공',
            LH: '루프트한자',
            AF: '에어프랑스',
            KL: 'KLM네덜란드항공',
            TK: '터키항공'
        };

        const flightMatches = (scheHtml + html).match(/\b([A-Z0-9]{2})\s*(\d{2,4})\b/gi) || [];
        const validFlightNumbers: string[] = [];

        for (const rawCode of flightMatches) {
            const cleanCode = rawCode.replace(/\s+/g, '').toUpperCase();
            const prefix = cleanCode.substring(0, 2);
            if (LOTTE_AIRLINE_MAP[prefix]) {
                if (!validFlightNumbers.includes(cleanCode)) {
                    validFlightNumbers.push(cleanCode);
                }
            }
        }

        if (validFlightNumbers.length > 0) departureFlightNumber = validFlightNumbers[0];
        if (validFlightNumbers.length > 1) returnFlightNumber = validFlightNumbers[1];
        else returnFlightNumber = departureFlightNumber;

        if (departureFlightNumber) {
            const codePrefix = departureFlightNumber.substring(0, 2);
            airline = LOTTE_AIRLINE_MAP[codePrefix] || '';
        }

        if (!airline && evtCd) {
            const codeInEvt = evtCd.match(/(?:OZ|KE|7C|LJ|TW|RS|BX|VJ|ZE|MU|CZ|CA|CX|SQ|VN|TG|PR|5J|JL|NH|MM|TR|EK|EY|QR|LH|AF|KL|TK)/i)?.[0]?.toUpperCase();
            if (codeInEvt && LOTTE_AIRLINE_MAP[codeInEvt]) {
                airline = LOTTE_AIRLINE_MAP[codeInEvt];
                if (!departureFlightNumber) departureFlightNumber = codeInEvt;
            }
        }

        if (!airline) {
            const fullAirText = `${title} ${text} ${scheText}`;
            for (const name of Object.values(LOTTE_AIRLINE_MAP)) {
                if (fullAirText.includes(name) || fullAirText.includes(name.replace('항공', ''))) {
                    airline = name;
                    break;
                }
            }
        }

        if (!airline) {
            airline = '항공편 (상세 참조)';
        }

        const timeMatches = scheText.match(/\b\d{2}:\d{2}\b/g) || [];
        if (timeMatches.length >= 2) {
            departureTime = timeMatches[0];
            arrivalTime = timeMatches[1];
        }
        if (timeMatches.length >= 4) {
            returnDepartureTime = timeMatches[timeMatches.length - 2];
            returnArrivalTime = timeMatches[timeMatches.length - 1];
        }

        let duration = '3박 4일';
        const durMatch = title.match(/(\d+)박\s*(\d+)일/);
        if (durMatch) {
            duration = `${durMatch[1]}박 ${durMatch[2]}일`;
        }

        const destination = inferDestination(title, text, cleanUrl) || '해외';

        let departureDate = '일정표 참조';
        let returnDate = '일정표 참조';

        const dataDepDtMatch = html.match(/var\s+dataDepDt\s*=\s*['"](\d{8})['"]/i) ||
                               cleanUrl.match(/(\d{6})[A-Z]{2}\d{3}/i);
        if (dataDepDtMatch) {
            const dt = dataDepDtMatch[1];
            if (dt.length === 8) {
                departureDate = `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`;
            } else if (dt.length === 6) {
                departureDate = `20${dt.substring(0, 2)}-${dt.substring(2, 4)}-${dt.substring(4, 6)}`;
            }
        }

        if (departureDate.includes('-')) {
            const d = new Date(departureDate);
            if (!isNaN(d.getTime())) {
                const daysAdd = parseInt(duration.match(/\d+일/)?.[0] || '4', 10) - 1;
                d.setDate(d.getDate() + daysAdd);
                returnDate = d.toISOString().split('T')[0];
            }
        }

        const departureSegments: FlightSegment[] = [{
            airline,
            flightNo: departureFlightNumber,
            departureAirport: '인천(ICN)',
            departureTime,
            arrivalAirport: destination,
            arrivalTime
        }];

        const returnSegments: FlightSegment[] = [{
            airline,
            flightNo: returnFlightNumber,
            departureAirport: destination,
            departureTime: returnDepartureTime,
            arrivalAirport: '인천(ICN)',
            arrivalTime: returnArrivalTime
        }];

        // Extract product & schedule images (HTTPS enforced)
        const images: string[] = [];
        const imgMatches = (scheHtml + html).match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|JPG|JPEG)/g) || [];
        for (let img of imgMatches) {
            if (img.startsWith('http://')) img = img.replace('http://', 'https://');
            if (img.includes('lottetour.com') && !img.includes('logo') && !img.includes('icon') && !img.includes('banner') && !images.includes(img)) {
                images.push(img);
            }
        }

        // ─── Parse Detailed Itinerary Block-by-Block from Schedule HTML ───
        const itinerary: ItineraryDay[] = [];
        if (scheHtml) {
            const dayBlocks = scheHtml.split(/(?=<dl\s+id\s*=\s*["']sche_plan_\d+["'])/i);
            const validDayBlocks = dayBlocks.filter(b => /id\s*=\s*["']sche_plan_\d+["']/i.test(b));

            if (validDayBlocks.length > 0) {
                validDayBlocks.forEach((blockHtml, idx) => {
                    const dayNo = idx + 1;
                    const blockRawText = htmlToText(blockHtml, cleanUrl);

                    const timeline: TimelineItem[] = [];

                    // 1. Primary: Extract spots & spot images directly from <dt> and <dd> HTML accordion blocks
                    const pairRegex = /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
                    let pairMatch;
                    const spotPairs: { title: string; desc: string; images: string[] }[] = [];

                    while ((pairMatch = pairRegex.exec(blockHtml)) !== null) {
                        const dtHtml = pairMatch[1];
                        const ddHtml = pairMatch[2];

                        let rawTitle = htmlToText(dtHtml, '')
                            .replace(/==== TARGET METADATA START ====[\s\S]*?==== TARGET METADATA END ====/g, '')
                            .replace(/닫기/g, '')
                            .replace(/^\[(?:관광정보|관광지|식당정보|숙박정보)\]\s*/, '')
                            .replace(/[\r\n]+/g, ' ')
                            .trim();

                        const rawDesc = htmlToText(ddHtml, '')
                            .replace(/==== TARGET METADATA START ====[\s\S]*?==== TARGET METADATA END ====/g, '')
                            .trim();

                        const spotImgs: string[] = [];
                        const spotVideos: string[] = [];

                        const imgMatches = [...(dtHtml + ddHtml).matchAll(/(?:src|data-src|data-original)=["']([^"']+)["']/gi)];
                        for (const m of imgMatches) {
                            let u = m[1];
                            if (u.startsWith('//')) u = 'https:' + u;
                            else if (u.startsWith('/')) u = 'https://www.lottetour.com' + u;
                            else if (u.startsWith('http://')) u = u.replace('http://', 'https://');

                            if (!u.includes('btn_') && !u.includes('icon_') && !u.includes('logo_') && !u.includes('circle.png') && !u.includes('btn_uarr')) {
                                if (!spotImgs.includes(u)) spotImgs.push(u);
                            }
                        }

                        // Extract video links (YouTube, Vimeo, MP4, iframes)
                        const iframeMatches = [...(dtHtml + ddHtml).matchAll(/(?:<iframe[^>]+src=["']([^"']+)["']|https?:\/\/(?:www\.)?(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)[^\s"'\n<>]+|\bhttps?:\/\/[^\s"'\n<>]+\.(?:mp4|webm))/gi)];
                        for (const vm of iframeMatches) {
                            let v = vm[1] || vm[0];
                            if (v.startsWith('//')) v = 'https:' + v;
                            if (v.includes('youtube.com/watch?v=')) {
                                v = v.replace('watch?v=', 'embed/');
                            }
                            if (v.includes('youtu.be/')) {
                                v = v.replace('youtu.be/', 'www.youtube.com/embed/');
                            }
                            if (!spotVideos.includes(v)) spotVideos.push(v);
                        }

                        if (rawTitle && !rawTitle.includes('2026년') && !rawTitle.includes('요일') && !/^\d+일차$/.test(rawTitle)) {
                            spotPairs.push({ title: rawTitle, desc: rawDesc, images: spotImgs, videos: spotVideos });
                        }
                    }

                    if (spotPairs.length > 0) {
                        for (const pair of spotPairs) {
                            timeline.push({
                                type: pair.title.includes('이동') ? 'default' : 'location',
                                title: pair.title,
                                description: pair.desc,
                                images: pair.images,
                                videos: pair.videos
                            } as any);
                        }
                    } else {
                        // Fallback line-by-line parsing if no <dt>/<dd> accordion pairs found
                        const timelineIdx = blockHtml.indexOf('<div class="timeline">');
                        const timelinePart = timelineIdx !== -1 ? blockHtml.substring(timelineIdx) : blockHtml;

                        const rawLines = htmlToText(timelinePart, '')
                            .split('\n')
                            .map(l => l.trim())
                            .filter(l => l.length > 0 && !l.includes('====') && !l.includes('TARGET_') && !l.includes('URL:') && !l.includes('-->') && !l.includes('상세보기') && !l.includes('숙박 및 식사') && !l.includes('해당 일차의 숙박시설은') && !/^[A-Z0-9]{4,8}$/.test(l) && !/^\d{2}\/\d{2}$/.test(l) && !l.includes('출발') && !l.includes('도착'));

                        let currentTitle = '';
                        let currentDesc: string[] = [];
                        let currentImgs: string[] = [];

                        const flushTimelineItem = () => {
                            if (currentTitle) {
                                timeline.push({
                                    type: currentTitle.includes('이동') ? 'default' : (currentTitle.includes('◎') ? 'default' : 'location'),
                                    title: currentTitle,
                                    description: currentDesc.join('\n').trim(),
                                    images: [...currentImgs]
                                } as any);
                                currentTitle = '';
                                currentDesc = [];
                                currentImgs = [];
                            }
                        };

                        for (let i = 0; i < rawLines.length; i++) {
                            const line = rawLines[i];
                            if (line === '숙박' || line === '식사' || line.startsWith('[조식]') || line.startsWith('[중식]') || line.startsWith('[석식]')) {
                                continue;
                            }
                            const isTitleLine = line.startsWith('[') || line.startsWith('◎') || line.startsWith('▼') || line.startsWith('♣') || line.startsWith('★') || line.startsWith('■') || line.includes('자유시간') || line.includes('추천일정') || line.includes('이동') || (line.length <= 15 && !line.includes(' '));
                            if (isTitleLine) {
                                flushTimelineItem();
                                currentTitle = line.replace(/^\[(?:관광정보|관광지|식당정보|숙박정보)\]\s*/, '').replace(/[\r\n]+/g, '').trim();
                            } else {
                                if (!currentTitle) {
                                    currentTitle = line;
                                } else {
                                    currentDesc.push(line);
                                }
                            }
                        }
                        flushTimelineItem();
                    }

                    if (timeline.length === 0) {
                        timeline.push({
                            type: 'default',
                            title: dayNo === 1 ? '인천 출발 및 현지 도착' : (dayNo === validDayBlocks.length ? '현지 출발 및 인천 도착' : '전일정 현지 관광 및 휴식'),
                            description: '',
                            images: []
                        } as any);
                    }

                    // Extract hotel
                    const hotelMatch = blockRawText.match(/\[숙박정보\]\s*([^[\n\r]+)/i) || blockRawText.match(/숙박\s*:?\s*([^[\n\r]+)/i);
                    const hotel = hotelMatch ? hotelMatch[1].trim() : '전일정 특급/온천 호텔 숙박';

                    // Extract meals
                    const breakfastMatch = blockRawText.match(/\[조식\]\s*([^\n\r]+)/) || blockRawText.match(/◎조식◎\s*:?\s*([^\n\r]+)/);
                    const lunchMatch = blockRawText.match(/\[중식\]\s*([^\n\r]+)/) || blockRawText.match(/◎중식◎\s*:?\s*([^\n\r]+)/);
                    const dinnerMatch = blockRawText.match(/\[석식\]\s*([^\n\r]+)/) || blockRawText.match(/◎석식◎\s*:?\s*([^\n\r]+)/);

                    itinerary.push({
                        day: `${dayNo}일차`,
                        date: '',
                        title: `${dayNo}일차 일정`,
                        transportation: dayNo === 1 || dayNo === validDayBlocks.length ? null : '전용차량',
                        transport: dayNo === 1 ? {
                            flightNo: departureFlightNumber,
                            airline,
                            departureCity: '인천',
                            departureTime,
                            arrivalCity: destination,
                            arrivalTime
                        } : (dayNo === validDayBlocks.length ? {
                            flightNo: returnFlightNumber,
                            airline,
                            departureCity: destination,
                            departureTime: returnDepartureTime,
                            arrivalCity: '인천',
                            arrivalTime: returnArrivalTime
                        } : undefined),
                        timeline,
                        hotel,
                        meals: {
                            breakfast: breakfastMatch ? breakfastMatch[1].trim() : '포함',
                            lunch: lunchMatch ? lunchMatch[1].trim() : '포함',
                            dinner: dinnerMatch ? dinnerMatch[1].trim() : '포함'
                        }
                    });
                });
            }
        }

        // ─── Extract Meeting Info ───
        const meetingInfo: MeetingInfo[] = [];
        if (scheHtml) {
            const meetMatch = scheHtml.match(/<dl\s+class=["']meet_area["']>([\s\S]*?)<\/dl>/i);
            if (meetMatch) {
                const meetHtml = meetMatch[1];
                const meetLocMatch = meetHtml.match(/<dd[^>]*>([\s\S]*?)(?:<a|<p|$)/i);
                let meetLoc = meetLocMatch ? htmlToText(meetLocMatch[1], '') : '인천공항 T2 N존';
                meetLoc = meetLoc
                    .replace(/==== TARGET METADATA START ====[\s\S]*?==== TARGET METADATA END ====/g, '')
                    .replace(/&nbsp;/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                const timeMatch = meetHtml.match(/\b\d{2}:\d{2}\b/);
                const meetTime = timeMatch ? timeMatch[0] : departureTime;

                const descMatch = meetHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
                let meetDesc = descMatch ? htmlToText(descMatch[1], '') : '';
                meetDesc = meetDesc
                    .replace(/==== TARGET METADATA START ====[\s\S]*?==== TARGET METADATA END ====/g, '')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .trim();

                let meetImgUrl = '';
                const meetImgMatch = scheHtml.match(/<img[^>]+class=["']meet_img["'][^>]+src=["']([^"']+)["']/i) ||
                                     scheHtml.match(/src=["']([^"']+\/meetingimg\/[^"']+)["']/i);
                if (meetImgMatch) {
                    meetImgUrl = meetImgMatch[1];
                    if (meetImgUrl.startsWith('//')) meetImgUrl = 'https:' + meetImgUrl;
                    if (meetImgUrl.startsWith('http://')) meetImgUrl = meetImgUrl.replace('http://', 'https://');
                }

                meetingInfo.push({
                    type: '미팅장소',
                    title: '공항 미팅 및 수속 안내',
                    time: meetTime,
                    location: meetLoc,
                    description: meetDesc,
                    imageUrl: meetImgUrl
                });
            }
        }

        const rawResult: DetailedProductInfo = {
            isProduct: true,
            title,
            destination,
            price,
            departureDate,
            returnDate,
            duration,
            airline,
            departureFlightNumber,
            returnFlightNumber,
            departureAirport: '서울(ICN)',
            arrivalAirport: destination,
            departureTime,
            arrivalTime,
            returnDepartureAirport: destination,
            returnDepartureTime,
            returnArrivalTime,
            departureSegments,
            returnSegments,
            hotel: itinerary[0]?.hotel || '전일정 특급/온천 호텔 숙박 (상세 일정 참조)',
            url: cleanUrl,
            images,
            meetingInfo,
            keyPoints: [
                `${airline} 이용 직항 및 대표 명소 일정 포함`,
                '전일정 엄선된 숙박 및 현지 특식 포함',
                '전문 가이드 동행 및 주요 관광지 입장료 포함'
            ],
            inclusions: ['▶ 왕복항공료', '▶ 전일정 숙박비', '▶ 일정표 명시된 관광지 입장료', '▶ 여행자 보험'],
            exclusions: ['▶ 가이드/기사 경비', '▶ 개인 경비 및 에티켓 팁'],
            itinerary
        };

        return rawResult;

    } catch (e) {
        console.error(`[LotteTour] Native crawl error: ${url}`, e);
    }
    return null;
}

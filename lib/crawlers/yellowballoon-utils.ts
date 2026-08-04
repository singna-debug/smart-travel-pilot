import type { DetailedProductInfo, FlightSegment, ItineraryDay, MeetingInfo, TimelineItem } from '../types';
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

function extractCleanList(raw: string | undefined): string[] {
    if (!raw || typeof raw !== 'string' || !raw.trim()) return [];
    
    let text = raw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"');

    return text
        .split(/[\r\n]+/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

function extractCleanText(raw: string | undefined): string {
    if (!raw || typeof raw !== 'string' || !raw.trim()) return '';
    return raw
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/\n\s*\n+/g, '\n\n')
        .trim();
}

export async function fetchYellowBalloonNative(url: string, isSummaryOnly?: boolean): Promise<DetailedProductInfo | null> {
    try {
        console.log(`[YellowBalloon] Fetching native data for: ${url}`);
        const evCd = url.match(/evCd=([A-Za-z0-9_-]+)/i)?.[1] || '';
        const goodsCd = url.match(/goodsCd=([A-Za-z0-9_-]+)/i)?.[1] || (evCd ? evCd.split('-')[0] : '');

        // 1. Fetch main page HTML, prdt APIs, and PAPI schedule APIs in parallel
        const prdtScheduleUrl = evCd ? `https://prdt.ybtour.co.kr/api/event-info/${evCd}/schedule` : '';
        const prdtTourUrl = evCd ? `https://prdt.ybtour.co.kr/api/event-info/${evCd}/tour-detail` : '';
        const prdtIncExcUrl = evCd ? `https://prdt.ybtour.co.kr/api/event-info/${evCd}/inc-exc` : '';
        const prdtNoticeUrl = evCd ? `https://prdt.ybtour.co.kr/api/event-info/${evCd}/notice` : '';

        const papiScheduleUrl = evCd && goodsCd ? `https://papi.ybtour.co.kr/pkg/event-schedule/${evCd}/${goodsCd}` : '';
        const papiTourUrl = evCd ? `https://papi.ybtour.co.kr/pkg/event-schedule/${evCd}/tour-detail` : '';
        const papiNoticeUrl = evCd ? `https://papi.ybtour.co.kr/pkg/event/${evCd}/notice` : '';

        const [pageFetch, prdtScheduleRes, prdtTourRes, prdtIncExcRes, prdtNoticeRes, scheduleRes, tourRes, papiNoticeRes] = await Promise.all([
            quickFetch(url),
            prdtScheduleUrl ? fetch(prdtScheduleUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': url }
            }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
            prdtTourUrl ? fetch(prdtTourUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': url }
            }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
            prdtIncExcUrl ? fetch(prdtIncExcUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': url }
            }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
            prdtNoticeUrl ? fetch(prdtNoticeUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': url }
            }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
            papiScheduleUrl ? fetch(papiScheduleUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': url }
            }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
            papiTourUrl ? fetch(papiTourUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': url }
            }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
            papiNoticeUrl ? fetch(papiNoticeUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': url }
            }).then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
        ]);

        const html = pageFetch?.html;
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

        // ─── Extract Inclusions & Exclusions 100% in full ───
        const noticeBody = papiNoticeRes?.body || papiNoticeRes || {};
        const rawInc = noticeBody.inclInfo || prdtIncExcRes?.body?.incContent || prdtIncExcRes?.incContent || gd.goodsIncContents || ev.goodsIncContents || gd.incContent || ev.incContent || gd.incContents || ev.incContents || '';
        const rawExc = noticeBody.notinclInfo || prdtIncExcRes?.body?.excContent || prdtIncExcRes?.excContent || gd.goodsExcContents || ev.goodsExcContents || gd.excContent || ev.excContent || gd.excContents || ev.excContents || '';

        const inclusions = extractCleanList(rawInc);
        if (inclusions.length === 0) {
            inclusions.push('▶ 왕복항공료', '▶ 전일정 숙박비', '▶ 일정표 명시된 관광지 입장료', '▶ 여행자 보험');
        }

        const exclusions = extractCleanList(rawExc);
        if (exclusions.length === 0) {
            exclusions.push('▶ 가이드/기사 경비', '▶ 개인 경비 및 에티켓 팁');
        }

        // ─── Extract Cancellation Policy & Terms 100% in full ───
        const rawCancel = [noticeBody.poliInfo, noticeBody.cancelInfo].filter(Boolean).join('\n\n') ||
            prdtNoticeRes?.body?.cancelContent || prdtNoticeRes?.cancelContent || prdtNoticeRes?.body?.noticeContent || prdtNoticeRes?.noticeContent || gd.goodsCancelContents || ev.goodsCancelContents || gd.cancelContent || ev.cancelContent || gd.cancelNotice || ev.cancelNotice || gd.goodsNoticeContents || ev.goodsNoticeContents || gd.termsContent || ev.termsContent || '';
        const cancellationPolicy = extractCleanText(rawCancel);

        // ─── Parse Native Itinerary from prdt/papi Schedule APIs or pageProps ───
        const itinerary: ItineraryDay[] = [];

        // Day-level metadata (accommodation, meal flags) — one row per day
        const rawDayMeta: any[] =
            (scheduleRes?.body?.scheduleDetail && Array.isArray(scheduleRes.body.scheduleDetail) && scheduleRes.body.scheduleDetail.length > 0) ? scheduleRes.body.scheduleDetail :
            (prdtScheduleRes?.body?.scheduleDetail && Array.isArray(prdtScheduleRes.body.scheduleDetail) && prdtScheduleRes.body.scheduleDetail.length > 0) ? prdtScheduleRes.body.scheduleDetail :
            (prdtScheduleRes?.scheduleDetail && Array.isArray(prdtScheduleRes.scheduleDetail) && prdtScheduleRes.scheduleDetail.length > 0) ? prdtScheduleRes.scheduleDetail :
            (Array.isArray(prdtScheduleRes?.body) && prdtScheduleRes.body.length > 0) ? prdtScheduleRes.body :
            [];

        const dayMetaMap: Record<number, any> = {};
        for (const meta of rawDayMeta) {
            const dNo = meta.dayNo || meta.day || 1;
            if (!dayMetaMap[dNo]) dayMetaMap[dNo] = meta;
        }

        // Per-item timeline (title/content per time slot within a day) — richer, preferred source
        const rawScheduleDetail: any[] =
            (scheduleRes?.body?.scheduleDetailTm && Array.isArray(scheduleRes.body.scheduleDetailTm) && scheduleRes.body.scheduleDetailTm.length > 0) ? scheduleRes.body.scheduleDetailTm :
            (prdtScheduleRes?.body?.scheduleDetailTm && Array.isArray(prdtScheduleRes.body.scheduleDetailTm) && prdtScheduleRes.body.scheduleDetailTm.length > 0) ? prdtScheduleRes.body.scheduleDetailTm :
            rawDayMeta.length > 0 ? rawDayMeta :
            (pageProps.scheduleDetail || pageProps.scheduleList || ev.scheduleDetail || gd.scheduleDetail || pageProps.schedule || []);

        const rawTourDetail =
            (prdtTourRes?.body && Array.isArray(prdtTourRes.body)) ? prdtTourRes.body :
            (Array.isArray(prdtTourRes)) ? prdtTourRes :
            (tourRes?.body && Array.isArray(tourRes.body)) ? tourRes.body :
            (pageProps.tourDetail || pageProps.tourList || []);

        if (Array.isArray(rawScheduleDetail) && rawScheduleDetail.length > 0) {
            // Group raw schedule items by dayNo
            const dayMap: Record<number, any[]> = {};
            for (const item of rawScheduleDetail) {
                const dNo = item.dayNo || item.day || 1;
                if (!dayMap[dNo]) dayMap[dNo] = [];
                dayMap[dNo].push(item);
            }
            for (const dNo of Object.keys(dayMap)) {
                dayMap[Number(dNo)].sort((a, b) => (a.tmNo ?? a.tmSeq ?? 0) - (b.tmNo ?? b.tmSeq ?? 0));
            }

            // Group tour spots by tmSeq (the specific timeline slot they belong to, NOT the whole day —
            // tour-detail entries share dayNoSeq with every timeline item in that day, so matching on
            // dayNoSeq would attach every spot's images to every item in the day)
            const tourMapBySeq: Record<number, any[]> = {};
            if (Array.isArray(rawTourDetail)) {
                for (const t of rawTourDetail) {
                    const seq = t.tmSeq || t.dayNoSeq || t.daySeq || t.seq;
                    if (seq) {
                        if (!tourMapBySeq[seq]) tourMapBySeq[seq] = [];
                        tourMapBySeq[seq].push(t);
                    }
                }
            }

            const dayNumbers = Object.keys(dayMap).map(Number).sort((a, b) => a - b);
            for (const dayNo of dayNumbers) {
                const dayItems = dayMap[dayNo];
                const timeline: TimelineItem[] = [];

                // 1. Add timeline items directly from raw scheduleDetail
                for (const item of dayItems) {
                    const title = (item.tmTitle || item.tmSubTitle || item.schTitle || item.trvInfoNm || item.title || '').trim();
                    const subtitle = (item.tmSubTitle && item.tmSubTitle.trim() !== title) ? item.tmSubTitle.trim() : (item.locNm || '');
                    
                    const contentParts = [
                        item.tmContent,
                        item.tmDetail,
                        item.tmDesc,
                        item.schContent,
                        item.cnts,
                        item.cntsNm,
                        item.trvContent,
                        item.remark
                    ].filter(Boolean);

                    const cleanContent = extractCleanText(contentParts.join('\n'));

                    // Matched tour spots (below) get their own timeline entry with their own images —
                    // don't also copy those images onto this umbrella/parent item, or the same photos
                    // end up duplicated on both the general schedule line and the specific spot line.
                    const itemSeq = item.tmSeq || item.dayNoSeq || item.daySeq || item.seq;

                    // Add item if title OR cleanContent exists (NEVER skip items just because tmTitle is empty)
                    if (title || cleanContent) {
                        timeline.push({
                            type: 'location',
                            title: title || subtitle || `${dayNo}일차 일정 안내`,
                            subtitle: title && subtitle ? subtitle : '',
                            description: cleanContent,
                            images: []
                        } as any);
                    }

                    // Also attach any spots matched via dayNoSeq / tourMapBySeq
                    if (itemSeq && tourMapBySeq[itemSeq]) {
                        for (const spot of tourMapBySeq[itemSeq]) {
                            const spotTitle = (spot.trvInfoNm || spot.trvNm || spot.title || '').trim();
                            const spotDesc = extractCleanText(spot.trvContent || spot.trvDetail || spot.trvDesc || spot.cnts || '');
                            const spotImgs: string[] = [spot.image1Url, spot.image2Url, spot.image3Url, spot.imgUrl, spot.image].filter(Boolean);

                            if (spotTitle && !timeline.some(t => t.title === spotTitle)) {
                                timeline.push({
                                    type: 'location',
                                    title: spotTitle,
                                    subtitle: spot.locNm || '',
                                    description: spotDesc,
                                    images: spotImgs
                                } as any);
                            } else if (!spotTitle && spotDesc && !timeline.some(t => t.description === spotDesc)) {
                                timeline.push({
                                    type: 'location',
                                    title: spot.locNm || '관광지 안내',
                                    subtitle: '',
                                    description: spotDesc,
                                    images: spotImgs
                                } as any);
                            }
                        }
                    }
                }

                if (timeline.length === 0) {
                    const fallbackDesc = extractCleanText(dayItems.map(d => d.tmContent || d.tmDetail || d.schContent || d.cnts || '').join('\n'));
                    timeline.push({
                        type: 'default',
                        title: dayNo === 1 ? '출발 및 현지 도착' : (dayNo === dayNumbers.length ? '귀국' : '전일 일정 및 현지 관광'),
                        description: fallbackDesc
                    });
                }

                const firstDayItem = dayMetaMap[dayNo] || dayItems[0] || {};
                itinerary.push({
                    day: `${dayNo}일차`,
                    date: '',
                    title: `${dayNo}일차 일정`,
                    transportation: dayNo === 1 || dayNo === dayNumbers.length ? null : '전용차량',
                    transport: dayNo === 1 ? {
                        flightNo: departureFlightNumber,
                        airline,
                        departureCity: departureAirport,
                        departureTime,
                        arrivalCity: arrivalAirport,
                        arrivalTime
                    } : (dayNo === dayNumbers.length ? {
                        flightNo: returnFlightNumber,
                        airline: ev.inAirNm || airline,
                        departureCity: returnDepartureAirport,
                        departureTime: returnDepartureTime,
                        arrivalCity: returnArrivalAirport,
                        arrivalTime: returnArrivalTime
                    } : undefined),
                    timeline,
                    hotel: firstDayItem.accommNm || ev.accomNm || '호텔/리조트 숙박',
                    meals: {
                        breakfast: firstDayItem.foodBYn === 'Y' ? '포함' : (firstDayItem.foodB || '불포함'),
                        lunch: firstDayItem.foodLYn === 'Y' ? '포함' : (firstDayItem.foodL || '불포함'),
                        dinner: firstDayItem.foodDYn === 'Y' ? '포함' : (firstDayItem.foodD || '불포함'),
                    }
                });
            }
        }

        // ─── Extract Meeting Info (airport meeting point / check-in guidance) ───
        const meetingInfo: MeetingInfo[] = [];
        const firstTmItem = rawScheduleDetail.find((it: any) => (it.dayNo || it.day) === 1) || {};

        const meetLocation = firstTmItem.meetAirPlace || noticeBody.meetingnm || firstTmItem.meetAirDiviCont || '';
        const meetTimeRaw = firstTmItem.meetAirTm || noticeBody.meetingtm || '';
        const meetTime = meetTimeRaw ? formatTime(meetTimeRaw) : (departureTime ? `${departureTime} 항공편 출발 (수속 마감시간 별도 안내)` : '일정표 참조');

        const meetDescParts = [
            firstTmItem.meetAirNote,
            noticeBody.meetingnote,
            (noticeBody.meetingmanager || noticeBody.meetingtelno) ? `담당자: ${[noticeBody.meetingmanager, noticeBody.meetingtelno].filter(Boolean).join(' / ')}` : ''
        ].filter(Boolean);
        const meetDescription = extractCleanText(meetDescParts.join('\n')) || extractCleanText(firstTmItem.tmContent) || '';

        if (meetLocation || meetDescription) {
            meetingInfo.push({
                type: '미팅장소',
                location: meetLocation || `${departureAirport} 국제공항`,
                time: meetTime,
                description: meetDescription,
                imageUrl: firstTmItem.meetAirImgUrl || undefined
            });
        }

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
            inclusions,
            exclusions,
            cancellationPolicy,
            cancellationRules: cancellationPolicy ? [cancellationPolicy] : [],
            specialTerms: cancellationPolicy,
            meetingInfo,
            itinerary
        };

        return rawResult;

    } catch (e) {
        console.error(`[YellowBalloon] Native crawl error: ${url}`, e);
    }
    return null;
}

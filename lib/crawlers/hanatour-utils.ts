import type { DetailedProductInfo } from '../../types';
import * as cheerio from 'cheerio';

export function extractHanaTourPkgCd(url: string): string | null {
    try {
        const urlObj = new URL(url);
        const pkgCdQuery = urlObj.searchParams.get('pkgCd');
        if (pkgCdQuery) return pkgCdQuery;

        // Path segment search (e.g. /pkg/APP216260804TWC)
        const pathMatch = url.match(/\/pkg\/([A-Z0-9]+)/i);
        if (pathMatch) return pathMatch[1];
    } catch (e) {}
    
    // Direct regex match fallback
    const directMatch = url.match(/pkgCd=([A-Z0-9]+)/i);
    if (directMatch) return directMatch[1];

    return null;
}

function cleanHtml(h: string): string {
    if (!h) return '';
    return h
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeAndFormatHtml(html: string): string {
    if (!html) return '';
    try {
        const $ = cheerio.load(html);
        
        // Remove script, style, head, link, iframe, meta
        $('script, style, link, iframe, meta').remove();
        
        // Process tags and attributes
        $('*').each((_, elem) => {
            const tagName = elem.tagName.toLowerCase();
            
            // Style spans matching badge classes into premium inline styled badges
            if (tagName === 'span') {
                const className = $(elem).attr('class') || '';
                if (className.includes('grade') || className.includes('state')) {
                    const text = $(elem).text().trim();
                    let badgeStyle = 'display: inline-block; padding: 2px 6px; font-size: 0.68rem; font-weight: 700; border-radius: 4px; margin-right: 6px; vertical-align: middle; line-height: 1.2;';
                    if (text.includes('선택관광')) {
                        badgeStyle += 'color: #0284c7; background: #e0f2fe; border: 1px solid #bae6fd;';
                    } else if (text.includes('스페셜') || text.includes('포함')) {
                        badgeStyle += 'color: #7c3aed; background: #f3e8ff; border: 1px solid #e9d5ff;';
                    } else if (text.includes('추천') || text.includes('MD')) {
                        badgeStyle += 'color: #d97706; background: #fef3c7; border: 1px solid #fde68a;';
                    } else {
                        badgeStyle += 'color: #64748b; background: #f1f5f9; border: 1px solid #e2e8f0;';
                    }
                    $(elem).attr('style', badgeStyle);
                }
            }
            
            // Clean attributes except safe ones
            const attribs = elem.attribs || {};
            for (const attr of Object.keys(attribs)) {
                if (attr !== 'href' && attr !== 'src' && attr !== 'target' && attr !== 'style') {
                    $(elem).removeAttr(attr);
                }
            }
            
            // Style links to make them clickable, colored and underlined
            if (tagName === 'a') {
                $(elem).attr('target', '_blank');
                $(elem).attr('rel', 'noopener noreferrer');
                $(elem).attr('style', 'color: #10b981; text-decoration: underline; font-weight: 600; word-break: break-all;');
            }
            
            // Style images to be responsive
            if (tagName === 'img') {
                $(elem).attr('style', 'width: 100%; height: auto; border-radius: 8px; margin-top: 8px; margin-bottom: 8px; display: block;');
            }
        });
        
        // Return body inner HTML
        return $.html('body').replace(/^<body>|<\/body>$/g, '').trim();
    } catch (e) {
        return html;
    }
}

function processCardHtml(html: string): string {
    if (!html) return '';
    try {
        const $ = cheerio.load(html);
        
        // 1. Extract all unique image URLs before removing anything
        const imgUrls: string[] = [];
        $('img').each((_, img) => {
            const src = $(img).attr('src');
            if (src && !imgUrls.includes(src)) {
                imgUrls.push(src);
            }
        });

        // 2. Extract badges (span.grade, span.state) from header before removing headers
        const badges: string[] = [];
        $('._tit span.grade, ._tit span.state, .tit span.grade, .tit span.state').each((_, span) => {
            const text = $(span).text().trim();
            if (text) {
                const className = $(span).attr('class') || '';
                const badgeHtml = `<span class="${className}">${text}</span>`;
                if (!badges.includes(badgeHtml)) {
                    badges.push(badgeHtml);
                }
            }
        });

        // 3. Format custom tags (prices, duration, alternative schedules) by adding line breaks between separate points
        $('.custom_tag_a .txt_cont, .custom_tag_a p, .custom_tag_a span, .custom_tag_b .txt_cont, .custom_tag_b p, .custom_tag_b span').each((_, el) => {
            // Append a line break only if it contains text
            if ($(el).text().trim()) {
                $(el).append('<br>');
            }
        });
        
        // 4. Remove Swiper navigation controls, buttons, and card title headers to prevent duplicated titles and blank spaces
        $('script, style, a.detail, hr, .controller, .swiper-pagination, a.prev, a.next, .prev, .next, .blind, .swiper-button-prev, .swiper-button-next').remove();
        $('._tit, .title, .tit').remove();
        
        // Remove image containers to prevent empty wrapper gaps
        $('._thumb, .thumb, .swiper-container, .swiper-wrapper, .swiper-slide, .img_list, .scroll_box').remove();

        // 5. Extract the target description HTML using the card block
        let targetHtml = '';
        const cardUnit = $('.card_unit, .card_mngr');
        if (cardUnit.length > 0) {
            targetHtml = cardUnit.first().html() || '';
        } else {
            targetHtml = $.html('body').replace(/^<body>|<\/body>$/g, '') || '';
        }
        
        // 6. Load the description HTML and unwrap structural block elements, keeping only text, links, spans and line breaks.
        const $c = cheerio.load(targetHtml);
        const allowedTags = ['a', 'b', 'strong', 'br', 'span', 'p'];
        $c('*').each((_, elem) => {
            const tagName = elem.tagName.toLowerCase();
            if (tagName !== 'root' && tagName !== 'body' && tagName !== 'html') {
                if (!allowedTags.includes(tagName)) {
                    // Replace element with its children content (unwrapping it)
                    $(elem).replaceWith($(elem).contents());
                }
            }
        });
        
        let cleanedTextHtml = $c('body').html() || '';

        // Collapse multiple consecutive br tags and clean leading/trailing ones
        cleanedTextHtml = cleanedTextHtml
            .replace(/(<br\s*\/?>\s*)+/gi, '<br>')
            .replace(/^(<br\s*\/?>)+/gi, '')
            .replace(/(<br\s*\/?>)+$/gi, '')
            .trim();
        
        // 7. Prepend images and badges directly at the root level (no wrappers)
        let combinedHtml = '';
        if (imgUrls.length > 0) {
            imgUrls.forEach(url => {
                combinedHtml += `<img src="${url}" /><br>`;
            });
        }
        if (badges.length > 0) {
            combinedHtml += `<p style="margin: 0 0 6px 0; display: block;">${badges.join(' ')}</p>`;
        }
        combinedHtml += cleanedTextHtml;
        
        // 8. Style and sanitize links/images
        return sanitizeAndFormatHtml(combinedHtml);
    } catch (e) {
        return cleanHtml(html);
    }
}

function formatTime(t: string): string {
    if (!t || t.length !== 4) return t;
    return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
}

function formatDate(d: string): string {
    if (!d || d.length !== 8) return d;
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

export async function fetchHanaTourNative(url: string, isSummaryOnly = false): Promise<DetailedProductInfo | null> {
    const pkgCd = extractHanaTourPkgCd(url);
    if (!pkgCd) {
        console.warn(`[HanaTourNative] Failed to extract pkgCd from URL: ${url}`);
        return null;
    }

    console.log(`[HanaTourNative] Fetching native APIs for pkgCd: ${pkgCd}`);

    const headers = {
        'content-type': 'application/json',
        'accept': 'application/json',
        'origin': 'https://www.hanatour.com',
        'prgmid': 'CHPC0PKG0200M200',
        'referer': 'https://www.hanatour.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    let dataInfo: any = null;
    let dataItnr: any = null;
    let dataHtl: any = null;

    try {
        // Parallel fetch for info, itinerary, and lodging list
        const [resInfo, resItnr, resHtl] = await Promise.all([
            fetch('https://gw.hanatour.com/package/pkg/api/common/pkgcomprod/getPkgProdInfo/v1.00?_siteId=hanatour', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    pkgCd,
                    inpPathCd: 'DCP',
                    smplYn: 'N',
                    coopYn: 'N',
                    resAcceptPtn: {},
                    partnerYn: 'N'
                })
            }).catch(() => null),
            fetch('https://gw.hanatour.com/package/pkg/api/common/pkgcomprod/getPkgProdItnrInfo/v1.00?_siteId=hanatour', {
                method: 'POST',
                headers,
                body: JSON.stringify({ pkgCd })
            }).catch(() => null),
            fetch('https://gw.hanatour.com/ice/svc/mciPkg/getPkgHtlLst?_siteId=hanatour', {
                method: 'POST',
                headers,
                body: JSON.stringify({ pkgCd, ptnCd: '' })
            }).catch(() => null)
        ]);

        if (resInfo && resInfo.ok) {
            const json = await resInfo.json();
            dataInfo = json?.data;
        }
        if (resItnr && resItnr.ok) {
            const json = await resItnr.json();
            dataItnr = json?.data;
        }
        if (resHtl && resHtl.ok) {
            const json = await resHtl.json();
            dataHtl = json?.data;
        }
    } catch (e: any) {
        console.error(`[HanaTourNative] Exception fetching APIs:`, e.message);
        return null;
    }

    if (!dataInfo && !dataItnr) {
        console.warn(`[HanaTourNative] No data returned from Hanatour APIs.`);
        return null;
    }

    // Merge and map to DetailedProductInfo
    const info = dataInfo || {};
    const itnr = dataItnr || {};
    const htl = dataHtl || {};

    const title = info.saleProdNm || '';
    const priceStr = String(info.adtTotlAmt || '').replace(/[^0-9]/g, '');
    const duration = info.trvlNgtCnt && info.trvlDayCnt ? `${info.trvlNgtCnt}박 ${info.trvlDayCnt}일` : '';
    
    // Dates from itinerary days
    const schdInfoList = itnr.schdInfoList || [];
    const departureDate = schdInfoList[0]?.strtDt ? formatDate(schdInfoList[0].strtDt) : '';
    const returnDate = schdInfoList[schdInfoList.length - 1]?.strtDt ? formatDate(schdInfoList[schdInfoList.length - 1].strtDt) : '';
    
    // Flights
    const flights = itnr.pkgAirSeqList || [];
    
    const mapFlightSegment = (s: any) => ({
        airline: s.airlNm || '',
        flightNo: s.airlCd && s.flgtNm ? `${s.airlCd}${s.flgtNm}` : '',
        departureCity: s.depAptCityNm || s.depAptCd || '',
        departureTime: s.depHm ? `${s.depHm.slice(0, 2)}:${s.depHm.slice(2, 4)}` : '',
        arrivalCity: s.arrAptCityNm || s.arrAptCd || '',
        arrivalTime: s.arrHm ? `${s.arrHm.slice(0, 2)}:${s.arrHm.slice(2, 4)}` : '',
        duration: '',
        layoverDuration: ''
    });

    const rawDepSegments = flights.filter((f: any) => String(f.legSeq) === '1').map(mapFlightSegment);
    const rawRetSegments = flights.filter((f: any) => String(f.legSeq) === '2').map(mapFlightSegment);

    const departureSegments = rawDepSegments.length > 1 ? rawDepSegments : [];
    const returnSegments = rawRetSegments.length > 1 ? rawRetSegments : [];

    const firstDep = rawDepSegments[0] || {};
    const lastDep = rawDepSegments[rawDepSegments.length - 1] || {};
    const firstRet = rawRetSegments[0] || {};
    const lastRet = rawRetSegments[rawRetSegments.length - 1] || {};

    const airlineName = firstDep.airline || (flights[0]?.airlNm || '');

    // Hotels mapped by day
    const htlInfoList = htl.htlInfoList || [];
    const hotels = htlInfoList.map((h: any) => ({
        name: h.htlKoNm,
        englishName: h.htlEnNm || '',
        address: '',
        images: [],
        amenities: []
    })).filter((v: any, i: number, a: any[]) => a.findIndex(t => t.name === v.name) === i);

    // Itinerary formatting
    const itinerary = schdInfoList.map((day: any, idx: number) => {
        const timeline = (day.schdMainInfoList || []).map((item: any) => {
            let itemTitle = item.cardNm || item.memoTitlNm || '';
            let rawDesc = item.cardCntntPc || item.cardCntnt || item.memoCont || '';
            
            // Special handling for meals inside the timeline
            if (item.schdCatgNm === '식사') {
                const mealText = item.mealCont || item.mealTypeNm || '';
                itemTitle = `${item.dtlMealDvNm || '식사'}${mealText ? ` (${mealText})` : ''}`;
                rawDesc = '';
            }
            
            // Safeguard for content-only notices (e.g. checkouts, shopping tour notices)
            if (!itemTitle && rawDesc) {
                const cleanDescText = cleanHtml(rawDesc);
                if (cleanDescText.length <= 50) {
                    itemTitle = cleanDescText;
                    rawDesc = ''; // Set as title, clear description
                } else {
                    itemTitle = cleanDescText.substring(0, 30) + '...';
                }
            }
            
            // Format HTML safely, preserving basic tags, links, and images
            const formattedDesc = processCardHtml(rawDesc);
            
            return {
                type: item.schdCatgNm === '관광지' ? 'location' : 'default',
                title: cleanHtml(itemTitle),
                subtitle: '',
                description: formattedDesc
            };
        }).filter((t: any) => t.title);

        const mealsObj = { breakfast: '-', lunch: '-', dinner: '-' };
        (day.schdMainInfoList || []).forEach((item: any) => {
            const mealName = item.dtlMealDvNm || '';
            const mealText = cleanHtml(item.mealCont || item.mealTypeNm || '');
            if (mealName.includes('조식')) mealsObj.breakfast = mealText || '포함';
            if (mealName.includes('중식')) mealsObj.lunch = mealText || '포함';
            if (mealName.includes('석식')) mealsObj.dinner = mealText || '포함';
        });

        const dayHotel = htlInfoList.find((h: any) => h.schdDay === idx + 1);
        const hotelName = dayHotel ? dayHotel.htlKoNm : '호텔 확정 예정';

        const destCity = info.prdAttrCd === 'P' ? cleanHtml(lastDep.arrivalCity || info.destNm || '') : '보라카이';
        let dayTitle = '';
        if (idx === 0) {
            dayTitle = `인천, ${destCity}`;
        } else if (idx === schdInfoList.length - 1) {
            dayTitle = `${destCity}, 인천`;
        } else {
            dayTitle = destCity;
        }

        const isFirstDay = idx === 0;
        const isLastDay = idx === schdInfoList.length - 1;

        const dayFlight = isFirstDay && departureSegments.length > 0 ? {
            flightNo: departureSegments.map(s => s.flightNo).filter(Boolean).join(' / '),
            airline: airlineName,
            departureCity: firstDep.departureCity || '인천',
            departureTime: firstDep.departureTime || '',
            arrivalCity: lastDep.arrivalCity || '',
            arrivalTime: lastDep.arrivalTime || '',
            duration: '',
            segments: departureSegments
        } : (isLastDay && returnSegments.length > 0 ? {
            flightNo: returnSegments.map(s => s.flightNo).filter(Boolean).join(' / '),
            airline: returnSegments[0]?.airline || airlineName,
            departureCity: firstRet.departureCity || '',
            departureTime: firstRet.departureTime || '',
            arrivalCity: lastRet.arrivalCity || '',
            arrivalTime: lastRet.arrivalTime || '',
            duration: '',
            segments: returnSegments
        } : undefined);

        return {
            day: idx + 1,
            date: formatDate(day.strtDt),
            title: dayTitle,
            transport: (idx === 0 || idx === schdInfoList.length - 1) ? '항공' : '-',
            timeline,
            items: timeline,
            hotel: hotelName,
            meals: mealsObj,
            flight: dayFlight
        };
    });

    // Inclusions & Exclusions
    const inclusions = (info.trvlExpnInclList || []).map((x: any) => 
        cleanHtml(`${x.trvlExpnClstNm || ''} ${x.trvlExpnDesc || ''}`)
    ).filter(Boolean);

    const exclusions = (info.trvlExpnNoneInclList || []).map((x: any) => 
        cleanHtml(`${x.trvlExpnClstNm || ''} ${x.trvlExpnDesc || ''}`)
    ).filter(Boolean);

    // Meeting Info
    const meet = itnr.meetInfoBcVo || {};
    const meetingInfo = meet.fstMeetCont ? [{
        type: '미팅안내',
        location: sanitizeAndFormatHtml(meet.fstMeetCont),
        time: meet.sndgMeetTm ? formatTime(meet.sndgMeetTm) : '일정표 참조',
        description: '',
        imageUrl: meet.mapImgUrlAdrs || null
    }] : [];

    // Highlights / Keypoints
    let keyPoints = (info.prodCorePntList || []).map((p: any) => 
        cleanHtml(`${p.corePntTitlNm || ''}: ${p.corePntCont || ''}`)
    ).filter(Boolean).slice(0, 8);

    if (!keyPoints || keyPoints.length === 0) {
        try {
            const { quickFetch, htmlToText } = require('../crawler-base-utils');
            const { extractRichKeyPointsFromText } = require('./url-analysis');
            const fetchRes = await quickFetch(url).catch(() => ({ html: '' }));
            if (fetchRes && fetchRes.html) {
                const text = htmlToText(fetchRes.html, url);
                const rich = extractRichKeyPointsFromText(text);
                if (rich && rich.length > 0) {
                    keyPoints = rich;
                }
            }
        } catch (e) {}
    }

    const rawResult = {
        isProduct: true,
        title: cleanHtml(title),
        destination: cleanHtml(info.destNm || lastDep.arrivalCity || ''),
        price: priceStr,
        departureDate,
        returnDate,
        duration,
        airline: airlineName,
        departureFlightNumber: departureSegments.map(s => s.flightNo).filter(Boolean).join(' / '),
        returnFlightNumber: returnSegments.map(s => s.flightNo).filter(Boolean).join(' / '),
        departureAirport: firstDep.departureCity || '인천',
        arrivalAirport: lastDep.arrivalCity || '',
        departureTime: firstDep.departureTime || '',
        arrivalTime: lastDep.arrivalTime || '',
        returnDepartureAirport: firstRet.departureCity || '',
        returnDepartureTime: firstRet.departureTime || '',
        returnArrivalTime: lastRet.arrivalTime || '',
        departureSegments,
        returnSegments,
        url,
        itinerary,
        hotels,
        meetingInfo,
        inclusions,
        exclusions,
        keyPoints
    } as any;

    const { refineData } = require('./refiner');
    return refineData(rawResult, JSON.stringify(info), url);
}


import * as iconv from 'iconv-lite';
import type { DetailedProductInfo } from '../types';
import { scrapeWithBrowser } from '@/lib/browser-crawler';

/**
 * URL 크롤링 및 상품 정보 파싱 (서버 사이드 전용)
 */

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function quickFetch(url: string, retries = 2): Promise<{ html: string; title: string }> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000); // 12초 타임아웃으로 약간 연장

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || '';

        let html = '';
        // 1. 헤더에서 CHARSET 확인
        if (contentType.toLowerCase().includes('euc-kr')) {
            html = iconv.decode(Buffer.from(buffer), 'euc-kr');
        } else {
            // 2. 일단 UTF-8로 디코딩 후 메타 태그 재확인
            const tempText = new TextDecoder('utf-8').decode(buffer);
            if (tempText.includes('charset=euc-kr') || tempText.includes('charset=EUC-KR') || tempText.includes('CP949')) {
                html = iconv.decode(Buffer.from(buffer), 'euc-kr');
            } else {
                html = tempText;
            }
        }

        console.log(`[QuickFetch] Url: ${url}, Status: ${response.status}, Length: ${html.length}`);

        // 간단한 타이틀 추출
        let title = '';
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        return { html, title };

    } catch (error) {
        if (retries > 0) {
            console.log(`[QuickFetch] 재시도 (${retries}회 남음): ${url}`);
            await sleep(1000);
            return quickFetch(url, retries - 1);
        }
        throw error;
    }
}

async function fetchModeTourNative(url: string, sbKey?: string): Promise<DetailedProductInfo | null> {
    const productNoMatch = url.match(/package\/(\d+)/i) || url.match(/Pnum=(\d+)/i);
    if (!productNoMatch) return null;
    const productNo = productNoMatch[1];

    const headers = {
        'modewebapireqheader': '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}',
        'referer': 'https://www.modetour.com/',
        'accept': 'application/json'
    };

    let dataDetail: any = null;
    let dataPoints: any = null;
    let dataSchedule: any = null;
    let dataHotel: any = null;

    try {
        console.log(`[ModeTour Native] Fetching for ${productNo}`);
        const [resDetail, resPoints, resSchedule, resHotel] = await Promise.all([
            fetch(`https://b2c-api.modetour.com/Package/GetProductDetailInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetProductKeyPointInfo?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetScheduleList?productNo=${productNo}`, { headers }),
            fetch(`https://b2c-api.modetour.com/Package/GetHotelList?productNo=${productNo}`, { headers })
        ]);

        if (resDetail.ok) dataDetail = await resDetail.json();
        if (resPoints.ok) dataPoints = await resPoints.json();
        if (resSchedule.ok) dataSchedule = await resSchedule.json();
        if (resHotel.ok) dataHotel = await resHotel.json();

        if (!dataDetail?.result) {
            const resSimple = await fetch(`https://b2c-api.modetour.com/Package/GetProductSimpleDetail?productNo=${productNo}`, { headers });
            if (resSimple.ok) dataDetail = await resSimple.json();
        }
    } catch (e: any) {
        console.warn(`[ModeTour Native] Fetch error: ${e.message}`);
    }

    if (dataDetail?.isOK && dataDetail.result) {
        const d = dataDetail.result;
        console.log(`[ModeTour Native] Processing: ${d.productName || d.prd_nm}`);

        // 1. Title 정제
        let cleanTitle = d.productName || '';
        cleanTitle = cleanTitle.replace(/\[출발확정\]/g, '').trim();

        // 2. Region 정제
        const mainRegion = d.category2 || '';
        const cities = d.visitCities && d.visitCities.length > 0 ? d.visitCities.join('/') : (d.category3 || '');
        const destination = mainRegion ? `${mainRegion}, ${cities}` : cities;

        // 3. Duration 보정
        let duration = d.travelPeriod || '';
        if (/^\d+일$/.test(duration)) {
            const days = parseInt(duration);
            if (days > 1) duration = `${days - 1}박${duration}`;
        }

        // --- 4. 상품 포인트 추출 (서술형 혜택 문장) ---
        let keyPoints: string[] = [];

        // 4.1. GetProductKeyPointInfo에서 specialBenefits/sightseeings 우선 추출 (가장 고품질)
        if (dataPoints?.isOK && dataPoints.result) {
            const r = dataPoints.result;
            const tabSections = [r.specialBenefits, r.sightseeings, r.hotels, r.meals].filter(Boolean);
            for (const section of tabSections) {
                if (Array.isArray(section)) {
                    for (const item of section) {
                        if (keyPoints.length >= 7) break;
                        const title = (item.title || item.name || '').replace(/\[특전\]/g, '').trim();
                        if (title.length > 3 && !keyPoints.includes(title)) {
                            keyPoints.push(title);
                        }
                    }
                }
            }
        }

        // travelRecommendNote 등 상세 정보
        const moreInfoText = [
            d.travelRecommendNote,
            d.specialEventNote,
            d.generalBonusNote,
        ].filter(Boolean).join('\n\n');

        // 4.2. [특전] 태그가 있는 라인 또는 타이틀 추출
        if (moreInfoText) {
            const rawText = moreInfoText.replace(/<[^>]+>/g, '');
            
            const specialLines = rawText.split('\n')
                .filter((l: string) => l.includes('[특전]') || l.includes('【특전】'))
                .map((l: string) => l.replace(/\[특전\]|【특전】/g, '').replace(/^[\s■\*\-]+/, '').trim())
                .filter((l: string) => {
                    if (l.length < 5 || l.length > 60) return false;
                    if (l.includes('대상자') || l.includes('유효기간') || l.includes('여권') || l.includes('등록 필요')) return false;
                    if (l.includes('입국 카드') || l.includes('MDAC') || l.includes('비자') || l.includes('보험')) return false;
                    if (l.includes('방문하는 모든') || l.includes('이내 등록')) return false;
                    if (l.includes('불포함') || l.includes('포함 사항')) return false;
                    return true;
                });
            
            specialLines.forEach(l => {
                if (keyPoints.length < 7 && !keyPoints.includes(l)) keyPoints.push(l);
            });

            // 4.3. ■섹션■ 구분을 파싱하여 관광/숙박/식사 핵심 추출
            const sections = rawText.split(/■[^■]+■/);
            const sectionHeaders = rawText.match(/■([^■]+)■/g) || [];
            
            for (let i = 0; i < sectionHeaders.length && keyPoints.length < 7; i++) {
                const header = sectionHeaders[i].replace(/■/g, '').trim();
                const content = sections[i + 1] || '';
                if (header.includes('관광') || header.includes('관광지')) {
                    const places = content.split('\n').map((l: string) => l.replace(/^[\s\*\-\d\.]+/, '').trim()).filter((l: string) => l.length > 3 && !l.startsWith('#'));
                    if (places.length > 0) {
                        const placeNames = places.slice(0, 3).map((p: string) => p.split(/[:：]/)[0].trim()).filter((p: string) => p.length > 2 && p.length < 15);
                        if (placeNames.length > 0 && !keyPoints.some(kp => kp.includes('명소'))) {
                            keyPoints.push(`${placeNames.join(', ')} 등 주요 명소 방문`);
                        }
                    }
                } else if (header.includes('숙박') && !keyPoints.some(kp => kp.includes('호텔') || kp.includes('숙박'))) {
                    const hotelLines = content.split('\n').map((l: string) => l.replace(/^[\s\*\-]+/, '').trim()).filter((l: string) => l.length > 5);
                    if (hotelLines.length > 0) {
                        let h = hotelLines[0];
                        if (h.includes('특급') || h.includes('5성')) h = '특급호텔에서 전일정 편안한 숙박';
                        else if (h.includes('리조트')) h = '리조트 숙박';
                        else if (h.includes('월드체인')) h = '월드체인 호텔 숙박';
                        else if (h.length > 25) h = h.substring(0, 25).trim() + ' 숙박';
                        if (h.length > 3) keyPoints.push(h);
                    }
                } else if (header.includes('식사') && !keyPoints.some(kp => kp.includes('식사') || kp.includes('석식'))) {
                    const mealLines = content.split('\n').map((l: string) => l.replace(/^[\s\*\-]+/, '').trim()).filter((l: string) => l.length > 3 && !l.startsWith('#'));
                    if (mealLines.some((m: string) => m.includes('무제한'))) keyPoints.push('호텔 식사 및 음료 무제한 제공');
                    else if (mealLines.length > 0) keyPoints.push(`식사 ${mealLines.length}회 포함`);
                }
            }
            
            // 4.4. 섹션 구분이 없는 경우 일반 라인에서 추출 (garbage fallback)
            if (keyPoints.length < 3) {
                const lines = rawText.split('\n')
                    .map((l: string) => l.replace(/^[\s■\*\-\d\.]+/, '').replace(/■+$/g, '').trim())
                    .filter((l: string) => {
                        if (l.length < 5 || l.length > 50) return false;
                        const cl = l.replace(/■/g, '').trim();
                        if (!cl || cl.startsWith('#')) return false;
                        if (/^(스페셜혜택|관광|숙박|식사|차량|기타|특전|혜택)\s*$/i.test(cl)) return false;
                        if (cl.includes('행사 인원') || cl.includes('인솔자 배정')) return false;
                        if (cl.includes('대상자') || cl.includes('유효기간') || cl.includes('여권') || cl.includes('등록 필요')) return false;
                        if (cl.includes('입국 카드') || l.includes('MDAC') || l.includes('비자') || l.includes('보험')) return false;
                        if (cl.includes('방문하는 모든') || l.includes('이내 등록')) return false;
                        // 노출 금지 단어 추가 (마케팅 문구 방지)
                        if (cl.includes('타사비교') || cl.includes('원하시나') || cl.includes('약속 드립니') || cl.includes('일생에 단 한')) return false;
                        return true;
                    });
                for (const line of lines) {
                    if (keyPoints.length >= 7) break;
                    if (line.includes(':') || line.includes('：')) {
                        const [place] = line.split(/[:：]/);
                        if (place.trim().length > 2 && place.trim().length < 20) {
                            if (!keyPoints.includes(`${place.trim()} 관광`)) keyPoints.push(`${place.trim()} 관광`);
                        }
                    } else {
                        let desc = line;
                        if (/온천호텔\d+박/.test(desc)) desc = '전 일정 온천호텔 숙박';
                        else if (/호텔석식\d+회/.test(desc)) desc = `호텔 석식 ${desc.match(/\d+/)?.[0] || ''}회 제공`;
                        else if (/현지식\d+회/.test(desc)) desc = `현지 특식 ${desc.match(/\d+/)?.[0] || ''}회 포함`;
                        
                        const cleaned = desc.replace(/\s+/g, ' ').trim();
                        if (!keyPoints.includes(cleaned)) keyPoints.push(cleaned);
                    }
                }
            }
        }

        // 4.5. 타이틀 괄호 안 키워드 → 서술형 보충 (기존 포인트가 부족할 때)
        if (cleanTitle.includes('(') && keyPoints.length < 4) {
            const inner = cleanTitle.substring(cleanTitle.lastIndexOf('(') + 1, cleanTitle.lastIndexOf(')'));
            const parts = inner.split(/[+\n,]/).filter((s: string) => s.trim().length > 1);
            for (const p of parts) {
                if (keyPoints.length >= 7) break;
                const pt = p.trim();
                if (pt.includes('온천호텔') && !keyPoints.some(kp => kp.includes('온천'))) keyPoints.push('전 일정 온천호텔 숙박');
                else if (pt.includes('석식') && pt.includes('무제한') && !keyPoints.some(kp => kp.includes('무제한'))) keyPoints.push('호텔 석식 및 음료 무제한 제공');
                else if (pt.includes('석식') && !keyPoints.some(kp => kp.includes('석식'))) keyPoints.push('호텔 석식 포함');
                else if (pt.includes('무제한') && !keyPoints.some(kp => kp.includes('무제한'))) keyPoints.push('술/음료 무제한 제공');
            }
        }

        // 4.6. 상품 속성 자동 추가
        if (d.isConfirmed || cleanTitle.includes('출발확정') || cleanTitle.includes('[출발확정]')) {
            keyPoints.unshift('출발 확정 상품');
        }
        if (d.isNoShopping || cleanTitle.includes('노쇼핑') || moreInfoText.includes('노쇼핑')) {
            keyPoints.push('노쇼핑 일정으로 편안한 여행');
        }
        if (d.isNoOption || cleanTitle.includes('노옵션') || moreInfoText.includes('노옵션')) {
            keyPoints.push('노옵션 자유로운 일정');
        }


        // (호텔 포인트는 hotelInfo 정의 후 추가 - 아래 참조)

        // travelRecommendNote 등 상세 정보를 description으로 전달 (Gemini 요약용)
        const moreInfo = [
            d.travelRecommendNote,
            d.specialEventNote,
            d.generalBonusNote,
            d.groupBriefKeyword
        ].filter(Boolean).join('\n\n');

        // --- 5. 일정(Itinerary) 매핑 ---
        let itinerary: any[] = [];
        if (dataSchedule?.isOK && Array.isArray(dataSchedule.result)) {
            const rawItems = dataSchedule.result;
            // Day별로 그룹화
            const daysMap = new Map<number, any>();
            rawItems.forEach((item: any) => {
                const day = item.itiDays || 1;
                if (!daysMap.has(day)) {
                    daysMap.set(day, {
                        day: `${day}일차`,
                        title: item.itiPlaceName || `Day ${day}`,
                        activities: [],
                        meals: { breakfast: '제공', lunch: '제공', dinner: '제공' }
                    });
                }
                const dayObj = daysMap.get(day);

                // 장소명 및 요약 설명 추가
                if (item.itiPlaceName) {
                    dayObj.activities.push({
                        time: item.itiTime || '',
                        location: item.itiPlaceName,
                        description: (item.itiSummaryDes || '') + (item.itiDetailDes ? ' ' + item.itiDetailDes : '')
                    });
                }

                // 식사 정보 매핑 (보통 itiSummaryDes 등에 식사 키워드가 있을 수 있음)
                // 하지만 모두투어 API는 보통 식사 데이터가 따로 있는 경우가 많음.
                // 일단 간단하게 activities에 포함됨.
            });
            itinerary = Array.from(daysMap.values()).sort((a, b) => a.day - b.day);
        }

        // --- 6. 호텔(Hotel) 정보 매핑 ---
        let hotelInfo = '';
        if (dataHotel?.isOK && Array.isArray(dataHotel.result)) {
            // 첫 번째 호텔 혹은 대표 호텔 추출
            const firstDayHotel = dataHotel.result[0];
            if (firstDayHotel?.listHotelPlaceData?.[0]) {
                const h = firstDayHotel.listHotelPlaceData[0];
                hotelInfo = `${h.placeNameK || h.itiPlaceName} (${h.address || ''})`;
            }
        }

        // 4.4. 호텔 정보에서 포인트 추출 (hotelInfo가 정의된 후)
        if (hotelInfo && !keyPoints.some(kp => kp.includes('호텔') || kp.includes('숙박'))) {
            const hotelName = hotelInfo.split('(')[0].trim();
            if (hotelName.length > 3) {
                keyPoints.push(`${hotelName} 숙박`);
            }
        }

        // 중복 제거 및 최대 7개 제한 (refineData에서 4개로 최종 자르기)
        // 4.6. 최종 문장 정제 및 해시태그 보충
        keyPoints = keyPoints.map(p => 
            p.trim()
             .replace(/^["'\[【]+|["'\]】]+$/g, '')
             .replace(/^[\s■\*\-]+/, '')
             .replace(/[\.\!\?]+$/g, '')
             .replace(/\s*입니다$/, '')
             .replace(/다$/, '')
             .trim()
        ).filter(p => p.length > 5);

        // 포인트가 부족하면 해시태그에서 보충
        if (keyPoints.length < 4 && d.groupBriefKeyword) {
            const tags = d.groupBriefKeyword.split('#')
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 1 && s.length < 15);
            for (const tag of tags) {
                if (keyPoints.length >= 4) break;
                if (!keyPoints.some(kp => kp.includes(tag))) {
                    const tagPoint = tag.includes('관광') || tag.includes('투어') ? `${tag} 포함` : `${tag} 관광`;
                    keyPoints.push(tagPoint);
                }
            }
        }

        keyPoints = Array.from(new Set(keyPoints)).slice(0, 4);

        const rawPrice = String(d.sellingPriceAdultTotalAmount || '');
        const formattedPrice = rawPrice.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        return {
            isProduct: true,
            title: cleanTitle,
            destination: destination,
            price: formattedPrice,
            departureDate: d.departureDate || d.start_dt || d.departure_dt || '',
            returnDate: d.arrivalDate || d.end_dt || d.arrival_dt || '',
            departureAirport: d.departureCityName || d.departureCity || '인천',
            airline: d.transportName || d.carrier_nm || '',
            duration: duration,
            flightCode: d.transportInfo || d.flight_no || d.carrier_no || '',
            departureTime: d.startTime || d.depTm || d.dep_tm || d.strTm || d.str_tm || '',
            arrivalTime: d.endTime || d.arrTm || d.arr_tm || d.endTm || d.end_tm || '',
            returnDepartureTime: d.returnStartTime || d.returnDepTm || d.return_dep_tm || '',
            returnArrivalTime: d.returnEndTime || d.returnArrTm || d.return_arr_tm || '',
            hotel: hotelInfo,
            itinerary: itinerary,
            inclusions: d.includedNote ? [d.includedNote.replace(/<[^>]+>/g, ' ').trim()] : [],
            exclusions: d.unincludedNote ? [d.unincludedNote.replace(/<[^>]+>/g, ' ').trim()] : [],
            url: url,
            features: [],
            courses: [],
            specialOffers: [],
            keyPoints: keyPoints,
            hashtags: '',
            hasNoOption: false,
            hasFreeSchedule: false,
            description: moreInfo // 추가: Gemini 요약용 상세 정보
        } as DetailedProductInfo;
    }
    return null;
}

export async function fetchContent(url: string): Promise<{ text: string, nextData?: string, nativeData?: any }> {
    try {
        console.log(`[Crawler] Fetching: ${url}`);

        // ModeTour인 경우 네이티브 직접 요청 시도
        if (url.includes('modetour.com')) {
            const nativeData = await fetchModeTourNative(url);
            if (nativeData) {
                console.log('[Crawler] ModeTour Native Data Acquired');
                // HTML도 일단 가져옴 (Gemini가 추가 분석할 수도 있으니)
                const { html } = await quickFetch(url);
                const text = htmlToText(html, url);
                const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
                const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;
                return { text, nextData, nativeData };
            }
        }

        // 1. 빠른 fetch 시도
        const { html } = await quickFetch(url);

        // 2. HTML을 텍스트로 변환 (메타데이터 포함)
        const text = htmlToText(html, url);

        // HTML 원본에서 __NEXT_DATA__ 추출 (이미 htmlToText에서 썼을 수도 있지만 명시적으로 추출)
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;

        if (text.length > 500 || html.length > 5000) {
            return { text, nextData };
        }

        throw new Error('Content too short');

    } catch (error) {
        console.error(`[Crawler] Error:`, error);
        throw error;
    }
}

export function htmlToText(html: string, url: string): string {
    // 메타데이터 추출
    let pageTitle = '';
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) pageTitle = titleMatch[1].trim();

    let ogTitle = '';
    const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["'](.*?)["']\s*\/?>/i);
    if (ogMatch) ogTitle = ogMatch[1].trim();

    let bodyTitle = '';
    const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    const h4Match = html.match(/<h4[^>]*>(.*?)<\/h4>/i);
    if (h4Match) bodyTitle = h4Match[1].replace(/<[^>]+>/g, '').trim();
    else if (h1Match) bodyTitle = h1Match[1].replace(/<[^>]+>/g, '').trim();

    let classTitle = '';
    const classMatch = html.match(/<(?:div|strong|h[1-6]|span|p)[^>]*class=["'](?:[^"']*?\s)?(?:tit|title|product_tit|goods_name|gd_name|prd_nm)(?:\s[^"']*?)?["'][^>]*>(.*?)<\/(?:div|strong|h[1-6]|span|p)>/i);
    if (classMatch) classTitle = classMatch[1].replace(/<[^>]+>/g, '').trim();

    let targetTitle = '';
    const jsonTitleMatch = html.match(/["'](?:GoodsName|PrdName|prd_nm|title|goods_name)["']\s*:\s*["'](.*?)["']/i);
    if (jsonTitleMatch) targetTitle = jsonTitleMatch[1].trim();

    let targetPrice = '';
    // productPrice_Adult_TotalAmount, productPrice_Adult, SalePrice, GoodsPrice 등 다양한 키 대응
    const jsonPriceMatch = html.match(/["'](?:Price|SalePrice|goodsPrice|GoodsPrice|ProductPrice_Adult|Price_Adult|productPrice_Adult_TotalAmount|price_adult)["']\s*[:=]\s*["']?(\d+)["']?/i);
    if (jsonPriceMatch) targetPrice = jsonPriceMatch[1];

    // [추가] 텍스트 내 가격 패턴 (예: 1,290,000원) - JSON 실패 시 대비
    if (!targetPrice) {
        const textPriceMatch = html.match(/[\s>]([0-9]{1,3}(?:,[0-9]{3})+)원/);
        if (textPriceMatch) targetPrice = textPriceMatch[1].replace(/,/g, '');
    }

    let targetDuration = '';
    const durationMatch = html.match(/(\d+)\s*박\s*(\d+)\s*일/);
    if (durationMatch) {
        targetDuration = `${durationMatch[1]}박${durationMatch[2]}일`;
    } else {
        // [보완] "X일" 패턴만 있는 경우 (3일 -> 2박3일 추정)
        const onlyDayMatch = html.match(/[\s>]([1-9])\s*일[\s<]/);
        if (onlyDayMatch) {
            const days = parseInt(onlyDayMatch[1], 10);
            targetDuration = `${days - 1}박${days}일`;
        }
    }

    let targetAirline = '';
    let targetDepartureAirport = '';
    let targetDepartureDate = '';
    let targetDescription = '';

    // [강력 보완] NEXT_DATA (ModeTour 등 SPA 프레임워크 렌더링 데이터) 직접 파싱
    const startIdx = html.indexOf('<script id="__NEXT_DATA__"');
    if (startIdx !== -1) {
        const jsonStart = html.indexOf('>', startIdx) + 1;
        const jsonEnd = html.indexOf('</script>', jsonStart);
        if (jsonStart !== 0 && jsonEnd !== -1) {
            try {
                const nextDataStr = html.substring(jsonStart, jsonEnd);
                const nextDataObj = JSON.parse(nextDataStr);

                const urlProductNoMatch = url.match(/package\/(\d+)/i) || url.match(/goodsNo=(\d+)/i) || url.match(/Pnum=(\d+)/i);
                const targetProductNo = urlProductNoMatch ? urlProductNoMatch[1] : '';

                // 동적 재귀 탐색 (API 응답구조가 브라우저/서버에 따라 달라지는 것에 대응)
                const extractVal = (obj: any, key: string, targetId?: string): any => {
                    if (!obj || typeof obj !== 'object') return null;

                    // 1. 만약 특정 ID를 찾는 중이라면, 해당 노드가 그 ID를 직접 가졌는지 확인
                    const currentId = obj.productNo || obj.goodsNo || obj.prd_nm_no || obj.itemNo || obj.goods_no || obj.pnum || obj.Pnum || obj.groupNumber;

                    // 만약 이 객체가 다른 상품의 정보를 담고 있다면 건너뜀 (매칭 필터링)
                    if (targetId && currentId && String(currentId) !== targetId) return null;

                    // 현재 객체에서 키를 찾음
                    if (key in obj && obj[key] !== null && obj[key] !== undefined && typeof obj[key] !== 'object') {
                        return obj[key];
                    }

                    let highestVal: any = null;
                    for (const k in obj) {
                        const res = extractVal(obj[k], key, targetId);
                        if (res !== null && res !== undefined) {
                            if (key.toLowerCase().includes('price') || key.toLowerCase().includes('amount')) {
                                const numRes = parseInt(String(res).replace(/[^0-9]/g, ''), 10);
                                const numHighest = highestVal ? parseInt(String(highestVal).replace(/[^0-9]/g, ''), 10) : 0;
                                if (numRes > numHighest) highestVal = res;
                            } else {
                                return res;
                            }
                        }
                    }
                    return highestVal;
                };

                // [강력 보완] ID 기반 추출 시도 후 실패 시 ID 없이 전역 시도 (백업)
                const extractValRobust = (obj: any, key: string, targetId?: string): any => {
                    let res = extractVal(obj, key, targetId);
                    if (!res && targetId) {
                        // ID 매칭 없이 전체 트리에서 첫 번째로 발견되는 유효값 추출
                        res = extractVal(obj, key);
                    }
                    return res;
                };

                const nextPrice = extractValRobust(nextDataObj, 'sellingPriceAdultTotalAmount', targetProductNo)
                    || extractValRobust(nextDataObj, 'productPrice_Adult', targetProductNo)
                    || extractValRobust(nextDataObj, 'salePrice', targetProductNo)
                    || extractValRobust(nextDataObj, 'sellingPrice', targetProductNo)
                    || extractValRobust(nextDataObj, 'price', targetProductNo)
                    || extractValRobust(nextDataObj, 'totalAmount', targetProductNo)
                    || extractValRobust(nextDataObj, 'adultPrice', targetProductNo);

                if (nextPrice) targetPrice = String(nextPrice).replace(/[^0-9]/g, '');

                const nextAirline = extractValRobust(nextDataObj, 'transportName', targetProductNo)
                    || extractValRobust(nextDataObj, 'airlineName', targetProductNo)
                    || extractValRobust(nextDataObj, 'airLineName', targetProductNo)
                    || extractValRobust(nextDataObj, 'airline_nm', targetProductNo)
                    || extractValRobust(nextDataObj, 'carrierNm', targetProductNo)
                    || extractValRobust(nextDataObj, 'airline', targetProductNo);
                if (nextAirline) targetAirline = String(nextAirline);

                const nextAirport = extractValRobust(nextDataObj, 'departureAirportName', targetProductNo)
                    || extractValRobust(nextDataObj, 'dep_airport_nm', targetProductNo)
                    || extractValRobust(nextDataObj, 'start_city_nm', targetProductNo)
                    || extractValRobust(nextDataObj, 'depCityName', targetProductNo);
                if (nextAirport) targetDepartureAirport = String(nextAirport);

                const nextDuration = extractValRobust(nextDataObj, 'duration', targetProductNo)
                    || extractValRobust(nextDataObj, 'itinerary_period', targetProductNo)
                    || extractValRobust(nextDataObj, 'travelPeriod', targetProductNo);
                if (nextDuration) targetDuration = String(nextDuration);

                const nextDepDate = extractValRobust(nextDataObj, 'departureDate', targetProductNo)
                    || extractValRobust(nextDataObj, 'startDate', targetProductNo)
                    || extractValRobust(nextDataObj, 'start_date', targetProductNo);
                if (nextDepDate) targetDepartureDate = String(nextDepDate);

                const nextTitle = extractValRobust(nextDataObj, 'goodsName', targetProductNo)
                    || extractValRobust(nextDataObj, 'productName', targetProductNo)
                    || extractValRobust(nextDataObj, 'title', targetProductNo);
                if (nextTitle) targetTitle = String(nextTitle);
                
                const nextDesc = extractValRobust(nextDataObj, 'travelRecommendNote', targetProductNo)
                    || extractValRobust(nextDataObj, 'description', targetProductNo)
                    || extractValRobust(nextDataObj, 'moreInfo', targetProductNo);
                if (nextDesc) targetDescription = String(nextDesc);

            } catch (e) {
                console.error('[Crawler] __NEXT_DATA__ 파싱 오류:', e);
            }
        }
    }

    // [추가] JS 렌더링 후 DOM 가시 텍스트에서 직접 추출 (한국어 패턴) 최우선 적용
    // Script/style 제거한 텍스트에서 검색 (고객 노출 가격/항공사가 가장 정확함)
    const visibleText = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');

    // 성인 가격 패턴: "성인 799,000원" 또는 "799,000 원" 등
    const visiblePriceMatch = visibleText.match(/(\d{1,3}(?:,\d{3})+)\s*원/);
    if (visiblePriceMatch) {
        const parsedVisiblePrice = visiblePriceMatch[1].replace(/,/g, '');
        // 기본 JSON에서 추출한 가격이 너무 작거나(ex: 유류할증료 28800), 가시적 텍스트 가격이 더 현실적이면 덮어씌움
        if (!targetPrice || targetPrice === '0' || parseInt(parsedVisiblePrice, 10) > parseInt(targetPrice, 10)) {
            targetPrice = parsedVisiblePrice;
            console.log(`[Crawler] 가시 텍스트에서 가격 추출 (덮어쓰기): ${targetPrice}`);
        }
    }

    // 항공사와 출발 공항도 __NEXT_DATA__ 추출 실패 시 덮어쓰기
    if (!targetAirline) {
        const visibleAirlineMatch = visibleText.match(/(제주항공|대한항공|아시아나항공|아시아나|진에어|티웨이항공|티웨이|이스타항공|이스타|에어서울|에어부산|에어프레미아|피치항공|스쿠트|비엣젯|필리핀항공|싱가포르항공|타이항공|ANA|JAL)/);
        if (visibleAirlineMatch) {
            targetAirline = visibleAirlineMatch[1];
            console.log(`[Crawler] 가시 텍스트에서 항공사 추출: ${targetAirline}`);
        }
    }
    if (!targetDepartureAirport) {
        // 출발지 패턴: "인천출발", "인천 출발", "인천공항" 등
        const visibleAirportMatch = visibleText.match(/(인천|김포|부산|대구|청주|광주|제주|무안)\s*(?:출발|공항|국제공항)/);
        if (visibleAirportMatch) {
            targetDepartureAirport = visibleAirportMatch[1];
            console.log(`[Crawler] 가시 텍스트에서 출발공항 추출: ${targetDepartureAirport}`);
        }
    }

    if (!targetDepartureDate) {
        const visibleDateMatch = visibleText.match(/(?:출발일?|일정)\s*[:\-]?\s*(\d{4}[-.]\d{2}[-.]\d{2})/);
        if (visibleDateMatch) {
            targetDepartureDate = visibleDateMatch[1].replace(/\./g, '-');
            console.log(`[Crawler] 가시 텍스트에서 출발일 추출: ${targetDepartureDate}`);
        } else {
            const anyDateMatch = visibleText.match(/(\d{4}[-.]\d{2}[-.]\d{2})/);
            if (anyDateMatch) {
                targetDepartureDate = anyDateMatch[1].replace(/\./g, '-');
                console.log(`[Crawler] 가시 텍스트에서 일반 출발일 패턴 추출: ${targetDepartureDate}`);
            }
        }
    }

    // [추가] 가시 텍스트 추출 실패 시 최후의 수단: 백그라운드 JSON 정규식 직접 찾기
    // 주: 여기에는 유류할증료나 부분 가격이 포함될 위험이 있음
    if (!targetPrice || targetPrice === '0') {
        const altPriceMatch = html.match(/["'](?:sellingPriceAdultTotalAmount|totalAmount|adultPrice|salePrice)["']\s*:\s*(\d+)/);
        if (altPriceMatch) targetPrice = altPriceMatch[1];
    }
    if (!targetAirline) {
        const altAirlineMatch = html.match(/["'](?:transportName|airlineName|carrierNm)["']\s*:\s*["']([^"']+)["']/);
        if (altAirlineMatch) targetAirline = altAirlineMatch[1];
    }
    if (!targetDepartureAirport) {
        const altAirportMatch = html.match(/["'](?:departureCityName|depCityName|start_city_nm)["']\s*:\s*["']([^"']+)["']/);
        if (altAirportMatch) targetDepartureAirport = altAirportMatch[1];
    }

    // PAGE_TITLE 보강
    let finalTitle = pageTitle;
    if ((pageTitle.includes('모두투어') || pageTitle.includes('상품상세') || pageTitle.includes('undefined')) &&
        (ogTitle.length > 5 || bodyTitle.length > 5 || targetTitle.length > 5 || classTitle.length > 5)) {
        finalTitle = targetTitle || classTitle || ogTitle || bodyTitle;
    }

    let processed = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');

    const cleanBody = processed
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim()
        .substring(0, 50000);

    // [중요] 메타데이터를 가장 먼저 배치해야 텍스트가 잘려도 메타데이터는 유지됨
    const metadataBlock = `==== TARGET METADATA START ====
PAGE_TITLE: "${finalTitle}"
OG_TITLE: "${ogTitle}"
BODY_TITLE: "${bodyTitle}"
CLASS_TITLE: "${classTitle}"
TARGET_TITLE: "${targetTitle || finalTitle}"
TARGET_PRICE: "${targetPrice}"
TARGET_DURATION: "${targetDuration}"
TARGET_AIRLINE: "${targetAirline}"
TARGET_DEPARTURE_AIRPORT: "${targetDepartureAirport}"
TARGET_DEPARTURE_DATE: "${targetDepartureDate}"
TARGET_DESCRIPTION: "${targetDescription}"
==== TARGET METADATA END ====`;

    return `${metadataBlock}

[CONTENT BODY]
${cleanBody}`;
}

export async function analyzeWithGemini(text: string, url: string, nextData?: string): Promise<DetailedProductInfo | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    try {
        const modelName = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';
        console.log(`[Gemini] AI 분석 시작... (모델: ${modelName})`);

        // --- ADDED LOGGING ---
        console.log(`[Gemini] 입력 텍스트 원본 길이: ${text.length}`);

        const prompt = `다음 여행 상품 페이지에서 정보를 추출하여 JSON으로 반환하세요.
URL: ${url}
${nextData ? `--- [중요: NEXT_JS_DATA (JSON 데이터 참조용)] ---\n${nextData.substring(0, 15000)}\n` : ''}

반환 형식:
{
  "isProduct": true,
  "title": "METADATA 섹션의 TARGET_TITLE 또는 PAGE_TITLE 중 더 구체적인 것을 그대로 추출 (상품명 전체)",
  "destination": "목적지 (국가+도시)",
  "price": "METADATA 섹션의 TARGET_PRICE 값을 최우선적으로 사용하세요 (숫자만 추출). 없으면 텍스트에서 성인 1인 가격을 찾으세요.",
  "departureDate": "출발일 (YYYY-MM-DD 형식 권장)",
  "airline": "METADATA 섹션의 TARGET_AIRLINE을 최우선으로 사용하세요. 없으면 항공사(티웨이, 제주항공 등) 추출.",
  "duration": "METADATA 섹션의 TARGET_DURATION 값을 최우선으로 사용하세요. 없으면 'X박 Y일' 패턴을 찾으세요.",
  "departureAirport": "METADATA 섹션의 TARGET_DEPARTURE_AIRPORT를 최우선으로 사용하세요. 없으면 텍스트에서 '인천', '부산', '대구' 등 출발지 추출.",
  "keyPoints": ["상품 포인트 요약 ('~입니다', '~합니다' 등의 서술어 절대 금지. 반드시 명사형으로 끝나는 짧은 개조식 구문 작성. 예: '특급호텔에서 전일정 숙박', '노쇼핑 일정으로 편안한 여행')"],
  "exclusions": ["불포함 사항 요약"]
}

입력 텍스트:
${text.substring(0, 30000)}`;

        console.log(`[Gemini] 최종 프롬프트 길이: ${prompt.length}`);
        const fs = require('fs');
        fs.writeFileSync('debug-gemini-prompt.txt', prompt, 'utf-8');
        // ---------------------

        const tryModel = async (mName: string) => {
            console.log(`[Gemini] Trying model: ${mName}`);
            // Retry with v1 API if v1beta fails for quota
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${mName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
            });
            const data = await response.json();
            if (data.error) {
                console.warn(`[Gemini] Model ${mName} error: ${data.error.message}`);
                return { error: data.error };
            }
            return data;
        };

        let data = await tryModel(modelName);
        if (data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
            console.log('[Gemini] Flash model exhausted, trying 1.5-flash...');
            data = await tryModel('gemini-1.5-flash');
        }
        if (data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
            console.log('[Gemini] 1.5-flash exhausted, trying 1.5-pro...');
            data = await tryModel('gemini-1.5-pro');
        }

        if (data.error || !data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            console.error('[Gemini] All models failed or no text');
            return analyzeWithRegex(text, url);
        }

        const resText = data.candidates[0].content.parts[0].text;
        console.log('[Gemini] AI 응답:', resText.substring(0, 150));

        // JSON 파싱 전처리 (마크다운, 주석, 후행 쉼표 제거 등)
        let jsonStr = resText.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();

        // 간혹 AI가 응답 끝에 불필요한 텍스트를 붙이는 경우
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }

        // 후행 쉼표 제거 (Trailing commas)
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

        try {
            return JSON.parse(jsonStr);
        } catch (parseErr: any) {
            console.warn('[Gemini] 1차 파싱 실패, 정규식으로 핵심 필드 수동 추출 시도:', parseErr.message);
            // JSON이 완전히 망가졌을 때 핵심 데이터만 어떻게든 살리는 Fallback
            const fallback: any = { isProduct: true, features: [], exclusions: [], keyPoints: [] };

            const extractString = (key: string) => {
                const match = jsonStr.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`));
                return match ? match[1] : '';
            };

            fallback.title = extractString('title');
            fallback.price = extractString('price');
            fallback.airline = extractString('airline');
            fallback.departureAirport = extractString('departureAirport');
            fallback.departureDate = extractString('departureDate');
            fallback.duration = extractString('duration');

            return fallback;
        }
    } catch (e: any) {
        console.error('[Gemini] 네트워크/시스템 오류 (Rate Limit 등):', e);
        console.log('[Fallback] 정규식을 이용한 자체 분석 모드로 전환합니다.');
        return analyzeWithRegex(text, url);
    }
}

/**
 * [Fallback] Gemini API 호출 실패(Rate Limit 등) 시 정규식으로 직접 메타데이터를 추출하는 함수
 */
function analyzeWithRegex(text: string, url: string): DetailedProductInfo {
    const fallback: DetailedProductInfo = {
        isProduct: true,
        title: '',
        destination: '',
        price: '',
        departureDate: '',
        duration: '',
        airline: '',
        departureAirport: '',
        hotel: '',
        features: [],
        courses: [],
        specialOffers: [],
        inclusions: [],
        exclusions: [],
        itinerary: [],
        keyPoints: [],
        hashtags: '',
        hasNoOption: false,
        hasFreeSchedule: false,
        url: url
    };

    const stripQuotes = (s: string) => s.replace(/^"|"$/g, '').trim();

    const extractMatch = (regex: RegExp) => {
        const match = text.match(regex);
        return match ? stripQuotes(match[1]) : '';
    };

    fallback.title = extractMatch(/TARGET_TITLE:\s*"?([^"\n]*)"?/);
    if (!fallback.title || fallback.title === 'undefined') {
        fallback.title = extractMatch(/PAGE_TITLE:\s*"?([^"\n]*)"?/);
    }

    fallback.price = extractMatch(/TARGET_PRICE:\s*"?([^"\n]*)"?/);
    fallback.duration = extractMatch(/TARGET_DURATION:\s*"?([^"\n]*)"?/);
    fallback.airline = extractMatch(/TARGET_AIRLINE:\s*"?([^"\n]*)"?/);
    fallback.departureAirport = extractMatch(/TARGET_DEPARTURE_AIRPORT:\s*"?([^"\n]*)"?/);
    fallback.departureDate = extractMatch(/TARGET_DEPARTURE_DATE:\s*"?([^"\n]*)"?/);

    console.log('[Fallback] 정규식 추출 결과:', JSON.stringify(fallback));
    return fallback;
}

/**
 * 확정서 전용 종합 분석 — 페이지 전체 내용에서 일정/식사/호텔/포함사항 등 모두 추출
 */
export async function analyzeForConfirmation(text: string, url: string, nextData?: string): Promise<any | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    let preExtractedInclusions = '';
    let preExtractedExclusions = '';

    // Next_DATA에서 포함/불포함 직접 추출 (글자수 제한으로 잘리는 문제 방지)
    if (nextData) {
        console.log('[Debug] nextData length:', nextData.length);
        try {
            const dataObj = JSON.parse(nextData);
            console.log('[Debug] dataObj keys:', Object.keys(dataObj));
            const findValues = (obj: any, keyMap: string[], results: string[] = []): string[] => {
                if (!obj || typeof obj !== 'object') return results;
                for (const k in obj) {
                    if (keyMap.includes(k.toLowerCase()) && typeof obj[k] === 'string') {
                        console.log(`[Debug-Find] Found key ${k}, len: ${obj[k].length}`);
                        if (obj[k].length > 10) results.push(obj[k]);
                    }
                    findValues(obj[k], keyMap, results);
                }
                return results;
            };
            const inc = findValues(dataObj, ['includednote', 'incldcn', 'inclddetailcdnm']);
            const exc = findValues(dataObj, ['notincludednote', 'notincldcn', 'notinclddetailcdnm']);
            preExtractedInclusions = inc.join('\n\n');
            preExtractedExclusions = exc.join('\n\n');
            console.log('[Debug] preExtractedInclusions Length:', preExtractedInclusions.length);
            console.log('[Debug] preExtractedExclusions Length:', preExtractedExclusions.length);
        } catch (e) {
            console.error('nextData parsing error:', e);
        }
    }

    console.log(`[Gemini] 데이터 길이 - Text: ${text.length}, NextData: ${nextData?.length || 0}`);

    // 템플릿 리터럴 깨짐 방지를 위해 백틱 제거
    const safeText = text.replace(/`/g, "'").substring(0, 40000);
    const safeNextData = nextData ? nextData.replace(/`/g, "'").substring(0, 40000) : '';

    console.log('[Gemini] 확정서용 종합 분석 시작...');

    // 프롬프트를 문자열 연결 방식으로 구성 (템플릿 리터럴 파싱 오류 방지)
    let prompt = '당신은 여행 상품 웹페이지 전문 분석가입니다.\n';
    prompt += '아래 여행 상품 페이지의 전체 내용을 분석하여, 모바일 여행 확정서에 필요한 모든 정보를 빠짐없이 추출하세요.\n\n';
    prompt += 'URL: ' + url + '\n\n';

    if (preExtractedInclusions || preExtractedExclusions) {
        prompt += '--- [시스템 사전 추출 정보] ---\n';
        prompt += '포함사항 원문: ' + preExtractedInclusions + '\n';
        prompt += '불포함사항 원문: ' + preExtractedExclusions + '\n';
        prompt += '----------------------------------\n';
    }
    if (safeNextData) {
        prompt += '--- [NEXT_JS_DATA] ---\n' + safeNextData + '\n';
    }
    prompt += '--- [페이지 전체 내용] ---\n';
    prompt += safeText + '\n';
    prompt += '--- [끝] ---\n\n';

    prompt += '[중요 지침]\n';
    prompt += '1. 모든 일정(itinerary)의 activities는 본문을 꼼꼼히 읽고 상세히 기술하세요.\n';
    prompt += '2. 호텔 정보(name, address)를 반드시 찾아내세요. 본문에 없으면 절대 "미정" 대신 [NEXT_JS_DATA] 데이터를 최우선으로 사용하세요.\n';
    prompt += '3. 비행기 편명과 시간을 반드시 찾아내세요. 시간은 "09:00" 처럼 HH:MM 형식으로 적으세요.\n';
    prompt += '4. 귀국날짜(returnDate)를 정확히 계산하여 YYYY-MM-DD 형식으로 적으세요.\n';
    prompt += '5. JSON 이외의 텍스트는 출력하지 마세요. 답변에는 "연도-월-일"과 같은 가이드 문구를 넣지 말고 실제 데이터만 넣으세요.\n\n';
    prompt += '{\n';
    prompt += '  "title": "상품명 전체",\n';
    prompt += '  "destination": "목적지 (국가+도시)",\n';
    prompt += '  "price": "1인 기준 가격 (숫자만)",\n';
    prompt += '  "departureDate": "출발일 (YYYY-MM-DD 또는 원본 텍스트)",\n';
    prompt += '  "returnDate": "귀국일 (YYYY-MM-DD 또는 원본 텍스트)",\n';
    prompt += '  "duration": "여행기간 (예: 3박5일)",\n';
    prompt += '  "airline": "항공사명",\n';
    prompt += '  "flightCode": "편명 (예: 7C201)",\n';
    prompt += '  "departureAirport": "출발공항",\n';
    prompt += '  "departureTime": "가는편 출발 시각 (HH:MM) - 본문에서 반드시 찾아주세요",\n';
    prompt += '  "arrivalTime": "가는편 도착 시각 (HH:MM)",\n';
    prompt += '  "returnDepartureTime": "오는편 출발 시각 (HH:MM)",\n';
    prompt += '  "returnArrivalTime": "오는편 도착 시각 (HH:MM)",\n';
    prompt += '  "hotel": {\n';
    prompt += '    "name": "대표 호텔명 (한글 명칭)",\n';
    prompt += '    "englishName": "호텔 영문명",\n';
    prompt += '    "address": "호텔 상세 주소",\n';
    prompt += '    "checkIn": "체크인 시간 (예: 14:00)",\n';
    prompt += '    "checkOut": "체크아웃 시간 (예: 12:00)",\n';
    prompt += '    "images": ["호텔 이미지 URL 배열"],\n';
    prompt += '    "amenities": ["시설 및 서비스 목록"]\n';
    prompt += '  },\n';
    prompt += '  "itinerary": [\n';
    prompt += '    {\n';
    prompt += '      "day": "1일차",\n';
    prompt += '      "date": "날짜",\n';
    prompt += '      "title": "일정 제목 (예: 인천 출발 - 다낭 도착)",\n';
    prompt += '      "activities": ["해당 일자의 핵심 활동 내용 3-5개 요약"],\n';
    prompt += '      "transportation": "비행기 편명, 출발시간, 도착시간, 소요시간 (예: TW041 21:25 출발 -> 00:40 도착 (5시간 15분 소요))",\n';
    prompt += '      "hotelDetails": {\n';
    prompt += '        "name": "해당일 숙박 호텔 한글명",\n';
    prompt += '        "address": "호텔 상세 주소",\n';
    prompt += '        "images": ["호텔 이미지 URL 배열"],\n';
    prompt += '        "amenities": ["시설 목록"],\n';
    prompt += '        "checkIn": "체크인 시간",\n';
    prompt += '        "checkOut": "체크아웃 시간"\n';
    prompt += '      },\n';
    prompt += '      "meals": {\n';
    prompt += '        "breakfast": "포함 또는 불포함 또는 기내식",\n';
    prompt += '        "lunch": "포함 또는 불포함 또는 메뉴명",\n';
    prompt += '        "dinner": "포함 또는 불포함 또는 메뉴명"\n';
    prompt += '      },\n';
    prompt += '      "hotel": "해당일 숙박 호텔 한글명",\n';
    prompt += '      "dailyNotices": ["해당 일자의 특별 유의사항"]\n';
    prompt += '    }\n';
    prompt += '  ],\n';
    prompt += '  "inclusions": ["포함사항 전체 목록"],\n';
    prompt += '  "exclusions": ["불포함사항 전체 목록"],\n';
    prompt += '    "keyPoints": ["상품 포인트 요약 (\'~입니다\', \'~합니다\' 등의 서술어 절대 금지. 반드시 명사형으로 끝나는 짧은 개조식 구문 작성. 예: \'특급호텔에서 전일정 숙박\', \'노쇼핑 일정으로 편안한 여행\')"],\n';
    prompt += '  "specialOffers": ["특전/혜택"],\n';
    prompt += '  "features": ["상품 특징"],\n';
    prompt += '  "courses": ["주요 관광 코스"],\n';
    prompt += '  "notices": ["전체 유의사항"],\n';
    prompt += '  "cancellationPolicy": "취소/환불 규정",\n';
    prompt += '  "checklist": ["준비물 목록"]\n';
    prompt += '}\n\n';
    prompt += '중요 지침:\n';
    prompt += '1. 이모지 사용 절대 금지: 모든 텍스트에서 이모지를 절대 사용하지 마세요. 깔끔한 텍스트만 사용합니다.\n';
    prompt += '2. 일정표 최우선 상세화 (중요): 각 일차별(1일차, 2일차...) 상세 일정을 반드시 찾아내세요. activities는 단순히 한 줄 요약이 아니라, 방문지, 식사 장소, 이동 수단 등을 포함하여 꼼꼼하게 3-5문장으로 구체적으로 작성해야 합니다. 텍스트가 일부 깨져 있더라도 문맥을 통해 "일차", "일정", "식사" 등의 키워드를 중심으로 정보를 복원하세요.\n';
    prompt += '3. 항공 정보 필수상 추출: 본문에서 "항공사", "편명", "출발시간", "도착시간"을 반드시 찾아내세요. 시간은 반드시 HH:MM 형식(예: 09:15, 23:40)으로 추출해야 합니다. 본문 어딘가에 숫자로 된 시각 정보가 반드시 있으니 절대 놓치지 마세요.\n';
    prompt += '4. 교통 정보 상세화: transportation 필드에 편명, 출발/도착 시각, 총 소요 시간을 예시 형식에 맞춰 정확히 기입하세요.\n';
    prompt += '5. 호텔 정보: 호텔 이름은 가능한 한글 정식 명칭을 사용하세요. 숙박이 없는 기내박 등의 경우 "기내박" 또는 "없음"으로 명시하세요.\n';
    prompt += '6. JSON만 반환하세요. 다른 설명 텍스트는 제외하세요.';

    const tryModel = async (mName: string) => {
        console.log(`[Gemini-Confirm] Trying model: ${mName}`);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
            })
        });
        const data = await response.json();
        if (data.error) {
            console.warn(`[Gemini-Confirm] Model ${mName} error: ${data.error.message}`);
            return { error: data.error };
        }
        return data;
    };

    try {
        let data = await tryModel('gemini-1.5-pro');
        if (data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
            data = await tryModel('gemini-1.5-flash');
        }
        if (data.error?.code === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
            data = await tryModel('gemini-2.0-flash');
        }

        if (data.error) {
            console.error('[Gemini] All models failed:', data.error.message);
            return null;
        }

        if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            console.error('[Gemini] No candidates in response');
            return null;
        }

        const resText = data.candidates[0].content.parts[0].text;
        const jsonStr = resText.replace(/```json\s*|\s*```/g, '').trim();
        try {
            const parsed = JSON.parse(jsonStr);
            // HTML entity cleaning for inclusions/exclusions
            const cleanEnt = (s: any) => typeof s === 'string' ? s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : s;
            if (Array.isArray(parsed.inclusions)) parsed.inclusions = parsed.inclusions.map(cleanEnt);
            if (Array.isArray(parsed.exclusions)) parsed.exclusions = parsed.exclusions.map(cleanEnt);

            console.log('[Gemini] 확정서 분석 완료');
            return parsed;
        } catch (parseErr) {
            console.error('[Gemini] JSON 파싱 실패');
            return null;
        }
    } catch (e: any) {
        console.error('[Gemini] 확정서 분석 오류:', e.message);
        return null;
    }
}


export const scrapeWithScrapingBee = async (url: string): Promise<string | null> => {
    const rawKey = process.env.SCRAPINGBEE_API_KEY;
    if (!rawKey) return null;
    const apiKey = rawKey.trim();
    if (!apiKey) return null;

    let ssrNextData: string | undefined;
    let ssrHtml: string | undefined;

    // [전략 1-보조] SSR에서 __NEXT_DATA__ 추출 (출발일/상품명 확보용, 빠름)
    try {
        console.log('[ScrapingBee] SSR에서 __NEXT_DATA__ 보조 추출 시도');
        const ssrUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=10000`;
        const response = await fetch(ssrUrl);
        if (response.ok) {
            const html = await response.text();
            if (html.length > 1000 && html.includes('<') && !html.startsWith('{')) {
                ssrHtml = html;
                const ndStart = html.indexOf('<script id="__NEXT_DATA__"');
                if (ndStart !== -1) {
                    const jsonStart = html.indexOf('>', ndStart) + 1;
                    const jsonEnd = html.indexOf('</script>', jsonStart);
                    if (jsonStart > 0 && jsonEnd !== -1) {
                        ssrNextData = html.substring(jsonStart, jsonEnd);
                        console.log(`[ScrapingBee] SSR __NEXT_DATA__ 확보: ${ssrNextData.length}자`);
                    }
                }
            }
        }
    } catch (e: any) {
        console.warn('[ScrapingBee] SSR 보조 추출 실패 (무시):', e.message);
    }

    // [전략 2-메인] JS 렌더링 (빠름 - domcontentloaded)
    try {
        console.log('[ScrapingBee] JS 렌더링 시도 (최적화 모드)');
        const jsScenario = {
            instructions: [
                { scroll_y: 2000 },
                { wait: 1500 },
                { scroll_y: 5000 },
                { wait: 1000 }
            ]
        };

        const scenarioStr = JSON.stringify(jsScenario);
        const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait=6000&js_scenario=${encodeURIComponent(scenarioStr)}`;

        const response = await fetch(scrapingBeeUrl);
        if (response.ok) {
            const html = await response.text();
            if (html.length > 1000 && html.includes('<') && !html.startsWith('{')) {
                console.log(`[ScrapingBee] JS 렌더링 성공: ${html.length}자`);

                let enrichedHtml = html;
                if (ssrNextData && !html.includes('__NEXT_DATA__')) {
                    enrichedHtml = html.replace('</body>', `<script id="__NEXT_DATA__" type="application/json">${ssrNextData}</script></body>`);
                }

                return htmlToText(enrichedHtml, url);
            }
        }
    } catch (e: any) {
        console.warn('[ScrapingBee] JS 렌더링 실패:', e.message);
    }

    // [전략 3-폴백] SSR HTML 사용 (JS 렌더링 실패 시)
    if (ssrHtml) {
        console.log('[ScrapingBee] JS 실패 → SSR HTML 원본으로 폴백');
        return htmlToText(ssrHtml, url);
    } else if (ssrNextData) {
        console.log('[ScrapingBee] JS 실패 → SSR __NEXT_DATA__로 폴백');
        const minimalHtml = `<html><body><script id="__NEXT_DATA__" type="application/json">${ssrNextData}</script></body></html>`;
        return htmlToText(minimalHtml, url);
    }

    console.error('[ScrapingBee] 모든 전략 실패');
    return null;
}



/**
 * 확정서 전용 크롤러 — 전체 페이지 데이터를 종합 분석
 * 확정서는 정확도와 모든 세부 정보(포함/불포함/일정표) 추출이 필수이므로, 
 * 다소 지연되더라도 JS 렌더링이 보장되는 브라우저 크롤링을 사용합니다.
 */
export async function crawlForConfirmation(url: string): Promise<any> {
    console.log(`[ConfirmCrawler] 분석 시작: ${url}`);

    // [Fast-Path] 모두투어 전용 네이티브 API 연동 (딜레이 없음, 정확도 최고)
    if (url.includes('modetour.com')) {
        console.log('[ConfirmCrawler] ModeTour URL 감지 -> 네이티브 API 우선 시도');
        const native = await fetchModeTourNative(url);
        if (native && native.itinerary && native.itinerary.length > 0) {
            console.log('[ConfirmCrawler] ModeTour Native Data 수집 성공 -> 분석 생략');
            return native;
        }
        console.log('[ConfirmCrawler] ModeTour Native API 결과가 불충분하여 일반 크롤링으로 폴백');
    }

    const isVercel = process.env.VERCEL === '1';
    let fullText: string | null = null;
    let nextData: string | undefined = undefined;

    // 1. 브라우저 크롤링 시도 (Vercel이 아닐 때만 - Puppeteer 호환성 문제)
    if (!isVercel) {
        try {
            console.log('[ConfirmCrawler] 로컬 환경: Browser 크롤링(Puppeteer) 시도');
            fullText = await scrapeWithBrowser(url);
        } catch (e) {
            console.log(`[ConfirmCrawler] 브라우저 크롤링 중 에러 발생 (무시하고 다음 단계 진행)`);
        }
    } else {
        console.log('[ConfirmCrawler] Vercel 환경: Browser 크롤링 건너뜀 (시간 절약)');
    }

    // 2. 브라우저 크롤링 실패 시 ScrapingBee 시도 (특히 Vercel 운영 환경에서 필수)
    if (!fullText && process.env.SCRAPINGBEE_API_KEY) {
        console.log(`[ConfirmCrawler] ScrapingBee로 전환...`);
        fullText = await scrapeWithScrapingBee(url);
    }

    // 3. 모든 고급 옵션 실패 시, fallback으로 기존 빠른 fetch 사용
    if (!fullText) {
        console.log(`[ConfirmCrawler] 모든 고급 크롤링이 실패하여 일반 fetch로 폴백`);
        const result = await fetchContent(url);
        fullText = result.text;
        nextData = result.nextData;
    } else {
        // 추출된 텍스트 정리
        fullText = fullText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    }

    const result = await analyzeForConfirmation(fullText, url, nextData);
    if (result) {
        result.url = url;
        return result;
    }
    // 최종 폴객: 일반 파싱
    console.log('[ConfirmCrawler] 확정서 전용 Gemini 분석 실패, 일반 파싱으로 폴백');
    return await crawlTravelProduct(url);
}

function fallbackParse(text: string): DetailedProductInfo {
    return { title: '상품명 추출 실패', destination: '', price: '가격 문의', departureDate: '', departureAirport: '', duration: '', airline: '', hotel: '', url: '', features: [], courses: [], specialOffers: [], inclusions: [], exclusions: [], itinerary: [], keyPoints: [], hashtags: '', hasNoOption: false, hasFreeSchedule: false };
}

export async function crawlTravelProduct(url: string, source?: string): Promise<DetailedProductInfo> {
    console.log(`[Crawler] 분석 시작: ${url}`);

    // [Fast-Path] 모두투어 전용 네이티브 API 연동 (딜레이 없음)
    // [Notice] 확정서 탭(confirmation)은 상세 정보가 필요하므로 Fast Path 제외
    if (url.includes('modetour.com') && source !== 'confirmation') {
        console.log('[Crawler] ModeTour URL 감지 -> 네이티브 API 우선 시도');
        const sbKey = process.env.SCRAPINGBEE_API_KEY || undefined;
        const native = await fetchModeTourNative(url, sbKey);
        if (native) {
            console.log('[Crawler] ModeTour Native Data 수집 성공 -> Gemini 요약 보강 시작');
            // 네이티브 정보를 바탕으로 rich text를 구성하여 Gemini에 전달하여 포인트 요약만 요청하거나 전체 재분석
            const richContext = `[NATIVE_DATA_START]\n${JSON.stringify(native)}\n[NATIVE_DATA_END]\n\n${native.description || ''}`;
            const aiResult = await analyzeWithGemini(richContext, url);
            if (aiResult) {
                // 네이티브 데이터를 AI가 개조식으로 요약한 결과를 최우선으로 사용
                const finalKeyPoints = (aiResult.keyPoints && aiResult.keyPoints.length > 0) ? aiResult.keyPoints : (native.keyPoints || []);
                return refineData({ ...native, keyPoints: finalKeyPoints }, richContext, url);
            }
            return refineData(native, `TARGET_TITLE: "${native.title}"\nTARGET_PRICE: "${native.price}"\nTARGET_DURATION: "${native.duration}"\nTARGET_AIRLINE: "${native.airline}"\nTARGET_DEPARTURE_AIRPORT: "${native.departureAirport}"\nTARGET_DEPARTURE_DATE: "${native.departureDate}"\n`, url);
        }
        console.log('[Crawler] ModeTour Native API 실패하여 일반 크롤링으로 폴백');
    }

    const isVercel = process.env.VERCEL === '1';

    let fullText: string | null = null;
    let nextData: string | undefined = undefined;

    // 1. 브라우저 크롤링 시도 (Vercel이 아닐 때만 - Puppeteer 호환성 문제)
    if (!isVercel) {
        try {
            console.log('[Crawler] 로컬 환경: Browser 크롤링(Puppeteer) 시도');
            fullText = await scrapeWithBrowser(url);
        } catch (e) {
            console.log(`[Crawler] 브라우저 크롤링 중 에러 발생 (무시하고 다음 단계 진행)`);
        }
    } else {
        console.log('[Crawler] Vercel 환경: Browser 크롤링 건너뜀 (시간 절약)');
    }

    // 2. 브라우저 크롤링 실패 시 ScrapingBee 시도 (특히 Vercel 운영 환경에서 필수)
    if (!fullText && process.env.SCRAPINGBEE_API_KEY) {
        console.log(`[Crawler] ScrapingBee로 전환...`);
        fullText = await scrapeWithScrapingBee(url);
    }

    // 3. 모든 고급 옵션 실패 시, fallback으로 기존 빠른 fetch 사용
    const contentResult = await fetchContent(url);
    if (contentResult.nativeData) {
        console.log('[Crawler] ModeTour Native Data 발견 - 최우선 적용');
        return refineData(contentResult.nativeData, contentResult.text, url, contentResult.nextData);
    }

    if (!fullText) {
        console.log(`[Crawler] 모든 고급 크롤링이 실패하여 일반 fetch로 폴백`);
        fullText = contentResult.text;
        nextData = contentResult.nextData;
    } else {
        // 추출된 텍스트 정리
        fullText = fullText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    }

    console.log(`[Crawler] AI 분석 시작... (데이터 길이: ${fullText.length})`);
    const aiResult = await analyzeWithGemini(fullText, url, nextData);

    if (aiResult) {
        console.log(`[Crawler] AI 분석 결과 수신 성공: ${aiResult.title}`);
        if (aiResult.isProduct) {
            return refineData(aiResult, fullText, url, nextData);
        }
    } else {
        console.error('[Crawler] AI 분석 결과가 null입니다.');
    }
    return refineData(fallbackParse(fullText), fullText, url, nextData);
}

function formatDateString(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '미정') return dateStr;
    const cleanDate = dateStr.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return cleanDate;
    
    // YYYYMMDD 또는 YYMMDD 형식 처리
    if (/^\d{8}$/.test(cleanDate)) {
        return `${cleanDate.substring(0, 4)}-${cleanDate.substring(4, 6)}-${cleanDate.substring(6, 8)}`;
    }
    if (/^\d{6}$/.test(cleanDate)) {
        return `20${cleanDate.substring(0, 2)}-${cleanDate.substring(2, 4)}-${cleanDate.substring(4, 6)}`;
    }

    const match = cleanDate.match(/(\d{2,4})[-\.\/년]\s*(\d{1,2})[-\.\/월]\s*(\d{1,2})/);
    if (match) {
        let year = match[1];
        if (year.length === 2) year = `20${year}`;
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    return dateStr;
}

function formatDurationString(durationStr: string): string {
    if (!durationStr || durationStr.trim() === '미정' || durationStr === '""') return '미정';
    let str = durationStr.trim().replace(/"/g, '');

    // 이미 X박Y일 형태면 유지
    if (/^\d+박\d+일$/.test(str)) return str;

    const boxDayMatch = str.match(/(\d+)\s*박\s*(\d+)\s*일?/);
    if (boxDayMatch) return `${boxDayMatch[1]}박${boxDayMatch[2]}일`;

    const onlyDayMatch = str.match(/(\d+)\s*일$/);
    if (onlyDayMatch) {
        const days = parseInt(onlyDayMatch[1], 10);
        if (days > 1) return `${days - 1}박${days}일`;
        if (days === 1) return `당일`;
    }

    const onlyBoxMatch = str.match(/^(\d+)\s*박$/);
    if (onlyBoxMatch) {
        const nights = parseInt(onlyBoxMatch[1], 10);
        return `${nights}박${nights + 1}일`;
    }
    return str.replace(/\s+/g, '');
}

export function refineData(info: DetailedProductInfo, originalText: string, url: string, nextData?: string): DetailedProductInfo {
    const refined = { ...info };

    // 메타데이터 값에서 따옴표 제거 헬퍼
    const stripQuotes = (s: string) => s.replace(/^"|"$/g, '').trim();

    // [강력 보완] Title 보정
    if (!refined.title || refined.title.length < 5 || refined.title.includes('undefined') || refined.title.includes('상품상세')) {
        const titleMatch = originalText.match(/TARGET_TITLE:\s*"?([^"\n]*)"?/);
        if (titleMatch && stripQuotes(titleMatch[1]) && stripQuotes(titleMatch[1]) !== 'undefined') {
            refined.title = stripQuotes(titleMatch[1]);
        } else {
            const ogMatch = originalText.match(/OG_TITLE:\s*"?([^"\n]*)"?/);
            if (ogMatch && stripQuotes(ogMatch[1]) && stripQuotes(ogMatch[1]) !== 'undefined') refined.title = stripQuotes(ogMatch[1]);
            else {
                const classMatch = originalText.match(/CLASS_TITLE:\s*"?([^"\n]*)"?/);
                if (classMatch && stripQuotes(classMatch[1])) refined.title = stripQuotes(classMatch[1]);
            }
        }
    }

    // [강력 보완] Price 보정
    let rawPrice = String(refined.price || '');
    const metadataPrice = originalText.match(/TARGET_PRICE:\s*"?([^"\n]*)"?/);
    if (metadataPrice) {
        const mPrice = stripQuotes(metadataPrice[1]).replace(/[^0-9]/g, '');
        if (mPrice && mPrice !== '0') {
            // 만약 AI가 가격을 못 가져왔거나, 메타데이터 가격이 더 크다면 메타데이터 신뢰
            const currentPriceNum = parseInt(rawPrice.replace(/[^0-9]/g, '') || '0', 10);
            if (!rawPrice || rawPrice === '0' || parseInt(mPrice, 10) > currentPriceNum) {
                rawPrice = mPrice;
            }
        }
    }

    // [강력 보완] 항공사 보정
    if (!refined.airline || refined.airline.length < 2) {
        const metadataAirline = originalText.match(/TARGET_AIRLINE:\s*"?([^"\n]*)"?/);
        if (metadataAirline && stripQuotes(metadataAirline[1]).length >= 2) {
            refined.airline = stripQuotes(metadataAirline[1]);
        }
    }

    // [강력 보완] 출발공항 보정
    if (!refined.departureAirport || refined.departureAirport === '인천') {
        const metadataAirport = originalText.match(/TARGET_DEPARTURE_AIRPORT:\s*"?([^"\n]*)"?/);
        if (metadataAirport && stripQuotes(metadataAirport[1]) && stripQuotes(metadataAirport[1]) !== 'undefined') {
            refined.departureAirport = stripQuotes(metadataAirport[1]);
        }
    }

    // 숫자 부분만 추출하여 콤마 포맷팅 (Price)
    const digits = rawPrice.replace(/[^0-9]/g, '');
    if (digits && parseInt(digits, 10) > 1000) {
        refined.price = parseInt(digits, 10).toLocaleString() + '원';
    } else if (digits === '0') {
        refined.price = '0원';
    }

    // 항공사 보정
    let airline = refined.airline || '';
    const airlineCode = airline.substring(0, 2).toUpperCase();
    if (AIRLINE_MAP[airlineCode]) airline = AIRLINE_MAP[airlineCode];
    refined.airline = airline;

    // 카테고리/기간 절대 보정: AI 텍스트 예측보다 원본 메타데이터/JSON 추출값을 무조건 1순위로 신뢰
    const durationMatch = originalText.match(/TARGET_DURATION:\s*"?([^"\n]*)"?/);
    let rawDuration = (durationMatch && stripQuotes(durationMatch[1]) && stripQuotes(durationMatch[1]) !== 'undefined')
        ? stripQuotes(durationMatch[1])
        : String(refined.duration || '');

    // 포맷팅 적용
    refined.departureDate = formatDateString(refined.departureDate || '');
    refined.duration = formatDurationString(rawDuration);

    console.log(`[Crawler Refine] AI Duration: ${refined.duration} -> Final Duration: ${rawDuration} -> Formatted: ${formatDurationString(rawDuration)}`);

    return {
        ...refined,
        url,
        features: refined.features || [],
        courses: refined.courses || [],
        specialOffers: refined.specialOffers || [],
        inclusions: refined.inclusions || [],
        exclusions: refined.exclusions || [],
        itinerary: refined.itinerary || [],
        keyPoints: (refined.keyPoints || []).slice(0, 4).map((p: string) => {
            let cleaned = p.replace(/((웹문서|다\.|입니다|합니다|해요|요|제공|포함|가능)[.\s]*)+$/gi, '').trim();
            return cleaned.substring(0, 50);
        }),
        hashtags: refined.hashtags || '',
        hasNoOption: (refined.features || []).includes('노옵션'),
        hasFreeSchedule: (refined.features || []).includes('자유일정포함'),
    };
}

const AIRLINE_MAP: Record<string, string> = {
    '7C': '제주항공', 'KE': '대한항공', 'OZ': '아시아나', 'LJ': '진에어',
    'TW': '티웨이', 'ZE': '이스타', 'RS': '에어서울', 'BX': '에어부산',
    'VN': '베트남항공', 'VJ': '비엣젯', 'PR': '필리핀항공', '5J': '세부퍼시픽'
};

export function formatProductInfo(info: DetailedProductInfo, index?: number): string {
    let r = index !== undefined ? `${index + 1}. ${info.title}\n\n` : `${info.title}\n\n`;
    
    // 가격 콤마 포맷팅 보완
    const rawPrice = String(info.price || '').replace(/[^0-9]/g, '');
    const priceWithComma = rawPrice ? parseInt(rawPrice, 10).toLocaleString() : '- ';

    r += `* 출발일 : ${formatDateString(info.departureDate || '-')}\n`;
    r += `* 출발공항 : ${info.departureAirport || '인천'}\n`;
    r += `* 항공 : ${info.airline || '-'}\n`;
    r += `* 지역 : ${info.destination || '-'}\n`;
    r += `* 기간 : ${info.duration || '-'}\n`;
    r += `* 가격 : ${priceWithComma}원\n`;

    if (info.keyPoints && info.keyPoints.length > 0) {
        r += `\n[상품 포인트]\n`;
        info.keyPoints.forEach(point => {
            r += `- ${point}\n`;
        });
    }

    r += `\n[원문 일정표 열기](${info.url})\n\n`;
    r += `📌 예약 전 확인사항\n\n`;
    r += `상품가는 예약일/출발일에 따라 변동될 수 있습니다.\n`;
    r += `항공 좌석은 예약 시점에 다시 확인해야 합니다.`;
    return r;
}

export async function generateRecommendation(info: DetailedProductInfo): Promise<string> {
    const p = info.price || '문의';
    return `✨ **${info.destination} 여행, 추천드려요!**\n\n${p}에 즐기는 알찬 일정입니다.`;
}

export function compareProducts(products: DetailedProductInfo[]): string {
    if (!products || products.length < 2) {
        return "비교할 상품이 충분하지 않습니다.";
    }

    let comparison = "⚖️ 상품 비교 분석 결과\n\n";

    // 상세 상품별 분석
    products.forEach((p, i) => {
        const rawPrice = String(p.price || '').replace(/[^0-9]/g, '');
        const priceWithComma = rawPrice ? parseInt(rawPrice, 10).toLocaleString() : '정보 없음';

        comparison += `${i + 1}. ${p.title}\n\n`;
        comparison += `* 출발일 : ${formatDateString(p.departureDate || '미정')}\n`;
        comparison += `* 출발공항 : ${p.departureAirport || '인천'}\n`;
        comparison += `* 항공 : ${p.airline || '-'}\n`;
        comparison += `* 지역 : ${p.destination || '-'}\n`;
        comparison += `* 기간 : ${p.duration || '-'}\n`;
        comparison += `* 가격 : ${priceWithComma}${rawPrice ? '원' : ''}\n\n`;

        if (p.keyPoints && p.keyPoints.length > 0) {
            comparison += `[상품 포인트]\n`;
            p.keyPoints.slice(0, 10).forEach(point => {
                comparison += `- ${point}\n`;
            });
            comparison += `\n`;
        }

        comparison += `[원문 일정표 열기](${p.url})\n\n`;

        if (i < products.length - 1) {
            comparison += `------------------------------------------\n\n`;
        }
    });

    comparison += `📌 예약 전 확인사항\n\n`;
    comparison += `상품가는 예약일/출발일에 따라 변동될 수 있습니다.\n`;
    comparison += `항공 좌석은 예약 시점에 다시 확인해야 합니다.`;

    return comparison;
}

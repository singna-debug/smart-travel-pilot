
import * as iconv from 'iconv-lite';
import type { DetailedProductInfo } from '../types';

/**
 * URL ?щ·留?諛??곹뭹 ?뺣낫 ?뚯떛 (?쒕쾭 ?ъ씠???꾩슜)
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
        const timeout = setTimeout(() => controller.abort(), 10000); // 10珥???꾩븘??
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
        const decoder = new TextDecoder('utf-8');
        let text = decoder.decode(buffer);

        console.log(`[QuickFetch] Url: ${url}, Status: ${response.status}, Length: ${text.length}`);

        // EUC-KR 媛먯? 諛??ъ씤肄붾뵫
        if (text.includes('charset=euc-kr') || text.includes('charset=EUC-KR')) {
            text = iconv.decode(Buffer.from(buffer), 'euc-kr');
        }

        // 媛꾨떒????댄? 異붿텧
        let title = '';
        const titleMatch = text.match(/<title[^>]*>(.*?)<\/title>/i);
        if (titleMatch) title = titleMatch[1].trim();

        return { html: text, title };

    } catch (error) {
        if (retries > 0) {
            console.log(`[QuickFetch] ?ъ떆??(${retries}???⑥쓬): ${url}`);
            await sleep(1000);
            return quickFetch(url, retries - 1);
        }
        throw error;
    }
}

export async function fetchContent(url: string): Promise<{ text: string, nextData?: string }> {
    try {
        console.log(`[Crawler] Fetching: ${url}`);

        // 1. 鍮좊Ⅸ fetch ?쒕룄
        const { html } = await quickFetch(url);

        // 2. HTML???띿뒪?몃줈 蹂??(硫뷀??곗씠???ы븿)
        const text = htmlToText(html, url);

        // HTML ?먮낯?먯꽌 __NEXT_DATA__ 異붿텧 (?대? htmlToText?먯꽌 ?쇱쓣 ?섎룄 ?덉?留?紐낆떆?곸쑝濡?異붿텧)
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
    // 硫뷀??곗씠??異붿텧
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
    // productPrice_Adult_TotalAmount, productPrice_Adult, SalePrice, GoodsPrice ???ㅼ뼇???????    const jsonPriceMatch = html.match(/["'](?:Price|SalePrice|goodsPrice|GoodsPrice|ProductPrice_Adult|Price_Adult|productPrice_Adult_TotalAmount|price_adult)["']\s*[:=]\s*["']?(\d+)["']?/i);
    if (jsonPriceMatch) targetPrice = jsonPriceMatch[1];

    // [異붽?] ?띿뒪????媛寃??⑦꽩 (?? 1,290,000?? - JSON ?ㅽ뙣 ???鍮?    if (!targetPrice) {
        const textPriceMatch = html.match(/[\s>]([0-9]{1,3}(?:,[0-9]{3})+)??);
        if (textPriceMatch) targetPrice = textPriceMatch[1].replace(/,/g, '');
    }

    let targetDuration = '';
    const durationMatch = html.match(/(\d+)\s*諛?s*(\d+)\s*??);
    if (durationMatch) {
        targetDuration = `${durationMatch[1]}諛?{durationMatch[2]}??;
    } else {
        // [蹂댁셿] "X?? ?⑦꽩留??덈뒗 寃쎌슦 (3??-> 2諛???異붿젙)
        const onlyDayMatch = html.match(/[\s>]([1-9])\s*??\s<]/);
        if (onlyDayMatch) {
            const days = parseInt(onlyDayMatch[1], 10);
            targetDuration = `${days - 1}諛?{days}??;
        }
    }

    let targetAirline = '';
    let targetDepartureAirport = '';

    // [媛뺣젰 蹂댁셿] NEXT_DATA (ModeTour ??SPA ?꾨젅?꾩썙???뚮뜑留??곗씠?? 吏곸젒 ?뚯떛
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

                // ?숈쟻 ?ш? ?먯깋 (API ?묐떟援ъ“媛 釉뚮씪?곗?/?쒕쾭???곕씪 ?щ씪吏??寃껋뿉 ???
                function extractVal(obj: any, key: string, targetId?: string): any {
                    if (!obj || typeof obj !== 'object') return null;

                    // 1. 留뚯빟 ?뱀젙 ID瑜?李얜뒗 以묒씠?쇰㈃, ?대떦 ?몃뱶媛 洹?ID瑜?吏곸젒 媛議뚮뒗吏 ?뺤씤
                    const currentId = obj.productNo || obj.goodsNo || obj.prd_nm_no || obj.itemNo || obj.goods_no || obj.pnum || obj.Pnum || obj.groupNumber;

                    // 留뚯빟 ??媛앹껜媛 ?ㅻⅨ ?곹뭹???뺣낫瑜??닿퀬 ?덈떎硫?嫄대꼫? (留ㅼ묶 ?꾪꽣留?
                    if (targetId && currentId && String(currentId) !== targetId) return null;

                    // ?꾩옱 媛앹껜?먯꽌 ?ㅻ? 李얠쓬
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
                }

                // [媛뺣젰 蹂댁셿] ID 湲곕컲 異붿텧 ?쒕룄 ???ㅽ뙣 ??ID ?놁씠 ?꾩뿭 ?쒕룄 (諛깆뾽)
                function extractValRobust(obj: any, key: string, targetId?: string): any {
                    let res = extractVal(obj, key, targetId);
                    if (!res && targetId) {
                        // ID 留ㅼ묶 ?놁씠 ?꾩껜 ?몃━?먯꽌 泥?踰덉㎏濡?諛쒓껄?섎뒗 ?좏슚媛?異붿텧
                        res = extractVal(obj, key);
                    }
                    return res;
                }

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

                const nextTitle = extractValRobust(nextDataObj, 'goodsName', targetProductNo)
                    || extractValRobust(nextDataObj, 'productName', targetProductNo)
                    || extractValRobust(nextDataObj, 'title', targetProductNo);
                if (nextTitle) targetTitle = String(nextTitle);

            } catch (e) {
                console.error('[Crawler] __NEXT_DATA__ ?뚯떛 ?ㅻ쪟:', e);
            }
        }
    }

    // [異붽?] ?뺣? 異붿텧 ?ㅽ뙣 ??理쒗썑???섎떒: HTML ?꾩껜?먯꽌 ?뺢퇋?앹쑝濡?吏곸젒 李얘린 (JSON 援ъ“媛 源⑥쭊 寃쎌슦 ?鍮?
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

    // PAGE_TITLE 蹂닿컯
    let finalTitle = pageTitle;
    if ((pageTitle.includes('紐⑤몢?ъ뼱') || pageTitle.includes('?곹뭹?곸꽭') || pageTitle.includes('undefined')) &&
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

    return `==== TARGET METADATA START ====
PAGE_TITLE: "${finalTitle}"
OG_TITLE: "${ogTitle}"
BODY_TITLE: "${bodyTitle}"
CLASS_TITLE: "${classTitle}"
TARGET_TITLE: "${targetTitle || finalTitle}"
TARGET_PRICE: "${targetPrice}"
TARGET_DURATION: "${targetDuration}"
TARGET_AIRLINE: "${targetAirline}"
TARGET_DEPARTURE_AIRPORT: "${targetDepartureAirport}"
==== TARGET METADATA END ====

[CONTENT BODY]
${cleanBody}`;
}

async function analyzeWithGemini(text: string, url: string, nextData?: string): Promise<DetailedProductInfo | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    try {
        const modelName = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';
        console.log(`[Gemini] AI 遺꾩꽍 ?쒖옉... (紐⑤뜽: ${modelName})`);
        const prompt = `?ㅼ쓬 ?ы뻾 ?곹뭹 ?섏씠吏?먯꽌 ?뺣낫瑜?異붿텧?섏뿬 JSON?쇰줈 諛섑솚?섏꽭??
URL: ${url}
${nextData ? `--- [以묒슂: NEXT_JS_DATA (JSON ?곗씠??李몄“??] ---\n${nextData.substring(0, 15000)}\n` : ''}

諛섑솚 ?뺤떇:
{
  "isProduct": true,
  "title": "METADATA ?뱀뀡??TARGET_TITLE ?먮뒗 PAGE_TITLE 以???援ъ껜?곸씤 寃껋쓣 洹몃?濡?異붿텧 (?곹뭹紐??꾩껜)",
  "destination": "紐⑹쟻吏 (援??+?꾩떆)",
  "price": "METADATA ?뱀뀡??TARGET_PRICE 媛믪쓣 理쒖슦?좎쟻?쇰줈 ?ъ슜?섏꽭??(?レ옄留?異붿텧). ?놁쑝硫??띿뒪?몄뿉???깆씤 1??媛寃⑹쓣 李얠쑝?몄슂.",
  "departureDate": "異쒕컻??(YYYY-MM-DD ?뺤떇 沅뚯옣)",
  "airline": "METADATA ?뱀뀡??TARGET_AIRLINE??理쒖슦?좎쑝濡??ъ슜?섏꽭?? ?놁쑝硫???났???곗썾?? ?쒖＜??났 ?? 異붿텧.",
  "duration": "METADATA ?뱀뀡??TARGET_DURATION 媛믪쓣 理쒖슦?좎쑝濡??ъ슜?섏꽭?? ?놁쑝硫?'X諛?Y?? ?⑦꽩??李얠쑝?몄슂.",
  "departureAirport": "METADATA ?뱀뀡??TARGET_DEPARTURE_AIRPORT瑜?理쒖슦?좎쑝濡??ъ슜?섏꽭?? ?놁쑝硫??띿뒪?몄뿉??'?몄쿇', '遺??, '?援? ??異쒕컻吏 異붿텧.",
  "keyPoints": ["?곹뭹???듭떖 ?뱀쭠 5~7媛??붿빟"],
  "exclusions": ["遺덊룷???ы빆 ?붿빟"]
}

?낅젰 ?띿뒪??
${text.substring(0, 20000)}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } })
        });

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            console.error('[Gemini] ?묐떟 ?뺤떇???щ컮瑜댁? ?딄굅??寃곌낵媛 ?놁뒿?덈떎:', JSON.stringify(data));
            return null;
        }

        const resText = data.candidates[0].content.parts[0].text;
        const jsonStr = resText.replace(/```json\s*|\s*```/g, '').trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error(e);
        return null;
    }
}

/**
 * ?뺤젙???꾩슜 醫낇빀 遺꾩꽍 ???섏씠吏 ?꾩껜 ?댁슜?먯꽌 ?쇱젙/?앹궗/?명뀛/?ы븿?ы빆 ??紐⑤몢 異붿텧
 */
export async function analyzeForConfirmation(text: string, url: string, nextData?: string): Promise<any | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    let preExtractedInclusions = '';
    let preExtractedExclusions = '';

    // Next_DATA?먯꽌 ?ы븿/遺덊룷??吏곸젒 異붿텧 (湲?먯닔 ?쒗븳?쇰줈 ?섎━??臾몄젣 諛⑹?)
    if (nextData) {
        console.log('[Debug] nextData length:', nextData.length);
        try {
            const dataObj = JSON.parse(nextData);
            console.log('[Debug] dataObj keys:', Object.keys(dataObj));
            function findValues(obj: any, keyMap: string[], results: string[] = []): string[] {
                if (!obj || typeof obj !== 'object') return results;
                for (const k in obj) {
                    if (keyMap.includes(k.toLowerCase()) && typeof obj[k] === 'string') {
                        console.log(`[Debug-Find] Found key ${k}, len: ${obj[k].length}`);
                        if (obj[k].length > 10) results.push(obj[k]);
                    }
                    findValues(obj[k], keyMap, results);
                }
                return results;
            }
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

    console.log(`[Gemini] ?곗씠??湲몄씠 - Text: ${text.length}, NextData: ${nextData?.length || 0}`);

    // ?쒗뵆由?由ы꽣??源⑥쭚 諛⑹?瑜??꾪빐 諛깊떛 ?쒓굅
    const safeText = text.replace(/`/g, "'").substring(0, 40000);
    const safeNextData = nextData ? nextData.replace(/`/g, "'").substring(0, 40000) : '';

    try {
        console.log('[Gemini] ?뺤젙?쒖슜 醫낇빀 遺꾩꽍 ?쒖옉...');

        // ?꾨＼?꾪듃瑜?臾몄옄???곌껐 諛⑹떇?쇰줈 援ъ꽦 (?쒗뵆由?由ы꽣???뚯떛 ?ㅻ쪟 諛⑹?)
        let prompt = '?뱀떊? ?ы뻾 ?곹뭹 ?뱁럹?댁? ?꾨Ц 遺꾩꽍媛?낅땲??\n';
        prompt += '?꾨옒 ?ы뻾 ?곹뭹 ?섏씠吏???꾩껜 ?댁슜??遺꾩꽍?섏뿬, 紐⑤컮???ы뻾 ?뺤젙?쒖뿉 ?꾩슂??紐⑤뱺 ?뺣낫瑜?鍮좎쭚?놁씠 異붿텧?섏꽭??\n\n';
        prompt += 'URL: ' + url + '\n\n';

        if (preExtractedInclusions || preExtractedExclusions) {
            prompt += '--- [?쒖뒪???ъ쟾 異붿텧 ?뺣낫] ---\n';
            prompt += '?ы븿?ы빆 ?먮Ц: ' + preExtractedInclusions + '\n';
            prompt += '遺덊룷?⑥궗???먮Ц: ' + preExtractedExclusions + '\n';
            prompt += '----------------------------------\n';
        }
        if (safeNextData) {
            prompt += '--- [NEXT_JS_DATA] ---\n' + safeNextData + '\n';
        }
        prompt += '--- [?섏씠吏 ?꾩껜 ?댁슜] ---\n';
        prompt += safeText + '\n';
        prompt += '--- [?? ---\n\n';

        prompt += '?꾨옒 JSON ?뺤떇?쇰줈 諛섑솚?섏꽭?? ?섏씠吏???뺣낫媛 ?놁쑝硫?鍮?臾몄옄?댁씠??鍮?諛곗뿴濡??먯꽭??\n\n';
        prompt += '{\n';
        prompt += '  "title": "?곹뭹紐??꾩껜",\n';
        prompt += '  "destination": "紐⑹쟻吏 (援??+?꾩떆)",\n';
        prompt += '  "price": "1??湲곗? 媛寃?(?レ옄留?",\n';
        prompt += '  "departureDate": "異쒕컻??(YYYY-MM-DD ?먮뒗 ?먮낯 ?띿뒪??",\n';
        prompt += '  "returnDate": "洹援?씪 (YYYY-MM-DD ?먮뒗 ?먮낯 ?띿뒪??",\n';
        prompt += '  "duration": "?ы뻾湲곌컙 (?? 3諛???",\n';
        prompt += '  "airline": "??났?щ챸",\n';
        prompt += '  "flightCode": "?몃챸 (?? 7C201)",\n';
        prompt += '  "departureAirport": "異쒕컻怨듯빆",\n';
        prompt += '  "departureTime": "媛?뷀렪 異쒕컻 ?쒓컖 (HH:MM) - 蹂몃Ц?먯꽌 諛섎뱶??李얠븘二쇱꽭??,\n';
        prompt += '  "arrivalTime": "媛?뷀렪 ?꾩갑 ?쒓컖 (HH:MM)",\n';
        prompt += '  "returnDepartureTime": "?ㅻ뒗??異쒕컻 ?쒓컖 (HH:MM)",\n';
        prompt += '  "returnArrivalTime": "?ㅻ뒗???꾩갑 ?쒓컖 (HH:MM)",\n';
        prompt += '  "hotel": {\n';
        prompt += '    "name": "????명뀛紐?(?쒓? 紐낆묶)",\n';
        prompt += '    "englishName": "?명뀛 ?곷Ц紐?,\n';
        prompt += '    "address": "?명뀛 ?곸꽭 二쇱냼",\n';
        prompt += '    "checkIn": "泥댄겕???쒓컙 (?? 14:00)",\n';
        prompt += '    "checkOut": "泥댄겕?꾩썐 ?쒓컙 (?? 12:00)",\n';
        prompt += '    "images": ["?명뀛 ?대?吏 URL 諛곗뿴"],\n';
        prompt += '    "amenities": ["?쒖꽕 諛??쒕퉬??紐⑸줉"]\n';
        prompt += '  },\n';
        prompt += '  "itinerary": [\n';
        prompt += '    {\n';
        prompt += '      "day": "1?쇱감",\n';
        prompt += '      "date": "?좎쭨",\n';
        prompt += '      "title": "?쇱젙 ?쒕ぉ (?? ?몄쿇 異쒕컻 - ?ㅻ궘 ?꾩갑)",\n';
        prompt += '      "activities": ["?대떦 ?쇱옄???듭떖 ?쒕룞 ?댁슜 3-5媛??붿빟"],\n';
        prompt += '      "transportation": "鍮꾪뻾湲??몃챸, 異쒕컻?쒓컙, ?꾩갑?쒓컙, ?뚯슂?쒓컙 (?? TW041 21:25 異쒕컻 -> 00:40 ?꾩갑 (5?쒓컙 15遺??뚯슂))",\n';
        prompt += '      "hotelDetails": {\n';
        prompt += '        "name": "?대떦???숇컯 ?명뀛 ?쒓?紐?,\n';
        prompt += '        "address": "?명뀛 ?곸꽭 二쇱냼",\n';
        prompt += '        "images": ["?명뀛 ?대?吏 URL 諛곗뿴"],\n';
        prompt += '        "amenities": ["?쒖꽕 紐⑸줉"],\n';
        prompt += '        "checkIn": "泥댄겕???쒓컙",\n';
        prompt += '        "checkOut": "泥댄겕?꾩썐 ?쒓컙"\n';
        prompt += '      },\n';
        prompt += '      "meals": {\n';
        prompt += '        "breakfast": "?ы븿 ?먮뒗 遺덊룷???먮뒗 湲곕궡??,\n';
        prompt += '        "lunch": "?ы븿 ?먮뒗 遺덊룷???먮뒗 硫붾돱紐?,\n';
        prompt += '        "dinner": "?ы븿 ?먮뒗 遺덊룷???먮뒗 硫붾돱紐?\n';
        prompt += '      },\n';
        prompt += '      "hotel": "?대떦???숇컯 ?명뀛 ?쒓?紐?,\n';
        prompt += '      "dailyNotices": ["?대떦 ?쇱옄???밸퀎 ?좎쓽?ы빆"]\n';
        prompt += '    }\n';
        prompt += '  ],\n';
        prompt += '  "inclusions": ["?ы븿?ы빆 ?꾩껜 紐⑸줉"],\n';
        prompt += '  "exclusions": ["遺덊룷?⑥궗???꾩껜 紐⑸줉"],\n';
        prompt += '  "keyPoints": ["?곹뭹 ?듭떖 ?ъ씤??5~7媛?],\n';
        prompt += '  "specialOffers": ["?뱀쟾/?쒗깮"],\n';
        prompt += '  "features": ["?곹뭹 ?뱀쭠"],\n';
        prompt += '  "courses": ["二쇱슂 愿愿?肄붿뒪"],\n';
        prompt += '  "notices": ["?꾩껜 ?좎쓽?ы빆"],\n';
        prompt += '  "cancellationPolicy": "痍⑥냼/?섎텋 洹쒖젙",\n';
        prompt += '  "checklist": ["以鍮꾨Ъ 紐⑸줉"]\n';
        prompt += '}\n\n';
        prompt += '以묒슂 吏移?\n';
        prompt += '1. ?대え吏 ?ъ슜 ?덈? 湲덉?: 紐⑤뱺 ?띿뒪?몄뿉???대え吏瑜??덈? ?ъ슜?섏? 留덉꽭?? 源붾걫???띿뒪?몃쭔 ?ъ슜?⑸땲??\n';
        prompt += '2. ?쇱젙???곸꽭?? 媛??쇱감蹂?activities???섏씠吏 ?댁슜??瑗쇨세???쎄퀬 以묒슂??諛⑸Ц吏, 泥댄뿕 ?댁슜??3-5臾몄옣?쇰줈 ?붿빟?섏뿬 ?묒꽦?섏꽭?? ?뺣낫媛 ?꾩퐫?붿뼵(?쇱튂湲? 硫붾돱???곸꽭 ?쇱젙 ???덉뿉 ?⑥뼱?덉쓣 ???덉쑝???띿뒪???꾩껜瑜?瑗쇨세??遺꾩꽍?섏꽭??\n';
        prompt += '3. ??났 ?뺣낫 ?꾩닔??異붿텧: 蹂몃Ц?먯꽌 "??났??, "?몃챸", "異쒕컻?쒓컙", "?꾩갑?쒓컙"??諛섎뱶??李얠븘?댁꽭?? ?쒓컙? 諛섎뱶??HH:MM ?뺤떇(?? 09:15, 23:40)?쇰줈 異붿텧?댁빞 ?⑸땲?? 蹂몃Ц ?대뵖媛???レ옄濡????쒓컖 ?뺣낫媛 諛섎뱶???덉쑝???덈? ?볦튂吏 留덉꽭??\n';
        prompt += '4. 援먰넻 ?뺣낫 ?곸꽭?? transportation ?꾨뱶???몃챸, 異쒕컻/?꾩갑 ?쒓컖, 珥??뚯슂 ?쒓컙???덉떆 ?뺤떇??留욎떠 ?뺥솗??湲곗엯?섏꽭??\n';
        prompt += '5. ?명뀛 ?뺣낫: ?명뀛 ?대쫫? 媛?ν븳 ?쒓? ?뺤떇 紐낆묶???ъ슜?섏꽭??\n';
        prompt += '6. JSON留?諛섑솚?섏꽭?? ?ㅻⅨ ?ㅻ챸 ?띿뒪?몃뒗 ?쒖쇅?섏꽭??';

        const modelName = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8000 }
            })
        });

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]?.content?.parts[0]?.text) {
            console.error('[Gemini] ?묐떟 ?뺤떇???щ컮瑜댁? ?딆뒿?덈떎:', JSON.stringify(data));
            return null;
        }

        const resText = data.candidates[0].content.parts[0].text;
        console.log('[Gemini] raw response length:', resText.length);
        const jsonStr = resText.replace(/```json\s*|\s*```/g, '').trim();
        try {
            const parsed = JSON.parse(jsonStr);
            console.log('[Gemini] ?뺤젙??遺꾩꽍 ?꾨즺:', Object.keys(parsed));
            return parsed;
        } catch (parseErr) {
            console.error('[Gemini] JSON ?뚯떛 ?ㅽ뙣:', jsonStr.substring(0, 500));
            throw parseErr;
        }
    } catch (e: any) {
        console.error('[Gemini] ?뺤젙??遺꾩꽍 ?ㅻ쪟 ?곸꽭:', e.message || e);
        return null;
    }
}

async function scrapeWithScrapingBee(url: string): Promise<string | null> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    if (!apiKey) return null;

    try {
        // ?곹샇?묒슜 ?쒕굹由ъ삤 (?ㅽ겕濡?諛??곸꽭 蹂닿린 ?대┃)
        // ?댁쁺 ?섍꼍(Vercel) ??꾩븘?껋쓣 怨좊젮?섏뿬 ?湲??쒓컙??25珥??대궡濡?理쒖쟻??        const jsScenario = {
            instructions: [
                { scroll_to: "bottom" },
                { wait: 1500 },
                { evaluate: "document.querySelectorAll('button, a, div, span').forEach(el => { const txt = el.innerText || ''; if(['?곸꽭', '?꾩껜', '?쇱튂湲?, '?붾낫湲?].some(w => txt.includes(w))) { try { el.click(); } catch(e){} } })" },
                { wait: 1500 },
                { scroll_to: "bottom" }
            ]
        };

        const scenarioStr = JSON.stringify(jsScenario);
        const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=networkidle&timeout=20000&js_scenario=${encodeURIComponent(scenarioStr)}`;

        const response = await fetch(scrapingBeeUrl);
        if (!response.ok) {
            const errBody = await response.text();
            console.error(`[ScrapingBee] API ?ㅻ쪟 (${response.status}):`, errBody.substring(0, 300));
            throw new Error(`Status ${response.status}`);
        }

        const html = await response.text();
        console.log(`[ScrapingBee] ?꾨즺: ${html.length}??);

        return htmlToText(html, url);
    } catch (e) {
        console.error('[ScrapingBee] ?ㅻ쪟:', e);
        return null;
    }
}

import { scrapeWithBrowser } from '@/lib/browser-crawler';

/**
 * ?뺤젙???꾩슜 ?щ·?????꾩껜 ?섏씠吏 ?곗씠?곕? 醫낇빀 遺꾩꽍
 * ?뺤젙?쒕뒗 ?뺥솗?꾩? 紐⑤뱺 ?몃? ?뺣낫(?ы븿/遺덊룷???쇱젙?? 異붿텧???꾩닔?대?濡? 
 * ?ㅼ냼 吏?곕릺?붾씪??JS ?뚮뜑留곸씠 蹂댁옣?섎뒗 釉뚮씪?곗? ?щ·留곸쓣 ?ъ슜?⑸땲??
 */
export async function crawlForConfirmation(url: string): Promise<any> {
    console.log(`[ConfirmCrawler] 遺꾩꽍 ?쒖옉: ${url}`);
    const isVercel = process.env.VERCEL === '1';

    let fullText: string | null = null;
    let nextData: string | undefined = undefined;

    // 1. 釉뚮씪?곗? ?щ·留??쒕룄 (Vercel???꾨땺 ?뚮쭔 - Puppeteer ?명솚??臾몄젣)
    if (!isVercel) {
        try {
            console.log('[ConfirmCrawler] 濡쒖뺄 ?섍꼍: Browser ?щ·留?Puppeteer) ?쒕룄');
            fullText = await scrapeWithBrowser(url);
        } catch (e) {
            console.log(`[ConfirmCrawler] 釉뚮씪?곗? ?щ·留?以??먮윭 諛쒖깮 (臾댁떆?섍퀬 ?ㅼ쓬 ?④퀎 吏꾪뻾)`);
        }
    } else {
        console.log('[ConfirmCrawler] Vercel ?섍꼍: Browser ?щ·留?嫄대꼫? (?쒓컙 ?덉빟)');
    }

    // 2. 釉뚮씪?곗? ?щ·留??ㅽ뙣 ??ScrapingBee ?쒕룄 (?뱁엳 Vercel ?댁쁺 ?섍꼍?먯꽌 ?꾩닔)
    if (!fullText && process.env.SCRAPINGBEE_API_KEY) {
        console.log(`[ConfirmCrawler] ScrapingBee濡??꾪솚...`);
        fullText = await scrapeWithScrapingBee(url);
    }

    // 3. 紐⑤뱺 怨좉툒 ?듭뀡 ?ㅽ뙣 ?? fallback?쇰줈 湲곗〈 鍮좊Ⅸ fetch ?ъ슜
    if (!fullText) {
        console.log(`[ConfirmCrawler] 紐⑤뱺 怨좉툒 ?щ·留곸씠 ?ㅽ뙣?섏뿬 ?쇰컲 fetch濡??대갚`);
        const result = await fetchContent(url);
        fullText = result.text;
        nextData = result.nextData;
    } else {
        // 異붿텧???띿뒪???뺣━
        fullText = fullText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    }

    const result = await analyzeForConfirmation(fullText, url, nextData);
    if (result) {
        result.url = url;
        return result;
    }
    // 理쒖쥌 ?닿컼: ?쇰컲 ?뚯떛
    console.log('[ConfirmCrawler] ?뺤젙???꾩슜 Gemini 遺꾩꽍 ?ㅽ뙣, ?쇰컲 ?뚯떛?쇰줈 ?대갚');
    return await crawlTravelProduct(url);
}

function fallbackParse(text: string): DetailedProductInfo {
    return { title: '?곹뭹紐?異붿텧 ?ㅽ뙣', destination: '', price: '媛寃?臾몄쓽', departureDate: '', departureAirport: '', duration: '', airline: '', hotel: '', url: '', features: [], courses: [], specialOffers: [], inclusions: [], exclusions: [], itinerary: [], keyPoints: [], hashtags: '', hasNoOption: false, hasFreeSchedule: false };
}

export async function crawlTravelProduct(url: string): Promise<DetailedProductInfo> {
    console.log(`[Crawler] 遺꾩꽍 ?쒖옉: ${url}`);
    const isVercel = process.env.VERCEL === '1';

    let fullText: string | null = null;
    let nextData: string | undefined = undefined;

    // 1. 釉뚮씪?곗? ?щ·留??쒕룄 (Vercel???꾨땺 ?뚮쭔 - Puppeteer ?명솚??臾몄젣)
    if (!isVercel) {
        try {
            console.log('[Crawler] 濡쒖뺄 ?섍꼍: Browser ?щ·留?Puppeteer) ?쒕룄');
            fullText = await scrapeWithBrowser(url);
        } catch (e) {
            console.log(`[Crawler] 釉뚮씪?곗? ?щ·留?以??먮윭 諛쒖깮 (臾댁떆?섍퀬 ?ㅼ쓬 ?④퀎 吏꾪뻾)`);
        }
    } else {
        console.log('[Crawler] Vercel ?섍꼍: Browser ?щ·留?嫄대꼫? (?쒓컙 ?덉빟)');
    }

    // 2. 釉뚮씪?곗? ?щ·留??ㅽ뙣 ??ScrapingBee ?쒕룄 (?뱁엳 Vercel ?댁쁺 ?섍꼍?먯꽌 ?꾩닔)
    if (!fullText && process.env.SCRAPINGBEE_API_KEY) {
        console.log(`[Crawler] ScrapingBee濡??꾪솚...`);
        fullText = await scrapeWithScrapingBee(url);
    }

    // 3. 紐⑤뱺 怨좉툒 ?듭뀡 ?ㅽ뙣 ?? fallback?쇰줈 湲곗〈 鍮좊Ⅸ fetch ?ъ슜
    if (!fullText) {
        console.log(`[Crawler] 紐⑤뱺 怨좉툒 ?щ·留곸씠 ?ㅽ뙣?섏뿬 ?쇰컲 fetch濡??대갚`);
        const result = await fetchContent(url);
        fullText = result.text;
        nextData = result.nextData;
    } else {
        // 異붿텧???띿뒪???뺣━
        fullText = fullText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
    }

    console.log(`[Crawler] AI 遺꾩꽍 ?쒖옉... (?곗씠??湲몄씠: ${fullText.length})`);
    const aiResult = await analyzeWithGemini(fullText, url, nextData);

    if (aiResult) {
        console.log(`[Crawler] AI 遺꾩꽍 寃곌낵 ?섏떊 ?깃났: ${aiResult.title}`);
        if (aiResult.isProduct) {
            return refineData(aiResult, fullText, url, nextData);
        }
    } else {
        console.error('[Crawler] AI 遺꾩꽍 寃곌낵媛 null?낅땲??');
    }
    return refineData(fallbackParse(fullText), fullText, url, nextData);
}

function formatDateString(dateStr: string): string {
    if (!dateStr || dateStr.trim() === '誘몄젙') return dateStr;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr.trim();
    const match = dateStr.match(/(\d{2,4})[-\.\/??\s*(\d{1,2})[-\.\/??\s*(\d{1,2})/);
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
    if (!durationStr || durationStr.trim() === '誘몄젙' || durationStr === '""') return '誘몄젙';
    let str = durationStr.trim().replace(/"/g, '');

    // ?대? X諛뷯???뺥깭硫??좎?
    if (/^\d+諛?d+??/.test(str)) return str;

    const boxDayMatch = str.match(/(\d+)\s*諛?s*(\d+)\s*??/);
    if (boxDayMatch) return `${boxDayMatch[1]}諛?{boxDayMatch[2]}??;

    const onlyDayMatch = str.match(/(\d+)\s*??/);
    if (onlyDayMatch) {
        const days = parseInt(onlyDayMatch[1], 10);
        if (days > 1) return `${days - 1}諛?{days}??;
        if (days === 1) return `?뱀씪`;
    }

    const onlyBoxMatch = str.match(/^(\d+)\s*諛?/);
    if (onlyBoxMatch) {
        const nights = parseInt(onlyBoxMatch[1], 10);
        return `${nights}諛?{nights + 1}??;
    }
    return str.replace(/\s+/g, '');
}

function refineData(info: DetailedProductInfo, originalText: string, url: string, nextData?: string): DetailedProductInfo {
    const refined = { ...info };

    // 硫뷀??곗씠??媛믪뿉???곗샂???쒓굅 ?ы띁
    const stripQuotes = (s: string) => s.replace(/^"|"$/g, '').trim();

    // [媛뺣젰 蹂댁셿] Title 蹂댁젙
    if (!refined.title || refined.title.length < 5 || refined.title.includes('undefined') || refined.title.includes('?곹뭹?곸꽭')) {
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

    // [媛뺣젰 蹂댁셿] Price 蹂댁젙
    let rawPrice = String(refined.price || '');
    const metadataPrice = originalText.match(/TARGET_PRICE:\s*"?([^"\n]*)"?/);
    if (metadataPrice) {
        const mPrice = stripQuotes(metadataPrice[1]).replace(/[^0-9]/g, '');
        if (mPrice && mPrice !== '0') {
            // 留뚯빟 AI媛 媛寃⑹쓣 紐?媛?몄솕嫄곕굹, 硫뷀??곗씠??媛寃⑹씠 ???щ떎硫?硫뷀??곗씠???좊ː
            const currentPriceNum = parseInt(rawPrice.replace(/[^0-9]/g, '') || '0', 10);
            if (!rawPrice || rawPrice === '0' || parseInt(mPrice, 10) > currentPriceNum) {
                rawPrice = mPrice;
            }
        }
    }

    // [媛뺣젰 蹂댁셿] ??났??蹂댁젙
    if (!refined.airline || refined.airline.length < 2) {
        const metadataAirline = originalText.match(/TARGET_AIRLINE:\s*"?([^"\n]*)"?/);
        if (metadataAirline && stripQuotes(metadataAirline[1]).length >= 2) {
            refined.airline = stripQuotes(metadataAirline[1]);
        }
    }

    // [媛뺣젰 蹂댁셿] 異쒕컻怨듯빆 蹂댁젙
    if (!refined.departureAirport || refined.departureAirport === '?몄쿇') {
        const metadataAirport = originalText.match(/TARGET_DEPARTURE_AIRPORT:\s*"?([^"\n]*)"?/);
        if (metadataAirport && stripQuotes(metadataAirport[1]) && stripQuotes(metadataAirport[1]) !== 'undefined') {
            refined.departureAirport = stripQuotes(metadataAirport[1]);
        }
    }

    // ?レ옄 遺遺꾨쭔 異붿텧?섏뿬 肄ㅻ쭏 ?щ㎎??(Price)
    const digits = rawPrice.replace(/[^0-9]/g, '');
    if (digits && parseInt(digits, 10) > 1000) {
        refined.price = parseInt(digits, 10).toLocaleString() + '??;
    } else if (digits === '0') {
        refined.price = '0??;
    }

    // ??났??蹂댁젙
    let airline = refined.airline || '';
    const airlineCode = airline.substring(0, 2).toUpperCase();
    if (AIRLINE_MAP[airlineCode]) airline = AIRLINE_MAP[airlineCode];
    refined.airline = airline;

    // 移댄뀒怨좊━/湲곌컙 ?덈? 蹂댁젙: AI ?띿뒪???덉륫蹂대떎 ?먮낯 硫뷀??곗씠??JSON 異붿텧媛믪쓣 臾댁“嫄?1?쒖쐞濡??좊ː
    const durationMatch = originalText.match(/TARGET_DURATION:\s*"?([^"\n]*)"?/);
    let rawDuration = (durationMatch && stripQuotes(durationMatch[1]) && stripQuotes(durationMatch[1]) !== 'undefined')
        ? stripQuotes(durationMatch[1])
        : String(refined.duration || '');

    // ?щ㎎???곸슜
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
        keyPoints: refined.keyPoints || [],
        hashtags: refined.hashtags || '',
        hasNoOption: (refined.features || []).includes('?몄샃??),
        hasFreeSchedule: (refined.features || []).includes('?먯쑀?쇱젙?ы븿'),
    };
}

const AIRLINE_MAP: Record<string, string> = {
    '7C': '?쒖＜??났', 'KE': '??쒗빆怨?, 'OZ': '?꾩떆?꾨굹', 'LJ': '吏꾩뿉??,
    'TW': '?곗썾??, 'ZE': '?댁뒪?', 'RS': '?먯뼱?쒖슱', 'BX': '?먯뼱遺??,
    'VN': '踰좏듃?⑦빆怨?, 'VJ': '鍮꾩뿣??, 'PR': '?꾨━???났', '5J': '?몃??쇱떆??
};

export function formatProductInfo(info: DetailedProductInfo, index?: number): string {
    let p = String(info.price || '');
    // ?レ옄濡쒕쭔 ??寃쎌슦 '?? 遺숈엫 (refineData?먯꽌 ?대? 泥섎━?섏?留??덉쟾?μ튂)
    const digits = p.replace(/[^0-9]/g, '');
    if (digits && !p.includes(',')) {
        p = parseInt(digits, 10).toLocaleString() + '??;
    }

    let r = index !== undefined ? `${index + 1}. ${info.title}\n\n` : `${info.title}\n\n`;
    r += `* 媛寃?: ${p}\n`;
    r += `* 異쒕컻??: ${info.departureDate || '誘몄젙'}\n`;
    r += `* 異쒕컻怨듯빆 : ${info.departureAirport || '?몄쿇'}\n`;
    r += `* ??났 : ${info.airline || '-'}\n`;
    r += `* 吏??: ${info.destination || '-'}\n`;
    r += `* 湲곌컙 : ${info.duration || '-'}\n`;

    if (info.keyPoints && info.keyPoints.length > 0) {
        r += `\n[?곹뭹 ?ъ씤??\n`;
        info.keyPoints.forEach(point => {
            r += `- ${point}\n`;
        });
    }

    r += `\n[?먮Ц ?쇱젙???닿린]\n(${info.url})\n\n`;
    r += `?뱦 ?덉빟 ???뺤씤?ы빆\n\n`;
    r += `?곹뭹媛???덉빟??異쒕컻?쇱뿉 ?곕씪 蹂?숇맆 ???덉뒿?덈떎.\n`;
    r += `??났 醫뚯꽍? ?덉빟 ?쒖젏???ㅼ떆 ?뺤씤?댁빞 ?⑸땲??`;
    return r;
}

export async function generateRecommendation(info: DetailedProductInfo): Promise<string> {
    const p = info.price || '臾몄쓽';
    return `??**${info.destination} ?ы뻾, 異붿쿇?쒕젮??**\n\n${p}??利먭린???뚯갔 ?쇱젙?낅땲??`;
}

export function compareProducts(products: DetailedProductInfo[]): string {
    if (!products || products.length < 2) {
        return "鍮꾧탳???곹뭹??異⑸텇?섏? ?딆뒿?덈떎.";
    }

    let comparison = "?뽳툘 ?곹뭹 鍮꾧탳 遺꾩꽍 寃곌낵\n\n";

    // ?곸꽭 ?곹뭹蹂?遺꾩꽍 (?ъ슜???붿껌???곕씪 ?뚯씠釉?AI?대뱶諛붿씠???쒓굅)
    products.forEach((p, i) => {
        comparison += `${i + 1}. ${p.title}\n\n`;
        comparison += `* 媛寃?: ${p.price || '?뺣낫 ?놁쓬'}\n`;
        comparison += `* 異쒕컻??: ${p.departureDate || '誘몄젙'}\n`;
        comparison += `* 異쒕컻怨듯빆 : ${p.departureAirport || '?몄쿇'}\n`;
        comparison += `* ??났 : ${p.airline || '-'}\n`;
        comparison += `* 吏??: ${p.destination || '-'}\n`;
        comparison += `* 湲곌컙 : ${p.duration || '-'}\n\n`;

        if (p.keyPoints && p.keyPoints.length > 0) {
            comparison += `[?곹뭹 ?ъ씤??\n`;
            p.keyPoints.slice(0, 10).forEach(point => {
                comparison += `- ${point}\n`;
            });
            comparison += `\n`;
        }

        comparison += `[?먮Ц ?쇱젙???닿린]\n(${p.url})\n\n`;

        if (i < products.length - 1) {
            comparison += `------------------------------------------\n\n`;
        }
    });

    comparison += `?뱦 ?덉빟 ???뺤씤?ы빆\n\n`;
    comparison += `?곹뭹媛???덉빟??異쒕컻?쇱뿉 ?곕씪 蹂?숇맆 ???덉뒿?덈떎.\n`;
    comparison += `??났 醫뚯꽍? ?덉빟 ?쒖젏???ㅼ떆 ?뺤씤?댁빞 ?⑸땲??`;

    return comparison;
}

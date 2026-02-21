import { NextRequest, NextResponse } from 'next/server';

/**
 * ★ Edge Runtime 사용 ★
 * Vercel Hobby 플랜에서도 30초까지 실행 가능 (Serverless는 10초 제한)
 * 이를 통해 ScrapingBee의 JS 렌더링 시간을 충분히 확보합니다.
 */
export const runtime = 'edge';

/**
 * htmlToText - Edge Runtime에서 사용 가능한 간소화된 텍스트 추출
 * (Node.js API를 사용하지 않으므로 Edge에서도 동작)
 */
function htmlToText(html: string): string {
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
    const jsonPriceMatch = html.match(/["'](?:Price|SalePrice|goodsPrice|GoodsPrice|ProductPrice_Adult|Price_Adult|productPrice_Adult_TotalAmount)["']\s*[:=]\s*["']?(\d+)["']?/i);
    if (jsonPriceMatch) targetPrice = jsonPriceMatch[1];

    let targetDuration = '';
    const durationMatch = html.match(/(\d+)\s*박\s*(\d+)\s*일/);
    if (durationMatch) {
        targetDuration = `${durationMatch[1]}박${durationMatch[2]}일`;
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

    return `[METADATA]
PAGE_TITLE: ${finalTitle}
OG_TITLE: ${ogTitle}
BODY_TITLE: ${bodyTitle}
CLASS_TITLE: ${classTitle}
TARGET_TITLE: ${targetTitle}
TARGET_PRICE: ${targetPrice}
TARGET_DURATION: ${targetDuration}
[CONTENT]
${cleanBody}`;
}

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();
        if (!url) return NextResponse.json({ success: false, error: 'URL이 필요합니다.' }, { status: 400 });

        const apiKey = process.env.SCRAPINGBEE_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'SCRAPINGBEE_API_KEY가 설정되지 않았습니다.' });
        }

        let html: string | null = null;
        let lastError = '';

        // ── Tier 1: JS 렌더링 + 상호작용 (20초 타임아웃, Edge에서 충분히 여유 있음) ──
        try {
            console.log(`[CrawlAPI-Edge] Tier 1 시도: ${url}`);
            const jsScenario = {
                instructions: [
                    { scroll_to: "bottom" },
                    { wait: 1500 },
                    { evaluate: "document.querySelectorAll('button, a, div, span').forEach(el => { const txt = el.innerText || ''; if(['상세', '전체', '펼치기', '더보기', '일정'].some(w => txt.includes(w))) { try { el.click(); } catch(e){} } })" },
                    { wait: 1500 },
                    { scroll_to: "bottom" }
                ]
            };
            const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=networkidle&timeout=20000&js_scenario=${encodeURIComponent(JSON.stringify(jsScenario))}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000);

            const response = await fetch(scrapingBeeUrl, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                html = await response.text();
                console.log(`[CrawlAPI-Edge] Tier 1 성공: ${html.length}자`);
            } else {
                lastError = `Tier1: API_ERROR_${response.status}`;
                console.warn(`[CrawlAPI-Edge] Tier 1 실패: ${response.status}`);
            }
        } catch (e: any) {
            lastError = `Tier1: ${e.name === 'AbortError' ? 'TIMEOUT' : e.message}`;
            console.warn(`[CrawlAPI-Edge] Tier 1 실패:`, lastError);
        }

        // ── Tier 2: JS 렌더링만 (시나리오 없음, 10초) ──
        if (!html) {
            try {
                console.log(`[CrawlAPI-Edge] Tier 2 시도`);
                const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=load&timeout=15000`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);

                const response = await fetch(scrapingBeeUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (response.ok) {
                    html = await response.text();
                    console.log(`[CrawlAPI-Edge] Tier 2 성공: ${html.length}자`);
                } else {
                    lastError += ` | Tier2: API_ERROR_${response.status}`;
                }
            } catch (e: any) {
                lastError += ` | Tier2: ${e.name === 'AbortError' ? 'TIMEOUT' : e.message}`;
            }
        }

        // ── Tier 3: JS 없이 빠른 수집 (3초) ──
        if (!html) {
            try {
                console.log(`[CrawlAPI-Edge] Tier 3 시도`);
                const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=5000`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(scrapingBeeUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (response.ok) {
                    html = await response.text();
                    console.log(`[CrawlAPI-Edge] Tier 3 성공: ${html.length}자`);
                } else {
                    lastError += ` | Tier3: API_ERROR_${response.status}`;
                }
            } catch (e: any) {
                lastError += ` | Tier3: ${e.name === 'AbortError' ? 'TIMEOUT' : e.message}`;
            }
        }

        if (!html) {
            return NextResponse.json({
                success: false,
                error: `데이터 수집 실패. (${lastError})`
            });
        }

        // HTML → 정제된 텍스트 + NEXT_DATA 추출
        const cleanedText = htmlToText(html);

        let nextData: string | undefined = undefined;
        const startIdx = html.indexOf('<script id="__NEXT_DATA__"');
        if (startIdx !== -1) {
            const jsonStart = html.indexOf('>', startIdx) + 1;
            const jsonEnd = html.indexOf('</script>', jsonStart);
            if (jsonStart !== 0 && jsonEnd !== -1) {
                nextData = html.substring(jsonStart, jsonEnd);
            }
        }

        console.log(`[CrawlAPI-Edge] 최종 성공 (정제됨): ${cleanedText.length}자, NextData: ${nextData?.length || 0}자`);

        return NextResponse.json({
            success: true,
            text: cleanedText,
            nextData: nextData
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

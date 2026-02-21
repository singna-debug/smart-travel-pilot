import { NextRequest, NextResponse } from 'next/server';
import { htmlToText } from '@/lib/url-crawler';

/**
 * scrapeWithScrapingBeeTiered - 최적화된 수집 로직
 * tier: 1(Interactive), 2(Simple Render), 3(Fast Fetch)
 */
async function scrapeWithScrapingBeeTiered(url: string, tier: number): Promise<{ html: string | null; error?: string }> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY;
    if (!apiKey) return { html: null, error: 'API_KEY_MISSING' };

    try {
        let scrapingBeeUrl = '';
        let timeout = 7500;

        if (tier === 1) {
            // Tier 1: Interactive + Premium Proxy (Modetour 대응)
            const jsScenario = {
                instructions: [
                    { scroll_to: "bottom" },
                    { wait: 800 },
                    { evaluate: "document.querySelectorAll('button, a, div, span').forEach(el => { const txt = el.innerText || ''; if(['상세', '전체', '펼치기', '더보기', '일정'].some(w => txt.includes(w))) { try { el.click(); } catch(e){} } })" },
                    { wait: 800 },
                    { scroll_to: "bottom" }
                ]
            };
            // premium_proxy=true 추가
            scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=load&timeout=15000&premium_proxy=true&js_scenario=${encodeURIComponent(JSON.stringify(jsScenario))}`;
            timeout = 6500;
        } else if (tier === 2) {
            // Tier 2: Simple Render + Premium Proxy
            scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=load&timeout=10000&premium_proxy=true`;
            timeout = 2500;
        } else {
            // Tier 3: Fast Fetch (No JS, No Premium)
            scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=5000`;
            timeout = 900;
        }

        console.log(`[CrawlAPI] Tier ${tier} 시도: ${url} (Timeout: ${timeout}ms)`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(scrapingBeeUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errTxt = await response.text();
            console.error(`[CrawlAPI] Tier ${tier} API 오류:`, response.status, errTxt.substring(0, 100));
            return { html: null, error: `API_ERROR_${response.status}` };
        }

        const html = await response.text();
        return { html };
    } catch (e: any) {
        const errorType = e.name === 'AbortError' ? 'TIMEOUT' : e.message;
        console.warn(`[CrawlAPI] Tier ${tier} 실패:`, errorType);
        return { html: null, error: errorType };
    }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    let lastError = '';
    try {
        const { url } = await request.json();
        if (!url) return NextResponse.json({ success: false, error: 'URL이 필요합니다.' }, { status: 400 });

        let html: string | null = null;

        // 1단계: 정밀 수집 시도
        const res1 = await scrapeWithScrapingBeeTiered(url, 1);
        html = res1.html;
        if (res1.error) lastError = `Tier1: ${res1.error}`;

        // 2단계: 실패 시 간편 렌더링 시도
        if (!html) {
            const res2 = await scrapeWithScrapingBeeTiered(url, 2);
            html = res2.html;
            if (res2.error) lastError += ` | Tier2: ${res2.error}`;
        }

        // 3단계: 실패 시 초고속 수집 시도
        if (!html) {
            const res3 = await scrapeWithScrapingBeeTiered(url, 3);
            html = res3.html;
            if (res3.error) lastError += ` | Tier3: ${res3.error}`;
        }

        if (!html) {
            return NextResponse.json({
                success: false,
                error: `데이터 수집 실패. (${lastError})`
            });
        }

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

        console.log(`[CrawlAPI] 수집 성공 (정제됨): ${cleanedText.length}자`);

        return NextResponse.json({
            success: true,
            text: cleanedText,
            nextData: nextData
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

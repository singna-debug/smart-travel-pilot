import { NextRequest, NextResponse } from 'next/server';
import { scrapeWithBrowser } from '@/lib/browser-crawler';

/**
 * scrapeWithScrapingBee - lib/url-crawler.ts의 로직을 재사용하되 API 라우트에서 직접 호출
 */
/**
 * scrapeWithScrapingBee - 최적화된 수집 로직
 * tier: 1(Interactive), 2(Simple Render), 3(Fast Fetch)
 */
async function scrapeWithScrapingBeeTiered(url: string, tier: number): Promise<string | null> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY;
    if (!apiKey) return null;

    try {
        let scrapingBeeUrl = '';
        let timeout = 7000;

        if (tier === 1) {
            // Tier 1: Interactive (Scroll + Click)
            const jsScenario = {
                instructions: [
                    { scroll_to: "bottom" },
                    { wait: 1000 },
                    { evaluate: "document.querySelectorAll('button, a, div, span').forEach(el => { const txt = el.innerText || ''; if(['상세', '전체', '펼치기', '더보기'].some(w => txt.includes(w))) { try { el.click(); } catch(e){} } })" },
                    { wait: 1000 },
                    { scroll_to: "bottom" }
                ]
            };
            scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=load&timeout=15000&js_scenario=${encodeURIComponent(JSON.stringify(jsScenario))}`;
            timeout = 6500;
        } else if (tier === 2) {
            // Tier 2: Simple JS Render (No scenario)
            scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=load&timeout=10000`;
            timeout = 2500;
        } else {
            // Tier 3: Fast Fetch (No JS)
            scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=false&timeout=5000`;
            timeout = 800;
        }

        console.log(`[CrawlAPI] Tier ${tier} 시도: ${url} (Timeout: ${timeout}ms)`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(scrapingBeeUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`Status ${response.status}`);
        return await response.text();
    } catch (e: any) {
        console.warn(`[CrawlAPI] Tier ${tier} 실패:`, e.name === 'AbortError' ? 'Timeout' : e.message);
        return null;
    }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();
        if (!url) return NextResponse.json({ success: false, error: 'URL이 필요합니다.' }, { status: 400 });

        let html: string | null = null;

        // [Tier 1] 정밀 수집 시도 (6.5초)
        html = await scrapeWithScrapingBeeTiered(url, 1);

        // [Tier 2] 실패 시 간편 렌더링 시도 (2.5초)
        if (!html) {
            html = await scrapeWithScrapingBeeTiered(url, 2);
        }

        // [Tier 3] 실패 시 초고속 수집 시도 (0.8초)
        if (!html) {
            html = await scrapeWithScrapingBeeTiered(url, 3);
        }

        if (!html) {
            return NextResponse.json({
                success: false,
                error: '데이터 수집 실패 (타임아웃 또는 API 오류). API 설정과 주소를 확인해주세요.'
            });
        }

        console.log(`[CrawlAPI] 수집 성공: ${html.length}자`);
        return NextResponse.json({ success: true, html });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

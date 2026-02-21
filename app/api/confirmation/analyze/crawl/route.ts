import { NextRequest, NextResponse } from 'next/server';
import { htmlToText } from '@/lib/url-crawler';

/**
 * scrapeWithScrapingBeeTiered - 최적화된 수집 로직
 * tier: 1(Interactive), 2(Simple Render), 3(Fast Fetch)
 */
async function scrapeWithScrapingBeeTiered(url: string, tier: number): Promise<string | null> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY;
    if (!apiKey) return null;

    try {
        let scrapingBeeUrl = '';
        let timeout = 7000;

        if (tier === 1) {
            // Tier 1: Interactive (Scroll + Click) - 5.5초로 제한하여 오버헤드 확보
            const jsScenario = {
                instructions: [
                    { scroll_to: "bottom" },
                    { wait: 800 },
                    { evaluate: "document.querySelectorAll('button, a, div, span').forEach(el => { const txt = el.innerText || ''; if(['상세', '전체', '펼치기', '더보기', '일정'].some(w => txt.includes(w))) { try { el.click(); } catch(e){} } })" },
                    { wait: 800 },
                    { scroll_to: "bottom" }
                ]
            };
            scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=load&timeout=12000&js_scenario=${encodeURIComponent(JSON.stringify(jsScenario))}`;
            timeout = 5500;
        } else if (tier === 2) {
            // Tier 2: Simple JS Render (No scenario) - 2.5초
            scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=load&timeout=10000`;
            timeout = 2500;
        } else {
            // Tier 3: Fast Fetch (No JS) - 0.8초
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

        // 1단계: 정밀 수집 시도
        html = await scrapeWithScrapingBeeTiered(url, 1);

        // 2단계: 실패 시 간편 렌더링 시도
        if (!html) {
            html = await scrapeWithScrapingBeeTiered(url, 2);
        }

        // 3단계: 실패 시 초고속 수집 시도
        if (!html) {
            html = await scrapeWithScrapingBeeTiered(url, 3);
        }

        if (!html) {
            return NextResponse.json({
                success: false,
                error: '데이터 수집 실패 (타임아웃 또는 API 오류).'
            });
        }

        // [핵심 최적화] HTML 전체 대신 정제된 텍스트와 NEXT_DATA만 추출하여 반환
        // 이를 통해 페이로드 크기를 4.5MB 이하(보통 수십KB)로 줄여 Vercel 제한을 회피함
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

        console.log(`[CrawlAPI] 수집 성공 (정제됨): ${cleanedText.length}자, NextData: ${nextData?.length || 0}자`);

        return NextResponse.json({
            success: true,
            text: cleanedText,
            nextData: nextData
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

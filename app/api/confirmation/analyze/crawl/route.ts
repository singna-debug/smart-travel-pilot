import { NextRequest, NextResponse } from 'next/server';
import { scrapeWithBrowser } from '@/lib/browser-crawler';

/**
 * scrapeWithScrapingBee - lib/url-crawler.ts의 로직을 재사용하되 API 라우트에서 직접 호출
 */
async function scrapeWithScrapingBee(url: string): Promise<string | null> {
    const apiKey = process.env.SCRAPINGBEE_API_KEY;
    if (!apiKey) return null;

    try {
        console.log(`[CrawlAPI] ScrapingBee 시작: ${url}`);
        const jsScenario = {
            instructions: [
                { scroll_to: "bottom" },
                { wait: 1500 },
                { evaluate: "document.querySelectorAll('button, a, div, span').forEach(el => { const txt = el.innerText || ''; if(['상세', '전체', '펼치기', '더보기'].some(w => txt.includes(w))) { try { el.click(); } catch(e){} } })" },
                { wait: 1500 },
                { scroll_to: "bottom" }
            ]
        };

        const scrapingBeeUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true&wait_browser=networkidle&timeout=20000&js_scenario=${encodeURIComponent(JSON.stringify(jsScenario))}`;

        const response = await fetch(scrapingBeeUrl);
        if (!response.ok) throw new Error(`Status ${response.status}`);
        const html = await response.text();
        return html;
    } catch (e) {
        console.error('[CrawlAPI] ScrapingBee 오류:', e);
        return null;
    }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const { url } = await request.json();
        if (!url) return NextResponse.json({ success: false, error: 'URL이 필요합니다.' }, { status: 400 });

        const isVercel = process.env.VERCEL === '1';
        let html: string | null = null;

        // 1. 브라우저 크롤링 (로컬전용)
        if (!isVercel) {
            try {
                console.log('[CrawlAPI] 로컬: Browser 시도');
                // scrapeWithBrowser는 htmlToText까지 포함되어 있을 수 있으므로 확인 필요
                // 여기서는 HTML을 가져오는 것이 목적임
            } catch (e) { }
        }

        // 2. ScrapingBee (운영/로컬 공용)
        if (!html) {
            html = await scrapeWithScrapingBee(url);
        }

        if (!html) {
            return NextResponse.json({ success: false, error: '데이터 수집 실패' });
        }

        // HTML에서 텍스트 추출 로직은 url-crawler.ts의 htmlToText를 사용하거나 여기서 간단히 처리
        // 하지만 NextData 등 복잡한 처리가 필요하므로 raw html을 보낸 후 분석 API에서 처리하도록 함
        return NextResponse.json({ success: true, html });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

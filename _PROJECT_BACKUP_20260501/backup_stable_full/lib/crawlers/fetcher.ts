
import { quickFetch, htmlToText } from '../crawler-base-utils';
import { fetchModeTourNative } from './modetour-utils';
import { scrapeWithBrowser } from '../browser-crawler';

export interface FetchOptions {
    isSummaryOnly?: boolean;
    skipHtml?: boolean;
}

export async function fetchContent(url: string, options: FetchOptions = {}): Promise<{ text: string, nextData?: string, nativeData?: any }> {
    const { isSummaryOnly = false, skipHtml = false } = options;
    const isModeTour = url.includes('modetour.com') || url.includes('modetour.co.kr');

    if (isModeTour) {
        if (skipHtml) {
            const nativeData = await fetchModeTourNative(url, isSummaryOnly);
            return { text: '', nativeData };
        }

        const [nativeData, fetchResult] = await Promise.all([
            fetchModeTourNative(url, isSummaryOnly).catch(e => {
                console.error(`[Fetcher] Native Fetch Error: ${e.message}`);
                return null;
            }),
            quickFetch(url).catch(e => {
                console.error(`[Fetcher] HTML Fetch Error: ${e.message}`);
                return { html: '', title: '' };
            })
        ]);
        
        let html = fetchResult.html;
        console.log(`[Fetcher] ModeTour Fetch Status. NativeData: ${!!nativeData}, HTML Length: ${html.length}`);

        // [CRITICAL] 404/Queue-it 등으로 HTML을 못 가져왔을 경우 브라우저 스크래퍼(Puppeteer) 시도
        // 🚀 그러나 이미 nativeData를 통해 완벽한 정보(상품명 길이 등)를 확보했다면, 무거운 Puppeteer로 fallback하지 않고 시간을 단축합니다.
        const hasGoodNativeData = nativeData && nativeData.title && nativeData.title.length > 5;
        
        if (!hasGoodNativeData && (!html || html.length < 500)) {
            const isVercel = process.env.VERCEL === '1';
            if (!isVercel) {
                console.warn(`[Fetcher] HTML Empty/Short. Falling back to Browser Scraper (Puppeteer)...`);
                const browserHtml = await scrapeWithBrowser(url);
                if (browserHtml) {
                    html = browserHtml;
                    console.log(`[Fetcher] Browser Scraper Success! Content Length: ${html.length}`);
                }
            }
        }

        if (nativeData || html) {
            // [추가] 만약 nativeData가 없다면 HTML에서 productNo를 찾아 재시도
            let finalNative = nativeData;
            if (!finalNative && html && html.length > 500) {
                console.log('[Fetcher] NativeData missing. Retrying with HTML-based productNo detection...');
                finalNative = await fetchModeTourNative(url, isSummaryOnly, html).catch(() => null);
            }

            const text = htmlToText(html, url);
            const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
            const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;
            return { text, nextData, nativeData: finalNative };
        }
    }

    const { html } = await quickFetch(url);
    const text = htmlToText(html, url);
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;
    return { text, nextData };
}

export const scrapeWithScrapingBee = async (url: string): Promise<string | null> => {
    const apiKey = process.env.SCRAPINGBEE_API_KEY?.trim();
    if (!apiKey) return null;
    try {
        const response = await fetch(`https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true`);
        if (response.ok) return htmlToText(await response.text(), url);
    } catch (e) {}
    return null;
};

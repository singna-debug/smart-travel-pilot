
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

    const isHanaTour = url.includes('hanatour.com');
    try {
        const { crawlForUrlAnalysis } = await import('./url-analysis');
        const nativeData = await crawlForUrlAnalysis(url).catch(() => null);
        if (nativeData) {
            console.log(`[Fetcher] Native Fetch Success via URL Analysis module! Title: ${nativeData.title}`);
            return {
                text: JSON.stringify(nativeData),
                nextData: undefined,
                nativeData
            };
        }
    } catch (e: any) {
        console.error('[Fetcher] URL Analysis module failed:', e.message);
    }

    const { html } = await quickFetch(url);
    const text = htmlToText(html, url);
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    const nextData = nextDataMatch ? nextDataMatch[1].trim() : undefined;
    return { text, nextData };
}

export const scrapeWithStealthFetch = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url, {
            headers: {
                'referer': 'https://www.google.com/',
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            cache: 'no-store'
        });
        if (response.ok) return htmlToText(await response.text(), url);
    } catch (e) {}
    return null;
};

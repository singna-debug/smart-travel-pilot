import type { DetailedProductInfo } from '../../types';
import { analyzeWithGemini, htmlToText, fallbackParse } from '../crawler-base-utils';
import { fetchContent, scrapeWithScrapingBee } from './fetcher';
import { refineData } from './refiner';
import { scrapeWithBrowser } from '../browser-crawler';

/**
 * 일반 URL 분석 (노멀 모드)
 */
export async function crawlTravelProduct(url: string, source?: string): Promise<DetailedProductInfo | null> {
    console.log(`[NormalCrawler] Start. URL=${url}`);
    const isVercel = process.env.VERCEL === '1';

    // 1. 데이터 확보
    const { text, nextData, nativeData } = await fetchContent(url, { isSummaryOnly: true });
    let finalText = text;
    let finalNextData = nextData;
    
    // 2. 브라우저 스크래핑 (데이터가 너무 부족할 때만 최후의 수단으로 사용)
    const needsMoreData = !nativeData && ((!finalText || finalText.length < 500));
    
    if (needsMoreData) {
        if (!isVercel) {
            try {
                console.log(`[NormalCrawler] Scraping with Browser for more data...`);
                const browserHtml = await scrapeWithBrowser(url, { skipClicks: true });
                if (browserHtml) {
                    // browserHtml은 이미 browser-crawler에서 텍스트 기반으로 가공되어 있음
                    if (browserHtml.length > finalText.length) finalText = browserHtml;
                }
            } catch (e) {}
        } else if (process.env.SCRAPINGBEE_API_KEY) {
            try {
                console.log(`[NormalCrawler] Scraping with ScrapingBee...`);
                const beeHtml = await scrapeWithScrapingBee(url);
                if (beeHtml) {
                    // ScrapingBee 결과는 HTML이므로 htmlToText 필요
                    const beeText = htmlToText(beeHtml, url);
                    if (beeText.length > finalText.length) finalText = beeText;
                }
            } catch (e) {}
        }
    }

    // 3. 컨텍스트 구성
    let contextText = finalText;
    if (nativeData) {
        const nativeSummary = `--- [중요: 여행 상품 핵심 정보] ---\n` +
            `상품명: ${nativeData.title}\n` +
            `가격: ${nativeData.price}\n` +
            `지역: ${nativeData.destination}\n` +
            `기간: ${nativeData.duration}\n` +
            `출발일: ${nativeData.departureDate} / 귀국일: ${nativeData.returnDate}\n` +
            `항공: ${nativeData.airline} (${nativeData.departureAirport} 출발)\n` +
            `[상품 포인트(AI 기반 추출용)]: ${(nativeData.keyPoints || []).join(', ') || 'Native API에서 찾지 못함'}\n` +
            `----------------------------------\n\n`;
        contextText = nativeSummary + finalText;
    }

    // 4. Gemini 분석 (최적화된 프롬프트 사용)
    const aiResult = await analyzeWithGemini(contextText, url, true, finalNextData);
    
    if (aiResult) {
        const merged = { ...aiResult };
        if (nativeData) {
            if (!merged.price || merged.price === '0') merged.price = nativeData.price;
            if (!merged.airline) merged.airline = nativeData.airline;
            if (!merged.departureDate) merged.departureDate = nativeData.departureDate;
            if (!merged.returnDate) merged.returnDate = nativeData.returnDate;
            if (!merged.departureAirport) merged.departureAirport = nativeData.departureAirport;
            if (!merged.destination) merged.destination = nativeData.destination;
            if (!merged.duration || merged.duration === '미정') merged.duration = nativeData.duration;
            if ((!merged.keyPoints || merged.keyPoints.length < 3) && nativeData.keyPoints) {
                merged.keyPoints = [...new Set([...(merged.keyPoints || []), ...nativeData.keyPoints])];
            }
        }
        return refineData(merged, contextText, url);
    }
    
    return nativeData 
        ? refineData(nativeData, contextText, url) 
        : refineData(fallbackParse(finalText), finalText, url);
}

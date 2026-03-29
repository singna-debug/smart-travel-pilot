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
            `[원본 상품 포인트]:\n${(nativeData.keyPoints || []).map((p: string) => '- ' + p).join('\n') || 'Native API에서 찾지 못함'}\n` +
            `----------------------------------\n\n`;
        // [초경량 AI 모드 전환] HTML 원본(finalText)을 전부 AI에 던지면 20~30초가 소요됩니다.
        // Native API 데이터가 충분하다면, 원본 텍스트를 제거하고 요약본만 AI에 넘겨 1~2초만에 요약된 keyPoints를 받습니다.
        // 🚀 [강화] 가격이 '0'이거나 비어있으면 데이터가 불완전한 것이므로 초경량 모드를 사용하지 않고 전체 분석을 수행합니다.
        const isDataComplete = nativeData.title && nativeData.price && nativeData.price !== '0' && nativeData.title.length > 5;
        
        if (isDataComplete) {
            console.log(`[NormalCrawler] Native 데이터가 완벽하여(가격:${nativeData.price}) 초경량 AI 모드로 3초 이내 분석을 시도합니다.`);
            contextText = nativeSummary; // HTML 텍스트 제외!
        } else {
            console.log(`[NormalCrawler] Native 데이터 불충분(가격:${nativeData.price}). 심층 분석을 위해 전체 HTML을 포함합니다.`);
            contextText = nativeSummary + finalText;
        }
    }

    // 4. Gemini 분석 (최적화된 프롬프트 사용 - 초경량 모드인 경우 1~2초 소요)
    const aiResult = await analyzeWithGemini(contextText, url, true, finalNextData);
    
    if (aiResult) {
        const merged = { ...aiResult };
        if (nativeData) {
            // [MASTER DATA 우선순위] Native API 데이터가 있다면 AI 결과보다 우선시합니다 (정확도 100%)
            if (nativeData.price && nativeData.price !== '0') merged.price = nativeData.price;
            if (nativeData.airline) merged.airline = nativeData.airline;
            if (nativeData.departureDate) merged.departureDate = nativeData.departureDate;
            if (nativeData.returnDate) merged.returnDate = nativeData.returnDate;
            if (nativeData.departureAirport && nativeData.departureAirport !== '인천') {
                merged.departureAirport = nativeData.departureAirport;
            } else if (!merged.departureAirport) {
                merged.departureAirport = nativeData.departureAirport || '인천';
            }
            if (nativeData.destination) merged.destination = nativeData.destination;
            if (nativeData.duration && nativeData.duration !== '미정') merged.duration = nativeData.duration;
            
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

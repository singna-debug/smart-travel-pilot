import { NextRequest, NextResponse } from 'next/server';
import { crawlTravelProduct, formatProductInfo, generateRecommendation, compareProducts, htmlToText, crawlForConfirmation, crawlForBooking, crawlForReservationGuide } from '@/lib/url-crawler';
import type { TravelProductInfo, DetailedProductInfo } from '@/types';

// URL 분석 API (단일 및 다중 URL 지원)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    console.log('[API] Analyze URL Request Received');
    try {
        const body = await request.json();
        const { url, urls, text, nextData, texts, nextDatas, preAnalyzedData, source, mode } = body;

        // 단일 URL
        if (url && !urls) {
            return await analyzeSingleUrl(url, source || mode, text, nextData, body.html);
        }

        // 다중 URL (미리 분석된 데이터가 있는 경우 - Edge API 경유)
        if (urls && preAnalyzedData && Array.isArray(preAnalyzedData)) {
            return await processPreAnalyzedMultipleUrls(urls, preAnalyzedData);
        }

        // 다중 URL (기본 모드)
        if (urls && Array.isArray(urls)) {
            return await analyzeMultipleUrls(urls, texts, nextDatas, body.htmls, mode);
        }

        return NextResponse.json(
            { success: false, error: 'URL 또는 URLs 배열이 필요합니다.' },
            { status: 400 }
        );
    } catch (error) {
        console.error('URL 분석 치명적 오류:', error);
        return NextResponse.json(
            { success: false, error: '분석 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)) },
            { status: 500 }
        );
    }
}

async function analyzeSingleUrl(url: string, source: string | undefined, text?: string, nextData?: string, html?: string) {
    console.log('[API] analyzeSingleUrl started', { url, source, hasText: !!text, hasHtml: !!html });
    
    try {
        let effectiveMode = source || 'normal';
        if (effectiveMode === 'deep') effectiveMode = 'confirmation';
        
        console.log(`[API] Processing single url directly. Mode: ${effectiveMode}`);
        
        let info: DetailedProductInfo | null = null;
        
        if (text) {
            info = await crawlForConfirmation(url, text, nextData);
        } else if (html) {
            const fullText = htmlToText(html, url);
            info = await crawlForConfirmation(url, fullText, nextData);
        } else {
            switch (effectiveMode) {
                case 'booking':
                    info = await crawlForBooking(url);
                    break;
                case 'reservation_guide':
                    info = await crawlForReservationGuide(url);
                    break;
                case 'confirmation':
                case 'deep':
                    info = await crawlForConfirmation(url);
                    break;
                default:
                    info = await crawlTravelProduct(url);
            }
        }

        if (info) {
            return NextResponse.json({
                success: true,
                data: {
                    raw: info,
                    formatted: formatProductInfo(info, 0),
                    recommendation: "",
                }
            });
        }
        
        return NextResponse.json({ success: false, error: '분석 결과를 생성하지 못했습니다.' });
    } catch (error: any) {
        console.error('[API] analyzeSingleUrl Exception:', error);
        return NextResponse.json({ success: false, error: error.message });
    }
}

async function analyzeMultipleUrls(urls: string[], texts?: (string | null)[], nextDatas?: (string | null)[], htmls?: (string | null)[], mode?: string) {
    // URL 유효성 검사
    const validInputs = urls.map((url, i) => ({
        url,
        text: texts ? texts[i] : undefined,
        nextData: nextDatas ? nextDatas[i] : undefined,
        html: htmls ? htmls[i] : undefined
    })).filter(input => {
        try {
            new URL(input.url);
            return true;
        } catch {
            return false;
        }
    }).slice(0, 5);

    if (validInputs.length === 0) {
        return NextResponse.json({ success: false, error: '유효한 URL이 없습니다.' }, { status: 400 });
    }

    // 병렬 분석
    const results = await Promise.all(
        validInputs.map(async (input, index) => {
            let info: DetailedProductInfo | null = null;

            if (input.text) {
                console.log(`[API] Multi-Analyze [${index + 1}] 최적화 모드`);
                info = await crawlForConfirmation(input.url, input.text, input.nextData || undefined);
            } else if (input.html) {
                console.log(`[API] Multi-Analyze [${index + 1}] 호환 모드`);
                const fullText = htmlToText(input.html, input.url);
                let nextData: string | undefined = undefined;
                const startIdx = input.html.indexOf('<script id="__NEXT_DATA__"');
                if (startIdx !== -1) {
                    const jsonStart = input.html.indexOf('>', startIdx) + 1;
                    const jsonEnd = input.html.indexOf('</script>', jsonStart);
                    if (jsonStart !== 0 && jsonEnd !== -1) {
                        nextData = input.html.substring(jsonStart, jsonEnd);
                    }
                }
                info = await crawlForConfirmation(input.url, fullText, nextData);
            } else {
                console.log(`[API] Multi-Analyze [${index + 1}] 1단계 모드 (Mode: ${mode})`);
                switch (mode) {
                    case 'booking':
                        info = await crawlForBooking(input.url);
                        break;
                    case 'reservation_guide':
                        info = await crawlForReservationGuide(input.url);
                        break;
                    case 'confirmation':
                    case 'deep':
                        info = await crawlForConfirmation(input.url);
                        break;
                    default:
                        info = await crawlTravelProduct(input.url);
                }
            }

            return { url: input.url, index: index + 1, info };
        })
    );

    const successfulResults = results.filter(r => r.info !== null);
    const products: DetailedProductInfo[] = successfulResults.map(r => r.info!);

    if (products.length === 0) {
        return NextResponse.json({ success: false, error: '어떤 URL에서도 정보를 추출할 수 없습니다.' });
    }

    const comparison = compareProducts(products);
    const productDetails = successfulResults.map((r, i) => ({
        url: r.url,
        index: r.index,
        raw: r.info,
        formatted: formatProductInfo(r.info!, i),
    }));

    return NextResponse.json({
        success: true,
        data: {
            products: productDetails,
            comparison: comparison,
            totalAnalyzed: products.length,
            totalRequested: urls.length,
        },
    });
}

// 미리 분석된 데이터(Edge API 등에서)를 활용한 비교 처리
async function processPreAnalyzedMultipleUrls(urls: string[], preAnalyzedData: any[]) {
    if (!urls || urls.length === 0 || !preAnalyzedData || preAnalyzedData.length === 0) {
        return NextResponse.json({ success: false, error: '유효한 URL 또는 분석 데이터가 없습니다.' }, { status: 400 });
    }

    const successfulResults = preAnalyzedData
        .map((info, idx) => ({ url: urls[idx], index: idx + 1, info }))
        .filter(r => r.info !== null);

    const products: DetailedProductInfo[] = successfulResults.map(r => r.info!);

    if (products.length === 0) {
        return NextResponse.json({ success: false, error: '분석된 정보가 없습니다.' });
    }

    const comparison = compareProducts(products);
    const productDetails = successfulResults.map((r, i) => ({
        url: r.url,
        index: r.index,
        raw: r.info,
        formatted: formatProductInfo(r.info!, i),
    }));

    return NextResponse.json({
        success: true,
        data: {
            products: productDetails,
            comparison: comparison,
            totalAnalyzed: products.length,
            totalRequested: urls.length,
        },
    });
}

import { NextRequest, NextResponse } from 'next/server';
import { crawlTravelProduct, formatProductInfo, generateRecommendation, compareProducts, htmlToText, analyzeForConfirmation, crawlForConfirmation } from '@/lib/url-crawler';
import type { TravelProductInfo, DetailedProductInfo } from '@/types';

// URL 분석 API (단일 및 다중 URL 지원)
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    console.log('[API] Analyze URL Request Received');
    try {
        const body = await request.json();
        const { url, urls } = body;

        // 단일 URL
        if (url && !urls) {
            return await analyzeSingleUrl(url, body.html);
        }

        // 다중 URL
        if (urls && Array.isArray(urls)) {
            return await analyzeMultipleUrls(urls, body.htmls);
        }

        return NextResponse.json(
            { success: false, error: 'URL 또는 URLs 배열이 필요합니다.' },
            { status: 400 }
        );
    } catch (error) {
        console.error('URL 분석 치명적 오류:', error);
        if (error instanceof Error) {
            console.error('Stack:', error.stack);
            console.error('Message:', error.message);
        }
        return NextResponse.json(
            { success: false, error: '분석 중 오류가 발생했습니다: ' + (error instanceof Error ? error.message : String(error)) },
            { status: 500 }
        );
    }
}

async function analyzeSingleUrl(url: string, html?: string) {
    // URL 유효성 검사
    try {
        new URL(url);
    } catch {
        return NextResponse.json(
            { success: false, error: '유효하지 않은 URL입니다.' },
            { status: 400 }
        );
    }

    let productInfo: DetailedProductInfo | null = null;

    if (html) {
        console.log('[API] 2단계 모드: 전달된 HTML 분석 시작');
        const fullText = htmlToText(html);

        let nextData: string | undefined = undefined;
        const startIdx = html.indexOf('<script id="__NEXT_DATA__"');
        if (startIdx !== -1) {
            const jsonStart = html.indexOf('>', startIdx) + 1;
            const jsonEnd = html.indexOf('</script>', jsonStart);
            if (jsonStart !== 0 && jsonEnd !== -1) {
                nextData = html.substring(jsonStart, jsonEnd);
            }
        }

        productInfo = await analyzeForConfirmation(fullText, url, nextData);
    } else {
        // [1단계 모드] 직접 크롤링
        console.log('[API] 1단계 모드: 직접 크롤링 시작');
        productInfo = await crawlTravelProduct(url);
    }

    if (!productInfo) {
        return NextResponse.json({
            success: false,
            error: '정보를 추출할 수 없습니다. (시간 초과 또는 분석 오류).',
        });
    }

    // 포맷된 텍스트 생성
    const formattedText = formatProductInfo(productInfo, 0);

    // AI 추천 멘트 생성
    const recommendation = await generateRecommendation(productInfo);

    return NextResponse.json({
        success: true,
        data: {
            raw: productInfo,
            formatted: formattedText,
            recommendation: recommendation,
        },
    });
}

async function analyzeMultipleUrls(urls: string[], htmls?: (string | null)[]) {
    // URL 유효성 검사
    const validInputs = urls.map((url, i) => ({
        url,
        html: htmls ? htmls[i] : undefined
    })).filter(input => {
        try {
            new URL(input.url);
            return true;
        } catch {
            return false;
        }
    }).slice(0, 5); // 최대 5개

    if (validInputs.length === 0) {
        return NextResponse.json(
            { success: false, error: '유효한 URL이 없습니다.' },
            { status: 400 }
        );
    }

    // 병렬로 분석 (이미 HTML이 있으면 수집 스킵)
    const results = await Promise.all(
        validInputs.map(async (input, index) => {
            let info: DetailedProductInfo | null = null;

            if (input.html) {
                console.log(`[API] Multi-Analyze [${index + 1}] 2단계 모드`);
                const fullText = htmlToText(input.html);

                let nextData: string | undefined = undefined;
                const startIdx = input.html.indexOf('<script id="__NEXT_DATA__"');
                if (startIdx !== -1) {
                    const jsonStart = input.html.indexOf('>', startIdx) + 1;
                    const jsonEnd = input.html.indexOf('</script>', jsonStart);
                    if (jsonStart !== 0 && jsonEnd !== -1) {
                        nextData = input.html.substring(jsonStart, jsonEnd);
                    }
                }

                info = await analyzeForConfirmation(fullText, input.url, nextData);
            } else {
                console.log(`[API] Multi-Analyze [${index + 1}] 1단계 모드`);
                info = await crawlTravelProduct(input.url);
            }

            return { url: input.url, index: index + 1, info };
        })
    );

    const successfulResults = results.filter(r => r.info !== null);
    const products: DetailedProductInfo[] = successfulResults.map(r => r.info!);

    if (products.length === 0) {
        return NextResponse.json({
            success: false,
            error: '어떤 URL에서도 정보를 추출할 수 없습니다.',
        });
    }

    // 비교 분석
    const comparison = compareProducts(products);

    // 각 상품 정보
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

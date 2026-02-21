import { NextRequest, NextResponse } from 'next/server';
import { crawlTravelProduct, formatProductInfo, generateRecommendation, compareProducts } from '@/lib/url-crawler';
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
            return await analyzeSingleUrl(url);
        }

        // 다중 URL
        if (urls && Array.isArray(urls)) {
            return await analyzeMultipleUrls(urls);
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

async function analyzeSingleUrl(url: string) {
    // URL 유효성 검사
    try {
        new URL(url);
    } catch {
        return NextResponse.json(
            { success: false, error: '유효하지 않은 URL입니다.' },
            { status: 400 }
        );
    }

    // 크롤링 실행
    const productInfo = await crawlTravelProduct(url);

    if (!productInfo) {
        return NextResponse.json({
            success: false,
            error: 'URL에서 정보를 추출할 수 없습니다. (시간 초과 또는 접근 불가). 잠시 후 다시 시도해주세요.',
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

async function analyzeMultipleUrls(urls: string[]) {
    // URL 유효성 검사
    const validUrls = urls.filter(url => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }).slice(0, 5); // 최대 5개

    if (validUrls.length === 0) {
        return NextResponse.json(
            { success: false, error: '유효한 URL이 없습니다.' },
            { status: 400 }
        );
    }

    // 병렬로 크롤링
    const results = await Promise.all(
        validUrls.map(async (url, index) => {
            const info = await crawlTravelProduct(url);
            return { url, index: index + 1, info };
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

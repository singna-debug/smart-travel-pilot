import { NextRequest, NextResponse } from 'next/server';
import { formatProductInfo, crawlForConfirmation, crawlTravelProduct, crawlForBooking } from '@/lib/url-crawler';

export const preferredRegion = 'icn1';
export const runtime = 'nodejs';

const VERSION = "2026-03-23-V13-STABLE";

/**
 * 이 엔드포인트는 URL을 받아서 크롤링하고 여행 정보를 분석합니다.
 * mode: 'normal' (목록용 간단 분석), 'booking' (예약용 메타데이터 분석), 'confirmation' (확정서용 상세 분석)
 */
export async function POST(req: NextRequest) {
    try {
        const { url, mode = 'normal', source } = await req.json();
        
        // 하위 호환성 유지
        let effectiveMode = mode;
        if (mode === 'deep' || mode === 'confirmation' || source === 'confirmation') {
            effectiveMode = 'confirmation';
        }

        console.log(`[POST] Starting for URL: ${url}, Mode: ${effectiveMode}, Version: ${VERSION}`);

        if (!url) {
            return NextResponse.json({ success: false, error: 'URL이 필요합니다.' });
        }

        let result = null;
        if (effectiveMode === 'confirmation') {
            result = await crawlForConfirmation(url);
        } else if (effectiveMode === 'booking') {
            result = await crawlForBooking(url);
        } else {
            result = await crawlTravelProduct(url);
        }

        if (!result) {
            console.error(`[POST] Analysis returned null for ${url}`);
            return NextResponse.json({ 
                success: false, 
                error: 'AI 분석 실패 (결과를 생성하지 못했습니다)' 
            });
        }

        // URL 정보 유지
        result.url = url;

        // 최종 가공 (문자열 포맷팅 등)
        const formatted = formatProductInfo(result);
        
        console.log(`[POST] Success! Title: ${result.title}, Airline: ${result.airline}`);
        
        return NextResponse.json({ 
            success: true, 
            data: { 
                raw: result, 
                formatted 
            } 
        });

    } catch (error: any) {
        console.error(`[POST] Critical Exception: ${error.message}`);
        return NextResponse.json({ 
            success: false, 
            error: `서버 오류: ${error.message}` 
        });
    }
}

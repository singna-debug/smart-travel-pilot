import { NextRequest, NextResponse } from 'next/server';
import { crawlForConfirmation } from '@/lib/url-crawler';

export const dynamic = 'force-dynamic';

/**
 * POST /api/confirmation/analyze
 * 확정서 전용 URL 종합 분석 — 전체 페이지에서 일정/식사/호텔/포함사항 등 모두 추출
 */
export async function POST(request: NextRequest) {
    console.log('[ConfirmAnalyze] 확정서 전용 URL 분석 요청');
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json(
                { success: false, error: 'URL이 필요합니다.' },
                { status: 400 }
            );
        }

        // URL 유효성 검사
        try { new URL(url); } catch {
            return NextResponse.json(
                { success: false, error: '유효하지 않은 URL입니다.' },
                { status: 400 }
            );
        }

        const result = await crawlForConfirmation(url);

        if (!result) {
            return NextResponse.json({
                success: false,
                error: '페이지에서 정보를 추출할 수 없습니다.',
            });
        }

        console.log('[ConfirmAnalyze] 분석 완료:', result.title);
        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('[ConfirmAnalyze] 오류:', error.message);
        return NextResponse.json(
            { success: false, error: '분석 중 오류: ' + error.message },
            { status: 500 }
        );
    }
}

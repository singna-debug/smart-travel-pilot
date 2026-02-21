import { NextRequest, NextResponse } from 'next/server';
import { crawlForConfirmation, htmlToText, analyzeForConfirmation } from '@/lib/url-crawler';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60초까지 연장 (Vercel Pro 플랜 지원)

/**
 * POST /api/confirmation/analyze
 * 확정서 전용 URL 종합 분석 — 전체 페이지에서 일정/식사/호텔/포함사항 등 모두 추출
 */
export async function POST(request: NextRequest) {
    console.log('[ConfirmAnalyze] 분석 요청 수신');
    try {
        const body = await request.json();
        const { url, html } = body;

        if (!url) {
            return NextResponse.json({ success: false, error: 'URL이 필요합니다.' }, { status: 400 });
        }

        let result: any = null;

        // [2단계 모드] 이미 크롤링된 HTML이 전달된 경우 (Vercel 타임아웃 회피용)
        if (html) {
            console.log('[ConfirmAnalyze] 2단계 모드: 전달된 HTML 분석 시작');

            // 1. HTML에서 텍스트 및 NextData 추출
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

            // 2. Gemini 분석
            result = await analyzeForConfirmation(fullText, url, nextData);
        } else {
            // [1단계 모드] 기존 방식 (로컬 등에서 직접 크롤링)
            console.log('[ConfirmAnalyze] 1단계 모드: 직접 크롤링 및 분석 시작');
            result = await crawlForConfirmation(url);
        }

        if (!result) {
            return NextResponse.json({
                success: false,
                error: '페이지에서 정보를 추출할 수 없습니다.',
            });
        }

        if (result && !result.url) result.url = url;

        console.log('[ConfirmAnalyze] 분석 성공:', result.title);
        return NextResponse.json({ success: true, data: result });
    } catch (error: any) {
        console.error('[ConfirmAnalyze] 오류:', error.message);
        return NextResponse.json(
            { success: false, error: '분석 중 오류: ' + error.message },
            { status: 500 }
        );
    }
}

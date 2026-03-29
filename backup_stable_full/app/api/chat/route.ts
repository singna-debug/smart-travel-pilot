import { NextRequest, NextResponse } from 'next/server';
import { generateTravelResponse } from '@/lib/ai-engine';
import { appendConsultationToSheet } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { message, userId } = body;

        if (!message) {
            return NextResponse.json(
                { error: '메시지가 필요합니다.' },
                { status: 400 }
            );
        }

        // 사용자 ID가 없으면 임시 ID 생성
        const sessionId = userId || `web-${Date.now()}`;

        // AI 응답 생성
        const { message: responseMessage, consultationData } = await generateTravelResponse(
            sessionId,
            message
        );

        // Google Sheets에 기록 (환경변수가 설정된 경우에만)
        if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
            try {
                await appendConsultationToSheet(consultationData);
            } catch (sheetError) {
                console.error('Google Sheets 기록 실패:', sheetError);
                // 시트 기록 실패해도 응답은 반환
            }
        }

        return NextResponse.json({
            message: responseMessage,
            consultationData,
        });
    } catch (error) {
        console.error('Chat API 오류:', error);
        return NextResponse.json(
            { error: '서버 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

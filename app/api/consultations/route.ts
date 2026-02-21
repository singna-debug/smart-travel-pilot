import { NextRequest, NextResponse } from 'next/server';
import { deleteConsultationFromSheet, updateConsultationStatus } from '@/lib/google-sheets';

// 상담 상태 업데이트
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId, rowIndex, status, sheetName } = body;

        if (!rowIndex || !status) {
            return NextResponse.json(
                { success: false, error: 'rowIndex와 status가 필요합니다.' },
                { status: 400 }
            );
        }

        // Google Sheets 상태 업데이트
        const success = await updateConsultationStatus(rowIndex, status, sheetName);

        if (success) {
            return NextResponse.json({
                success: true,
                message: '상태가 업데이트되었습니다.',
            });
        } else {
            return NextResponse.json(
                { success: false, error: 'Google Sheets 업데이트에 실패했습니다.' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('상태 업데이트 오류:', error);
        return NextResponse.json(
            { success: false, error: '처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

// 상담 삭제
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const rowIndex = searchParams.get('rowIndex');
        const sheetName = searchParams.get('sheetName');
        const sessionId = searchParams.get('sessionId');

        if (!rowIndex) {
            return NextResponse.json(
                { success: false, error: 'rowIndex가 필요합니다.' },
                { status: 400 }
            );
        }

        const rowNum = parseInt(rowIndex, 10);

        // Google Sheets에서 삭제
        const success = await deleteConsultationFromSheet(rowNum, sheetName || undefined);

        if (success) {
            return NextResponse.json({
                success: true,
                message: '상담이 삭제되었습니다.',
            });
        } else {
            return NextResponse.json(
                { success: false, error: 'Google Sheets 삭제에 실패했습니다.' },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('상담 삭제 오류:', error);
        return NextResponse.json(
            { success: false, error: '처리 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

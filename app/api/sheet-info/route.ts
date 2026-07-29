
import { NextRequest, NextResponse } from 'next/server';
import { getMonthSheetGid } from '@/lib/google-sheets';
import { getTenantIdFromHeaderOrQuery, DEFAULT_TENANT_ID } from '@/lib/tenant';

export async function GET(request: NextRequest) {
    try {
        const tenantId = getTenantIdFromHeaderOrQuery(request);

        // 신규 가입 유저의 전용 시트 연동 처리
        if (tenantId !== DEFAULT_TENANT_ID) {
            const { getSheetsConfigForTenant, getOrCreateMonthlySheet } = await import('@/lib/google-sheets');
            const { sheets, spreadsheetId } = await getSheetsConfigForTenant(tenantId);

            if (!spreadsheetId || spreadsheetId.includes('@')) {
                return NextResponse.json({
                    success: true,
                    isConfigured: false,
                    url: '#',
                    sheetId: null,
                    message: '⚙️ [설정] 페이지에서 사장님/여행사 전용 구글 시트 ID를 연결해 주세요.'
                });
            }

            const currentMonth = new Date().toISOString().substring(0, 7); // yyyy-MM
            // 시트가 비어있으면 시스템이 즉각 월별 상담 양식 탭을 생성해 줍니다!
            const { gid } = await getOrCreateMonthlySheet(sheets, spreadsheetId, currentMonth);

            const url = gid
                ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`
                : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

            return NextResponse.json({ success: true, isConfigured: true, url, sheetId: spreadsheetId, gid });
        }

        const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
        const gid = await getMonthSheetGid();

        const url = gid
            ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid}`
            : `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

        return NextResponse.json({ success: true, isConfigured: true, url, sheetId, gid });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

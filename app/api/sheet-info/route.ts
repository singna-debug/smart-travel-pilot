
import { NextRequest, NextResponse } from 'next/server';
import { getMonthSheetGid } from '@/lib/google-sheets';
import { getTenantIdFromHeaderOrQuery, DEFAULT_TENANT_ID } from '@/lib/tenant';

export async function GET(request: NextRequest) {
    try {
        const tenantId = getTenantIdFromHeaderOrQuery(request);

        // 신규 유저일 경우 사장님 구글 시트를 노출하지 않고 본인 시트 설정 안내
        if (tenantId !== DEFAULT_TENANT_ID) {
            return NextResponse.json({
                success: true,
                isConfigured: false,
                url: '#',
                sheetId: null,
                message: '⚙️ [설정] 페이지에서 사장님/여행사 전용 구글 시트 ID를 연결해 주세요.'
            });
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

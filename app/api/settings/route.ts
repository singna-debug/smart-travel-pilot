import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromHeaderOrQuery, DEFAULT_TENANT_ID } from '@/lib/tenant';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantId = getTenantIdFromHeaderOrQuery(request);

        // 1. 사장님 본인 계정 (gktla71@gmail.com / default_tenant) 인 경우 .env.local 값 채워주기
        if (tenantId === DEFAULT_TENANT_ID) {
            return NextResponse.json({
                success: true,
                settings: {
                    companyName: '(주)클럽모두투어',
                    companyEnglishName: 'CLUBMODE TRAVEL',
                    managerName: '김대표',
                    phone: '010-0000-0000',
                    workStartTime: '09:00',
                    workEndTime: '18:00',
                    googleSpreadsheetId: process.env.GOOGLE_SHEET_ID?.trim() || '',
                    googleSheetName: '7월상담DB',
                    googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL?.trim() || '',
                    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY ? '••••••••••••••••' : '',
                    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim() || '',
                    kakaoChannelId: '',
                    kakaoTalkId: '',
                }
            });
        }

        // 2. 일반 가입 유저인 경우 DB에서 본인만의 설정 조회
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
            const { data } = await supabase
                .from('tenant_settings')
                .select('*')
                .eq('tenant_id', tenantId)
                .single();

            if (data) {
                return NextResponse.json({
                    success: true,
                    settings: {
                        companyName: data.company_name || '',
                        companyEnglishName: data.company_english_name || '',
                        managerName: data.manager_name || '',
                        phone: data.phone || '',
                        workStartTime: data.work_start_time || '09:00',
                        workEndTime: data.work_end_time || '18:00',
                        googleSpreadsheetId: data.google_spreadsheet_id || '',
                        googleSheetName: data.google_sheet_name || '',
                        googleClientEmail: data.google_client_email || '',
                        googlePrivateKey: data.google_private_key ? '••••••••' : '',
                        geminiApiKey: data.gemini_api_key || '',
                        kakaoChannelId: data.kakao_channel_id || '',
                        kakaoTalkId: data.kakao_talk_id || '',
                    }
                });
            }
        }

        // 설정 데이터가 없는 경우 DB에 즉시 기본값 생성 및 삽입
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase && tenantId !== 'default_tenant') {
            await supabase.from('tenant_settings').upsert({
                tenant_id: tenantId,
                work_start_time: '09:00',
                work_end_time: '18:00'
            });
        }

        return NextResponse.json({
            success: true,
            settings: {
                companyName: '',
                companyEnglishName: '',
                managerName: '',
                phone: '',
                workStartTime: '09:00',
                workEndTime: '18:00',
                googleSpreadsheetId: '',
                googleSheetName: '',
                googleClientEmail: '',
                googlePrivateKey: '',
                geminiApiKey: '',
                kakaoChannelId: '',
                kakaoTalkId: '',
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const tenantId = getTenantIdFromHeaderOrQuery(request);
        const body = await request.json();

        const sheetId = body.googleSpreadsheetId?.trim();
        if (sheetId && sheetId.includes('@')) {
            return NextResponse.json({ success: false, error: '⚠️ 올바른 구글 스프레드시트 ID를 입력해주세요. (이메일 주소는 시트 ID가 아닙니다.)' }, { status: 400 });
        }

        // 1. DB에 개별 테넌트 전용 API 키 및 설정 저장
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
            await supabase.from('tenant_settings').upsert({
                tenant_id: tenantId,
                company_name: body.companyName,
                company_english_name: body.companyEnglishName,
                manager_name: body.managerName,
                phone: body.phone,
                work_start_time: body.workStartTime,
                work_end_time: body.workEndTime,
                google_spreadsheet_id: sheetId,
                google_sheet_name: body.googleSheetName,
                google_client_email: body.googleClientEmail,
                google_private_key: body.googlePrivateKey,
                gemini_api_key: body.geminiApiKey,
                kakao_channel_id: body.kakaoChannelId,
                kakao_talk_id: body.kakaoTalkId,
                updated_at: new Date().toISOString()
            });
        }

        // 2. 설정이 저장되는 즉시, 빈 시트인 경우 사장님과 똑같은 클럽모두 표준 양식 탭을 즉각 자동 생성!
        if (sheetId && tenantId !== 'default_tenant') {
            try {
                const { getSheetsConfigForTenant, getOrCreateMonthlySheet } = await import('@/lib/google-sheets');
                const { sheets } = await getSheetsConfigForTenant(tenantId);
                const currentMonth = new Date().toISOString().substring(0, 7); // yyyy-MM
                await getOrCreateMonthlySheet(sheets, sheetId, currentMonth);
            } catch (e: any) {
                console.error('[Settings API] 구글 시트 양식 생성 오류:', e.message);
                return NextResponse.json({
                    success: true,
                    message: `설정은 저장되었으나 구글 시트 연동 오류가 발생했습니다: ${e.message}. 구글 시트 [공유] 설정에 이메일이 잘 들어갔는지 확인해 주세요.`
                });
            }
        }

        return NextResponse.json({ success: true, message: '🎉 설정 저장 및 전용 구글 시트 양식 생성이 완벽히 완료되었습니다!' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

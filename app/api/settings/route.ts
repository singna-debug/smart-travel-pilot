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

        // 설정 데이터가 없는 경우 기본 빈 설정 리턴
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

        // DB에 개별 테넌트 전용 API 키 및 설정 저장
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
            await supabase.from('tenant_settings').upsert({
                tenant_id: tenantId,
                company_name: body.companyName,
                company_english_name: body.companyEnglishName,
                manager_name: body.managerName,
                phone: body.phone,
                work_start_time: body.workStartTime,
                work_end_time: body.workEndTime,
                google_spreadsheet_id: body.googleSpreadsheetId,
                google_sheet_name: body.googleSheetName,
                google_client_email: body.googleClientEmail,
                google_private_key: body.googlePrivateKey,
                gemini_api_key: body.geminiApiKey,
                kakao_channel_id: body.kakaoChannelId,
                kakao_talk_id: body.kakaoTalkId,
                updated_at: new Date().toISOString()
            });
        }

        return NextResponse.json({ success: true, message: '설정이 성공적으로 저장되었습니다.' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

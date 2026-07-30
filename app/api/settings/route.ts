import { NextRequest, NextResponse } from 'next/server';
import { getTenantIdFromHeaderOrQuery, DEFAULT_TENANT_ID } from '@/lib/tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { getSheetsConfigForTenant, getOrCreateMonthlySheet } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantId = getTenantIdFromHeaderOrQuery(request);

        // 1. 마스터 계정은 .env.local 값으로 리턴
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
                    googleSheetName: '',
                    googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL?.trim() || '',
                    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY ? '••••••••••••••••' : '',
                    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
                    kakaoChannelId: '',
                    kakaoTalkId: '',
                }
            });
        }

        // 2. 일반 가입 유저 - supabaseAdmin으로 RLS 우회 조회
        if (supabaseAdmin) {
            const { data, error } = await supabaseAdmin
                .from('tenant_settings')
                .select('*')
                .eq('tenant_id', tenantId)
                .single();

            if (error) {
                console.error('[Settings GET] Supabase error:', error.message);
            }

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

        // 3. 설정 없으면 빈 값 반환 (초기 가입자)
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

        if (tenantId === DEFAULT_TENANT_ID) {
            return NextResponse.json({ success: false, error: '마스터 계정의 설정은 변경할 수 없습니다.' }, { status: 403 });
        }

        const body = await request.json();

        const sheetId = body.googleSpreadsheetId?.trim();
        if (sheetId && sheetId.includes('@')) {
            return NextResponse.json({ success: false, error: '⚠️ 올바른 구글 스프레드시트 ID를 입력해주세요. (이메일 주소는 시트 ID가 아닙니다.)' }, { status: 400 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Supabase가 연결되지 않았습니다.' }, { status: 500 });
        }

        // 마스킹 문자열(••••)이 실수로 저장되는 것 방지
        const privateKeyToSave = (body.googlePrivateKey && !body.googlePrivateKey.includes('•'))
            ? body.googlePrivateKey
            : undefined; // undefined면 기존 값 유지됨 (upsert 특성)

        // DB에 저장 (service_role로 RLS 우회)
        const upsertData: any = {
            tenant_id: tenantId,
            company_name: body.companyName || null,
            company_english_name: body.companyEnglishName || null,
            manager_name: body.managerName || null,
            phone: body.phone || null,
            work_start_time: body.workStartTime || '09:00',
            work_end_time: body.workEndTime || '18:00',
            google_spreadsheet_id: sheetId || null,
            google_sheet_name: body.googleSheetName || null,
            google_client_email: body.googleClientEmail || null,
            gemini_api_key: body.geminiApiKey || null,
            kakao_channel_id: body.kakaoChannelId || null,
            kakao_talk_id: body.kakaoTalkId || null,
            updated_at: new Date().toISOString(),
        };

        if (privateKeyToSave) {
            upsertData.google_private_key = privateKeyToSave;
        }

        const { error: upsertError } = await supabaseAdmin
            .from('tenant_settings')
            .upsert(upsertData, { onConflict: 'tenant_id' });

        if (upsertError) {
            console.error('[Settings POST] upsert error:', upsertError);
            return NextResponse.json({ success: false, error: `DB 저장 실패: ${upsertError.message}` }, { status: 500 });
        }

        // 구글 시트 월별 탭 자동 생성
        if (sheetId) {
            try {
                const { sheets } = await getSheetsConfigForTenant(tenantId);
                const currentMonth = new Date().toISOString().substring(0, 7);
                await getOrCreateMonthlySheet(sheets, sheetId, currentMonth);
            } catch (e: any) {
                console.error('[Settings API] 구글 시트 양식 생성 오류:', e.message);
                return NextResponse.json({
                    success: true,
                    message: `설정은 저장되었으나 구글 시트 연동 오류: ${e.message}\n\n📌 구글 시트 [공유] 버튼 → 아래 이메일을 편집자로 추가해주세요:\nclubmode-sheets@clubmode-travel.iam.gserviceaccount.com`
                });
            }
        }

        return NextResponse.json({ success: true, message: '✅ 설정이 저장되었습니다!' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

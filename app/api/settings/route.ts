import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getTenantIdFromHeaderOrQuery, DEFAULT_TENANT_ID } from '@/lib/tenant';
import { supabaseAdmin } from '@/lib/supabase';
import { getSheetsConfigForTenant, getOrCreateMonthlySheet } from '@/lib/google-sheets';
import { getLocalSettings, saveLocalSettings } from '@/lib/tenant-local-store';
import { setTelegramWebhook } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const tenantId = getTenantIdFromHeaderOrQuery(request);
        const local = getLocalSettings(tenantId);

        // 1. Supabase에서 해당 테넌트 설정 우선 조회
        if (supabaseAdmin) {
            const { data } = await supabaseAdmin
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
                        googleSpreadsheetId: data.google_spreadsheet_id || (tenantId === DEFAULT_TENANT_ID ? process.env.GOOGLE_SHEET_ID?.trim() || '' : ''),
                        googleSheetName: data.google_sheet_name || '',
                        googleClientEmail: data.google_client_email || '',
                        googlePrivateKey: data.google_private_key ? '••••••••' : '',
                        geminiApiKey: data.gemini_api_key || (tenantId === DEFAULT_TENANT_ID ? process.env.GEMINI_API_KEY?.trim() || '' : ''),
                        kakaoChannelId: data.kakao_channel_id || '',
                        kakaoTalkId: data.kakao_talk_id || '',
                        telegramBotToken: data.telegram_bot_token || local.telegramBotToken || (tenantId === DEFAULT_TENANT_ID ? process.env.TELEGRAM_BOT_TOKEN?.trim() || '' : ''),
                        telegramChatId: data.telegram_chat_id || local.telegramChatId || (tenantId === DEFAULT_TENANT_ID ? process.env.TELEGRAM_CHAT_ID?.trim() || '' : ''),
                        telegramNotifyEnabled: data.telegram_notify_enabled ?? local.telegramNotifyEnabled ?? true,
                    }
                });
            }
        }

        // 2. 데이터가 없는데 마스터 계정인 경우 .env.local fallback
        if (tenantId === DEFAULT_TENANT_ID) {
            return NextResponse.json({
                success: true,
                settings: {
                    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || '',
                    companyEnglishName: process.env.NEXT_PUBLIC_COMPANY_ENG_NAME || '',
                    managerName: process.env.NEXT_PUBLIC_MANAGER_NAME || '',
                    phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '',
                    workStartTime: '09:00',
                    workEndTime: '18:00',
                    googleSpreadsheetId: process.env.GOOGLE_SHEET_ID?.trim() || '',
                    googleSheetName: '',
                    googleClientEmail: process.env.GOOGLE_CLIENT_EMAIL?.trim() || '',
                    googlePrivateKey: process.env.GOOGLE_PRIVATE_KEY ? '••••••••••••••••' : '',
                    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
                    kakaoChannelId: '',
                    kakaoTalkId: '',
                    telegramBotToken: local.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN?.trim() || '',
                    telegramChatId: local.telegramChatId || process.env.TELEGRAM_CHAT_ID?.trim() || '',
                    telegramNotifyEnabled: local.telegramNotifyEnabled ?? true,
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
                        telegramBotToken: data.telegram_bot_token || local.telegramBotToken || '',
                        telegramChatId: data.telegram_chat_id || local.telegramChatId || '',
                        telegramNotifyEnabled: data.telegram_notify_enabled ?? local.telegramNotifyEnabled ?? true,
                    }
                });
            }
        }

        // 3. 설정 없으면 로컬 스토어 fallback 반환
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
                telegramBotToken: local.telegramBotToken || '',
                telegramChatId: local.telegramChatId || '',
                telegramNotifyEnabled: local.telegramNotifyEnabled ?? true,
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

        if (!supabaseAdmin) {
            return NextResponse.json({ success: false, error: 'Supabase가 연결되지 않았습니다.' }, { status: 500 });
        }

        // 마스킹 문자열(••••)이 실수로 저장되는 것 방지
        const privateKeyToSave = (body.googlePrivateKey && !body.googlePrivateKey.includes('•'))
            ? body.googlePrivateKey
            : undefined; // undefined면 기존 값 유지됨 (upsert 특성)

        // 봇 토큰이 저장되면, 모든 테넌트가 공유하는 웹훅 URL(/api/telegram-webhook)에서
        // "이 요청이 어느 테넌트 봇에서 왔는지" 구분할 수 있도록 테넌트별 고유 secret_token을
        // 발급해 텔레그램에 setWebhook으로 등록한다. (같은 사람이 여러 테넌트 봇을 자기
        // 텔레그램 계정으로 테스트하면 chat_id만으로는 구분이 안 되기 때문)
        const existingSecret = getLocalSettings(tenantId).telegramWebhookSecret;
        let webhookSecret = existingSecret;
        let webhookSetupWarning = '';

        if (body.telegramBotToken) {
            if (!webhookSecret) {
                webhookSecret = crypto.randomBytes(24).toString('hex');
            }
            const baseUrl = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';

            // 텔레그램 setWebhook은 반드시 공개 HTTPS 주소여야 함 - localhost(로컬 개발)는
            // 애초에 텔레그램이 접근할 수 없으므로 등록을 시도하지 않고 시크릿만 저장한다.
            // (로컬에서는 scripts/telegram-poller.ts가 getUpdates로 직접 폴링하면서
            //  이 시크릿을 헤더에 실어 전달하므로 setWebhook 등록 없이도 동작함)
            if (baseUrl.startsWith('https://')) {
                const webhookResult = await setTelegramWebhook(
                    body.telegramBotToken,
                    `${baseUrl}/api/telegram-webhook`,
                    webhookSecret
                );
                if (!webhookResult.success) {
                    console.error('[Settings POST] setTelegramWebhook failed:', webhookResult.error);
                    webhookSetupWarning = `\n\n⚠️ 텔레그램 웹훅 등록 실패: ${webhookResult.error} (Bot Token을 다시 확인해주세요)`;
                }
            } else {
                console.log('[Settings POST] Skipping setWebhook registration (non-HTTPS/local origin):', baseUrl || '(unknown)');
            }
        }

        // 로컬 영구 파일 스토어에 우선 저장 (Supabase DB 테이블 스키마에 컬럼이 없어도 유실되지 않음)
        saveLocalSettings(tenantId, {
            companyName: body.companyName || '',
            companyEnglishName: body.companyEnglishName || '',
            managerName: body.managerName || '',
            phone: body.phone || '',
            kakaoChannelId: body.kakaoChannelId || '',
            kakaoTalkId: body.kakaoTalkId || '',
            telegramBotToken: body.telegramBotToken || '',
            telegramChatId: body.telegramChatId || '',
            telegramNotifyEnabled: body.telegramNotifyEnabled ?? true,
            telegramWebhookSecret: webhookSecret || '',
        });
        // 주의: 여기서 process.env.TELEGRAM_BOT_TOKEN을 덮어쓰면 서버 프로세스를 공유하는
        // 다른 모든 테넌트의 텔레그램 발송/수신에 영향을 주므로 절대 사용하지 않음.
        // 테넌트별 봇 설정은 반드시 tenant_settings(DB)/local-settings.json에서 tenantId로 조회한다.

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
            telegram_bot_token: body.telegramBotToken || null,
            telegram_chat_id: body.telegramChatId || null,
            telegram_notify_enabled: body.telegramNotifyEnabled ?? true,
            telegram_webhook_secret: webhookSecret || null,
            updated_at: new Date().toISOString(),
        };

        if (privateKeyToSave) {
            upsertData.google_private_key = privateKeyToSave;
        }

        let { error: upsertError } = await supabaseAdmin
            .from('tenant_settings')
            .upsert(upsertData, { onConflict: 'tenant_id' });

        // Supabase DB에 telegram 관련 컬럼이 미처 생성되지 않았을 경우 fallback 리트라이
        if (upsertError && upsertError.message.includes('telegram')) {
            console.warn('[Settings POST] Telegram columns missing in DB table tenant_settings, retrying without telegram columns...');
            delete upsertData.telegram_bot_token;
            delete upsertData.telegram_chat_id;
            delete upsertData.telegram_notify_enabled;
            delete upsertData.telegram_webhook_secret;
            const retryRes = await supabaseAdmin
                .from('tenant_settings')
                .upsert(upsertData, { onConflict: 'tenant_id' });
            upsertError = retryRes.error;
        }

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

        return NextResponse.json({ success: true, message: `✅ 설정이 저장되었습니다!${webhookSetupWarning}` });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

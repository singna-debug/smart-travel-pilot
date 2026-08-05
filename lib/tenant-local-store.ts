import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join(process.cwd(), 'lib', 'local-settings.json');

export interface LocalTenantSettings {
    companyName?: string;
    companyEnglishName?: string;
    managerName?: string;
    phone?: string;
    kakaoChannelId?: string;
    kakaoTalkId?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
    telegramNotifyEnabled?: boolean;
    telegramWebhookSecret?: string;
    geminiApiKey?: string;
    [key: string]: any;
}

export function getLocalSettings(tenantId: string = 'default_tenant'): LocalTenantSettings {
    try {
        if (fs.existsSync(STORE_PATH)) {
            const raw = fs.readFileSync(STORE_PATH, 'utf-8');
            const data = JSON.parse(raw);
            // 주의: 예전에는 여기서 요청한 tenantId에 값이 비어있으면 다른 테넌트의
            // companyName/telegramBotToken 등을 대신 빌려오는 로직이 있었는데, 멀티테넌트
            // 환경에서는 이게 그대로 다른 회사 정보가 새는 버그였다. 반드시 해당 tenantId
            // 자신의 값만 반환한다.
            return data[tenantId] ? { ...data[tenantId] } : {};
        }
    } catch (e) {
        console.error('[LocalSettings] Failed to read local-settings.json:', e);
    }
    return {};
}

export function saveLocalSettings(tenantId: string = 'default_tenant', settings: LocalTenantSettings) {
    try {
        let store: Record<string, LocalTenantSettings> = {};
        if (fs.existsSync(STORE_PATH)) {
            try {
                store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
            } catch (e) {
                store = {};
            }
        }
        store[tenantId] = {
            ...(store[tenantId] || {}),
            ...settings,
            updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
        console.log(`[LocalSettings] Saved local settings for tenant [${tenantId}] successfully.`);
    } catch (e) {
        console.error('[LocalSettings] Failed to write local-settings.json:', e);
    }
}

export async function getAsyncTenantSettings(tenantId: string = 'default_tenant'): Promise<LocalTenantSettings> {
    try {
        const local = getLocalSettings(tenantId);

        // Try fetching from Supabase DB tenant_settings (반드시 요청한 tenantId로 필터링)
        const { supabaseAdmin } = await import('./supabase');
        if (supabaseAdmin) {
            const { data: row, error } = await supabaseAdmin
                .from('tenant_settings')
                .select('*')
                .eq('tenant_id', tenantId)
                .single();
            if (!error && row) {
                const dbSettings: LocalTenantSettings = {
                    companyName: row.company_name || local.companyName || '',
                    companyEnglishName: row.company_english_name || local.companyEnglishName || '',
                    managerName: row.manager_name || local.managerName || '',
                    phone: row.phone || local.phone || '',
                    kakaoChannelId: row.kakao_channel_id || local.kakaoChannelId || '',
                    kakaoTalkId: row.kakao_talk_id || local.kakaoTalkId || '',
                    telegramBotToken: row.telegram_bot_token || local.telegramBotToken || '',
                    telegramChatId: row.telegram_chat_id || local.telegramChatId || '',
                    telegramNotifyEnabled: row.telegram_notify_enabled ?? local.telegramNotifyEnabled ?? true,
                };
                saveLocalSettings(tenantId, dbSettings);
                return dbSettings;
            }
        }
        return local;
    } catch (e) {
        console.error('[LocalSettings] getAsyncTenantSettings error:', e);
        return getLocalSettings(tenantId);
    }
}

export interface TelegramTenantConfig {
    tenantId: string;
    botToken: string;
    chatId: string;
    managerName?: string;
    notifyEnabled: boolean;
    webhookSecret?: string;
}

/**
 * 텔레그램 설정이 등록된 모든 테넌트 목록을 반환합니다.
 * (매일 아침 알림 크론잡 - 전 테넌트 순회 발송에 사용)
 */
export async function getAllTelegramTenantConfigs(): Promise<TelegramTenantConfig[]> {
    const results = new Map<string, TelegramTenantConfig>();

    try {
        const { supabaseAdmin } = await import('./supabase');
        if (supabaseAdmin) {
            const { data, error } = await supabaseAdmin
                .from('tenant_settings')
                .select('tenant_id, telegram_bot_token, telegram_chat_id, telegram_notify_enabled, telegram_webhook_secret, manager_name');
            if (!error && data) {
                data.forEach((row: any) => {
                    if (row.telegram_bot_token && row.telegram_chat_id) {
                        results.set(row.tenant_id, {
                            tenantId: row.tenant_id,
                            botToken: row.telegram_bot_token,
                            chatId: row.telegram_chat_id,
                            managerName: row.manager_name || undefined,
                            notifyEnabled: row.telegram_notify_enabled ?? true,
                            webhookSecret: row.telegram_webhook_secret || undefined,
                        });
                    }
                });
            }
        }
    } catch (e) {
        console.error('[TelegramTenantConfig] Supabase lookup error:', e);
    }

    // 로컬 파일 스토어 (DB 컬럼 마이그레이션 전/누락분 호환)
    try {
        if (fs.existsSync(STORE_PATH)) {
            const store = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
            Object.keys(store).forEach(tenantId => {
                if (results.has(tenantId)) return;
                const s = store[tenantId];
                if (s?.telegramBotToken && s?.telegramChatId) {
                    results.set(tenantId, {
                        tenantId,
                        botToken: s.telegramBotToken,
                        chatId: s.telegramChatId,
                        managerName: s.managerName || undefined,
                        notifyEnabled: s.telegramNotifyEnabled ?? true,
                        webhookSecret: s.telegramWebhookSecret || undefined,
                    });
                }
            });
        }
    } catch (e) {}

    // 레거시 단일 테넌트(.env) 설정 - default_tenant가 DB/파일에 아직 없을 때만 fallback
    if (!results.has('default_tenant')) {
        const envToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
        const envChatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
        if (envToken && envChatId) {
            results.set('default_tenant', {
                tenantId: 'default_tenant',
                botToken: envToken,
                chatId: envChatId,
                notifyEnabled: true,
            });
        }
    }

    return Array.from(results.values());
}

/**
 * 텔레그램 웹훅 요청에 실려온 시크릿 토큰(X-Telegram-Bot-Api-Secret-Token)으로
 * 어느 테넌트 봇인지 찾습니다. 봇마다 고유하므로 chat_id가 겹쳐도(같은 사람이 여러
 * 테넌트 봇을 자기 계정으로 테스트하는 경우) 정확히 구분됩니다. 1순위 식별 수단.
 */
export async function resolveTenantByWebhookSecret(secret: string | null | undefined): Promise<TelegramTenantConfig | null> {
    const clean = (secret || '').trim();
    if (!clean) return null;

    const all = await getAllTelegramTenantConfigs();
    return all.find(c => c.webhookSecret && c.webhookSecret === clean) || null;
}

/**
 * 텔레그램 웹훅으로 들어온 chat_id가 어느 테넌트 소속인지 찾습니다.
 * (시크릿 토큰이 없는 레거시 설정 - 예: .env로만 구성된 default_tenant - 를 위한 2순위 fallback.
 *  같은 chat_id를 여러 테넌트가 공유하면 구분이 불가능하므로 항상 secret_token을 우선 사용해야 함)
 */
export async function resolveTenantByTelegramChatId(incomingChatId: string): Promise<TelegramTenantConfig | null> {
    const clean = (incomingChatId || '').trim();
    if (!clean) return null;

    const all = await getAllTelegramTenantConfigs();
    return all.find(c => String(c.chatId).trim() === clean) || null;
}

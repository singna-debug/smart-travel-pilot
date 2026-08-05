import fetch from 'node-fetch';
import { getAllTelegramTenantConfigs } from '../lib/tenant-local-store';

const LOCAL_WEBHOOK_URL = 'http://localhost:3000/api/telegram-webhook';

// 테넌트별로 하나씩 - 등록된 모든 봇(default_tenant + 신규 테넌트들)을 동시에 롱폴링한다.
// getUpdates로 받은 업데이트에는 텔레그램이 실제 웹훅 푸시 때만 붙여주는
// X-Telegram-Bot-Api-Secret-Token 헤더가 없으므로, 폴러가 "이 업데이트는 이 테넌트 봇에서
// 왔다"는 사실을 알고 있는 김에 직접 그 헤더를 만들어 붙여서 전달한다.
// (그래야 여러 테넌트가 같은 chat_id로 테스트해도 웹훅이 정확히 구분할 수 있음)
async function pollBot(tenantId: string, token: string, webhookSecret?: string) {
    let lastUpdateId = 0;
    console.log(`🚀 [Telegram Local Poller] Starting long polling for tenant [${tenantId}]...`);

    while (true) {
        try {
            const pollUrl = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
            const response = await fetch(pollUrl);
            const data: any = await response.json();

            if (data.ok && Array.isArray(data.result)) {
                for (const update of data.result) {
                    lastUpdateId = update.update_id;
                    console.log(`📩 [Telegram Poller][${tenantId}] Incoming message from Chat [${update.message?.chat?.id}]: "${update.message?.text}"`);

                    // Forward to local webhook endpoint
                    try {
                        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                        if (webhookSecret) headers['X-Telegram-Bot-Api-Secret-Token'] = webhookSecret;
                        const res = await fetch(LOCAL_WEBHOOK_URL, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(update),
                        });
                        const resData = await res.json();
                        console.log(`✅ [Telegram Poller][${tenantId}] Local Webhook response:`, resData);
                    } catch (e: any) {
                        console.error(`❌ [Telegram Poller][${tenantId}] Failed to forward to local webhook:`, e.message);
                    }
                }
            } else if (!data.ok) {
                console.error(`⚠️ [Telegram Poller][${tenantId}] Telegram API error:`, data.description);
                await new Promise(res => setTimeout(res, 5000));
            }
        } catch (error: any) {
            console.error(`❌ [Telegram Poller][${tenantId}] Polling exception:`, error.message);
            await new Promise(res => setTimeout(res, 5000));
        }
    }
}

async function startPoller() {
    const seenTenants = new Set<string>();

    while (true) {
        const configs = await getAllTelegramTenantConfigs();
        for (const cfg of configs) {
            if (seenTenants.has(cfg.tenantId)) continue;
            seenTenants.add(cfg.tenantId);
            // 새로 발견된 테넌트 봇은 별도 루프로 계속 폴링 (await 하지 않고 백그라운드로 실행)
            pollBot(cfg.tenantId, cfg.botToken, cfg.webhookSecret);
        }

        if (seenTenants.size === 0) {
            console.log('⏳ [Telegram Poller] No telegram bots configured yet. Retrying in 5 seconds...');
        }

        // 새 테넌트가 봇을 등록했는지 주기적으로 확인
        await new Promise(res => setTimeout(res, 30000));
    }
}

startPoller();

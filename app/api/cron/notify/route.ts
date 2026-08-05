import { NextRequest, NextResponse } from 'next/server';
import { getTodayNotificationMessage, getTodayKST, getNowKSTTime } from '@/lib/notifications-logic';
import { sendTelegramMessage } from '@/lib/telegram';
import { getAllTelegramTenantConfigs, markTenantNotifiedToday } from '@/lib/tenant-local-store';

/**
 * GET /api/cron/notify
 * 텔레그램 매일 아침 업무 알림 크론 잡.
 * 테넌트별로 설정한 발송 시각(telegramNotifyTime)을 각자의 봇으로 발송한다.
 * vercel.json에서 이 라우트를 짧은 간격(예: 10분)으로 계속 호출하고, 여기서
 * "지금이 그 테넌트의 발송 시각을 지났고 오늘 아직 안 보냈는지"를 판단해 실제 발송 여부를 정한다.
 */
export async function GET(request: NextRequest) {
    try {
        // 보안 검사 (선택 사항: Vercel Cron Secret 등)
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        // 로컬 개발 환경이 아니고 시크릿이 설정되어 있는데 일치하지 않으면 차단
        if (process.env.NODE_ENV === 'production' && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const today = getTodayKST();
        const nowTime = getNowKSTTime();

        const tenants = await getAllTelegramTenantConfigs();
        const results: any[] = [];

        for (const tenant of tenants) {
            if (!tenant.notifyEnabled) {
                results.push({ tenantId: tenant.tenantId, skipped: 'notify disabled' });
                continue;
            }
            if (tenant.lastNotifiedDate === today) {
                results.push({ tenantId: tenant.tenantId, skipped: 'already sent today' });
                continue;
            }
            if (nowTime < tenant.notifyTime) {
                results.push({ tenantId: tenant.tenantId, skipped: `not yet (target ${tenant.notifyTime}, now ${nowTime})` });
                continue;
            }
            try {
                const message = await getTodayNotificationMessage(tenant.tenantId);
                if (!message) {
                    results.push({ tenantId: tenant.tenantId, skipped: 'no notification today' });
                    // 보낼 내용이 없어도 오늘 발송 시각은 지났으므로 다시 재확인하지 않도록 완료 처리
                    await markTenantNotifiedToday(tenant.tenantId, today);
                    continue;
                }
                const result = await sendTelegramMessage(message, tenant.chatId, tenant.botToken);
                if (result.success) {
                    await markTenantNotifiedToday(tenant.tenantId, today);
                }
                results.push({ tenantId: tenant.tenantId, success: result.success, error: result.error });
            } catch (e: any) {
                console.error(`[Cron] Error notifying tenant ${tenant.tenantId}:`, e.message);
                results.push({ tenantId: tenant.tenantId, success: false, error: e.message });
            }
        }

        return NextResponse.json({ success: true, today, nowTime, results });

    } catch (error: any) {
        console.error('[Cron] Error in notify route:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

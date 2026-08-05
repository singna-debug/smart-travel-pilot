import { NextRequest, NextResponse } from 'next/server';
import { getTodayNotificationMessage } from '@/lib/notifications-logic';
import { sendTelegramMessage } from '@/lib/telegram';
import { getAllTelegramTenantConfigs } from '@/lib/tenant-local-store';

/**
 * GET /api/cron/notify
 * 텔레그램 매일 아침 업무 알림 크론 잡 (텔레그램이 연동된 모든 테넌트에 각자의 봇으로 발송)
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

        const tenants = await getAllTelegramTenantConfigs();
        const results: any[] = [];

        for (const tenant of tenants) {
            if (!tenant.notifyEnabled) {
                results.push({ tenantId: tenant.tenantId, skipped: 'notify disabled' });
                continue;
            }
            try {
                const message = await getTodayNotificationMessage(tenant.tenantId);
                if (!message) {
                    results.push({ tenantId: tenant.tenantId, skipped: 'no notification today' });
                    continue;
                }
                const result = await sendTelegramMessage(message, tenant.chatId, tenant.botToken);
                results.push({ tenantId: tenant.tenantId, success: result.success, error: result.error });
            } catch (e: any) {
                console.error(`[Cron] Error notifying tenant ${tenant.tenantId}:`, e.message);
                results.push({ tenantId: tenant.tenantId, success: false, error: e.message });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error('[Cron] Error in notify route:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { getTodayNotificationMessage } from '@/lib/notifications-logic';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * GET /api/cron/notify
 * 텔레그램 매일 아침 업무 알림 크론 잡
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

        const message = await getTodayNotificationMessage();

        if (!message) {
            console.log('[Cron] No notifications for today.');
            return NextResponse.json({ success: true, message: 'No notification needed today' });
        }

        const result = await sendTelegramMessage(message);

        if (result.success) {
            return NextResponse.json({ success: true, message: 'Telegram notification sent' });
        } else {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 });
        }

    } catch (error: any) {
        console.error('[Cron] Error in notify route:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

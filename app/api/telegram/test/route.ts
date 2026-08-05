import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage, getTelegramWelcomeGuide } from '@/lib/telegram';
import { saveLocalSettings } from '@/lib/tenant-local-store';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { telegramBotToken, telegramChatId } = body;

        if (!telegramBotToken || !telegramChatId) {
            return NextResponse.json({
                success: false,
                error: '텔레그램 Bot Token과 Chat ID를 모두 입력해주세요.'
            }, { status: 400 });
        }

        saveLocalSettings('default_tenant', {
            telegramBotToken,
            telegramChatId,
            telegramNotifyEnabled: true,
        });
        process.env.TELEGRAM_BOT_TOKEN = telegramBotToken;
        process.env.TELEGRAM_CHAT_ID = telegramChatId;

        const testMessage = getTelegramWelcomeGuide();

        const result = await sendTelegramMessage(testMessage, telegramChatId, telegramBotToken);

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: '텔레그램 테스트 메시지가 성공적으로 발송되었습니다! 텔레그램 대화창을 확인해보세요.'
            });
        } else {
            return NextResponse.json({
                success: false,
                error: `텔레그램 전송 실패: ${result.error}`
            }, { status: 400 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

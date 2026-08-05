import { getLocalSettings } from './tenant-local-store';

export const DEFAULT_TELEGRAM_KEYBOARD = {
    keyboard: [
        [
            { text: '📝 상담 등록' },
            { text: '🔍 URL 분석' }
        ],
        [
            { text: '💬 멘트 등록' },
            { text: '📅 오늘 일정' }
        ]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
};

export async function sendTelegramMessage(
    message: string,
    overrideChatId?: string,
    overrideToken?: string,
    replyMarkup: any = DEFAULT_TELEGRAM_KEYBOARD
): Promise<{ success: boolean; error?: string }> {
    const local = getLocalSettings();
    const token = overrideToken || process.env.TELEGRAM_BOT_TOKEN || local.telegramBotToken;
    const chatId = overrideChatId || process.env.TELEGRAM_CHAT_ID || local.telegramChatId;

    if (!token || !chatId) {
        console.error('[Telegram] Missing token or chatId');
        return { success: false, error: '텔레그램 Bot Token 또는 Chat ID가 설정되지 않았습니다.' };
    }

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const payload: any = {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
        };

        if (replyMarkup) {
            payload.reply_markup = replyMarkup;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (response.ok && data.ok) {
            return { success: true };
        } else {
            console.error('[Telegram] API Error:', data);
            return { success: false, error: data.description || 'Unknown Telegram API error' };
        }
    } catch (error: any) {
        console.error('[Telegram] Fetch Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 텔레그램 봇의 웹훅 URL을 등록하고, secret_token을 함께 설정합니다.
 * 모든 테넌트의 봇이 동일한 웹훅 URL(/api/telegram-webhook)을 공유하므로,
 * 어느 봇에서 들어온 요청인지 구분하려면 봇별 고유 secret_token이 필요합니다.
 * (Telegram이 요청마다 X-Telegram-Bot-Api-Secret-Token 헤더로 그대로 돌려줌)
 */
export async function setTelegramWebhook(
    botToken: string,
    webhookUrl: string,
    secretToken: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: webhookUrl, secret_token: secretToken }),
        });
        const data = await response.json();
        if (response.ok && data.ok) {
            return { success: true };
        }
        return { success: false, error: data.description || 'Unknown Telegram API error' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export function getTelegramWelcomeGuide(managerName?: string): string {
    const name = managerName ? `${managerName} ` : '';
    return `🎉 <b>[스마트 트래블 파일럿] 텔레그램 연동 성공!</b>

안녕하세요, ${name}관리자님! 스마트 트래블 파일럿 알림봇이 성공적으로 연결되었습니다. 🚀

-----------------------------------
📋 <b>[주요 기능 및 텔레그램 사용법 안내]</b>

1️⃣ <b>매일 아침 자동 스케줄 알림 ☀️</b>
   • 매일 아침 당일 처리해야 할 <b>상담, 리마인드, 선금/잔금 요청, 가이드북 발송, 출발안내 등 업무 요약</b>이 이 채널로 자동 전송됩니다.

2️⃣ <b>퇴근 후 / 이동 중 전화 문의 자동 등록 📲</b>
   • 퇴근 후나 외부 이동 중에 받은 손님 전화 문의를 이 텔레그램 대화창에 <b>자유로운 문장</b>으로 적어 보내주세요!
   • <b>입력 예시:</b>
     <i>"유수진 010-2614-4122 블로그 보고 전화옴 일본 6월 3박4일 패키지"</i>
   • AI가 고객명, 연락처, 목적지, 유입경로, 문의내용을 자동 분석하여 <b>구글 시트 및 대시보드</b>에 '상담중'으로 자동 기입하고, 출근 시 <b>상단 '확인필요' 배너 알림</b>을 띄워 드립니다.

3️⃣ <b>실시간 예약 및 중요 상태 알림 🔔</b>
   • 신규 예약 및 중요 스케줄 상태 변경 시 이 채널로 알림이 발송됩니다.

-----------------------------------
💡 <i>지금 이 텔레그램 대화창에 손님 문의 예시 문장을 입력하여 자유롭게 테스트해보세요!</i>`;
}



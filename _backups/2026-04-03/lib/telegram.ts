/**
 * Telegram API Utility
 */

export async function sendTelegramMessage(message: string): Promise<{ success: boolean; error?: string }> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.error('[Telegram] Missing environment variables: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
        return { success: false, error: 'Telegram environment variables missing' };
    }

    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML', // Supports <b>, <i>, <a> etc.
            }),
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

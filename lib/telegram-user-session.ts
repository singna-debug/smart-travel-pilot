export interface TelegramSession {
    step: 'IDLE' | 'AWAITING_CUSTOMER_SEARCH' | 'AWAITING_MANUAL_INPUT';
    templateType?: string;
    updatedAt: number;
}

const sessions: Map<string, TelegramSession> = new Map();

export function getTelegramSession(chatId: string): TelegramSession {
    const s = sessions.get(chatId);
    // 15분 지나면 자동 초기화
    if (s && Date.now() - s.updatedAt > 15 * 60 * 1000) {
        sessions.delete(chatId);
        return { step: 'IDLE', updatedAt: Date.now() };
    }
    return s || { step: 'IDLE', updatedAt: Date.now() };
}

export function setTelegramSession(chatId: string, data: Partial<TelegramSession>) {
    const current = getTelegramSession(chatId);
    sessions.set(chatId, {
        ...current,
        ...data,
        updatedAt: Date.now(),
    });
}

export function clearTelegramSession(chatId: string) {
    sessions.delete(chatId);
}

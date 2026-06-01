import { ConsultationData } from '@/types';

// 메시지 타입
export interface StoredMessage {
    id: string;
    visitorId: string;
    visitorName: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

// 상담 세션 타입
export interface ChatSession {
    id: string;
    visitorId: string;
    visitorName: string;
    visitorPhone: string;
    destination: string;
    productName: string;
    departureDate: string;
    productUrl: string;
    status: ConsultationData['automation']['status'];
    messages: StoredMessage[];
    lastMessageAt: Date;
    createdAt: Date;
    automationDates: {
        balanceDueDate: string;
        noticeDate: string;
        nextFollowup: string;
    };
    sheetRowIndex?: number;
}

// 활동 로그 타입
export interface ActivityLog {
    id: string;
    type: 'chat_start' | 'status_change' | 'friend_add' | 'payment' | 'booking';
    message: string;
    visitorName?: string;
    destination?: string;
    timestamp: Date;
}

// 통계 타입
export interface DashboardStats {
    weeklyChats: number;
    weeklyFriendAdds: number;
    confirmedBookings: number;
    completedPayments: number;
    dailyChatCounts: { date: string; count: number }[];
}

// 인메모리 저장소
class MessageStore {
    private sessions: Map<string, ChatSession> = new Map();
    private activityLogs: ActivityLog[] = [];
    private systemLogs: { timestamp: string; level: string; message: string; data?: any }[] = [];
    private friendAddCount: number = 0;

    async addSystemLog(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any): Promise<void> {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        };

        this.systemLogs.unshift(logEntry);
        if (this.systemLogs.length > 100) this.systemLogs = this.systemLogs.slice(0, 100);

        // Supabase에 영구 기록 시도
        try {
            const { supabase } = await import('./supabase');
            if (supabase) {
                await supabase.from('system_logs').insert({
                    level,
                    message,
                    data_json: data ? JSON.stringify(data) : null
                });
            }
        } catch (e) {
            console.error('Supabase System Log failed:', e);
        }
    }

    getSystemLogs() {
        return this.systemLogs;
    }

    async getPersistentLogs() {
        try {
            const { supabase } = await import('./supabase');
            if (supabase) {
                const { data } = await supabase
                    .from('system_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
                return data || [];
            }
        } catch (e) {
            return [];
        }
        return [];
    }

    upsertSession(visitorId: string, data: Partial<ChatSession>): ChatSession {
        let session = this.sessions.get(visitorId);

        if (!session) {
            session = {
                id: visitorId,
                visitorId: visitorId,
                visitorName: data.visitorName || '미정',
                visitorPhone: data.visitorPhone || '미정',
                destination: data.destination || '',
                productName: data.productName || '',
                departureDate: data.departureDate || '',
                productUrl: data.productUrl || '',
                status: '상담중',
                messages: [],
                lastMessageAt: new Date(),
                createdAt: new Date(),
                automationDates: data.automationDates || {
                    balanceDueDate: '',
                    noticeDate: '',
                    nextFollowup: '',
                },
            };

            this.addActivityLog({
                type: 'chat_start',
                message: `${session.visitorName}님 상담 시작`,
                visitorName: session.visitorName,
                destination: session.destination || undefined,
            });
        }

        if (data.visitorName) session.visitorName = data.visitorName;
        if (data.visitorPhone) session.visitorPhone = data.visitorPhone;
        if (data.destination) session.destination = data.destination;
        if (data.productName) session.productName = data.productName;
        if (data.departureDate) session.departureDate = data.departureDate;
        if (data.productUrl) session.productUrl = data.productUrl;
        if (data.automationDates) session.automationDates = data.automationDates;
        if (data.sheetRowIndex) session.sheetRowIndex = data.sheetRowIndex;

        if (data.status && data.status !== session.status) {
            const oldStatus = session.status;
            session.status = data.status;

            this.addActivityLog({
                type: 'status_change',
                message: `${session.visitorName}님 상태 변경: ${oldStatus} → ${data.status}`,
                visitorName: session.visitorName,
            });

            if (data.status === '결제완료') {
                this.addActivityLog({
                    type: 'payment',
                    message: `${session.visitorName}님 결제 완료 (${session.destination})`,
                    visitorName: session.visitorName,
                    destination: session.destination,
                });
            } else if (data.status === '예약확정') {
                this.addActivityLog({
                    type: 'booking',
                    message: `${session.visitorName}님 예약 확정 (${session.destination})`,
                    visitorName: session.visitorName,
                    destination: session.destination,
                });
            }
        }

        session.lastMessageAt = new Date();
        this.sessions.set(visitorId, session);

        return session;
    }

    addMessage(visitorId: string, role: 'user' | 'assistant', content: string): StoredMessage {
        const session = this.sessions.get(visitorId);
        if (!session) {
            throw new Error('Session not found');
        }

        const message: StoredMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            visitorId,
            visitorName: session.visitorName,
            role,
            content,
            timestamp: new Date(),
        };

        session.messages.push(message);
        session.lastMessageAt = new Date();
        this.sessions.set(visitorId, session);

        return message;
    }

    getSession(visitorId: string): ChatSession | undefined {
        return this.sessions.get(visitorId);
    }

    getAllSessions(): ChatSession[] {
        return Array.from(this.sessions.values())
            .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
    }

    getSessionsByStatus(status: ConsultationData['automation']['status']): ChatSession[] {
        return this.getAllSessions().filter(s => s.status === status);
    }

    addActivityLog(data: Omit<ActivityLog, 'id' | 'timestamp'>): void {
        this.activityLogs.unshift({
            ...data,
            id: `log-${Date.now()}`,
            timestamp: new Date(),
        });

        if (this.activityLogs.length > 1000) {
            this.activityLogs = this.activityLogs.slice(0, 1000);
        }
    }

    getActivityLogs(limit: number = 50): ActivityLog[] {
        return this.activityLogs.slice(0, limit);
    }

    recordFriendAdd(count: number = 1): void {
        this.friendAddCount += count;
        this.addActivityLog({
            type: 'friend_add',
            message: `새 친구 추가 (+${count}명)`,
        });
    }

    getStats(): DashboardStats {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const sessions = this.getAllSessions();
        const weeklyChats = sessions.filter(s => s.createdAt >= oneWeekAgo).length;
        const confirmedBookings = sessions.filter(s => s.status === '예약확정').length;
        const completedPayments = sessions.filter(s => s.status === '결제완료').length;

        const dailyCounts: { [key: string]: number } = {};
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyCounts[dateStr] = 0;
        }

        sessions.forEach(session => {
            const dateStr = session.createdAt.toISOString().split('T')[0];
            if (dailyCounts[dateStr] !== undefined) {
                dailyCounts[dateStr]++;
            }
        });

        return {
            weeklyChats,
            weeklyFriendAdds: this.friendAddCount,
            confirmedBookings,
            completedPayments,
            dailyChatCounts: Object.entries(dailyCounts).map(([date, count]) => ({ date, count })),
        };
    }

    searchSessions(query: string): ChatSession[] {
        const lowerQuery = query.toLowerCase();
        return this.getAllSessions().filter(s =>
            s.visitorName.toLowerCase().includes(lowerQuery) ||
            s.destination.toLowerCase().includes(lowerQuery) ||
            s.productName.toLowerCase().includes(lowerQuery)
        );
    }
}

export const messageStore = new MessageStore();

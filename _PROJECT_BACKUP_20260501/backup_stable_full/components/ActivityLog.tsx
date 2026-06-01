'use client';

import { useEffect, useState } from 'react';

interface ActivityLogItem {
    id: string;
    type: string;
    message: string;
    visitorName?: string;
    destination?: string;
    timestamp: string;
}

interface ActivityLogProps {
    limit?: number;
    showHeader?: boolean;
}

const typeIcons: Record<string, string> = {
    chat_start: '💬',
    status_change: '🔄',
    friend_add: '👥',
    payment: '💰',
    booking: '✅',
};

export default function ActivityLog({ limit = 10, showHeader = true }: ActivityLogProps) {
    const [logs, setLogs] = useState<ActivityLogItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
        // 30초마다 갱신
        const interval = setInterval(fetchLogs, 30000);
        return () => clearInterval(interval);
    }, [limit]);

    const fetchLogs = async () => {
        try {
            const response = await fetch(`/api/logs?limit=${limit}`);
            const data = await response.json();
            if (data.success) {
                setLogs(data.data);
            }
        } catch (error) {
            console.error('로그 조회 오류:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return '방금 전';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}분 전`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}시간 전`;
        return date.toLocaleDateString('ko-KR');
    };

    if (loading) {
        return (
            <div className="activity-log">
                {showHeader && <h3 className="section-title">📋 최근 활동 로그</h3>}
                <div className="loading-spinner">불러오는 중...</div>
            </div>
        );
    }

    return (
        <div className="activity-log">
            {showHeader && (
                <div className="section-header">
                    <h3 className="section-title">📋 최근 활동 로그</h3>
                    <a href="/logs" className="see-all">전체 보기 →</a>
                </div>
            )}

            {logs.length === 0 ? (
                <div className="empty-state-small">아직 활동 내역이 없습니다.</div>
            ) : (
                <div className="log-list">
                    {logs.map((log) => (
                        <div key={log.id} className="log-item">
                            <span className="log-icon">{typeIcons[log.type] || '📝'}</span>
                            <span className="log-message">{log.message}</span>
                            <span className="log-time">{formatTime(log.timestamp)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

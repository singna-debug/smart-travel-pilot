'use client';

import { useEffect, useState, useRef } from 'react';
import StatusBadge from './StatusBadge';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

interface ChatSession {
    id: string;
    visitorName: string;
    visitorPhone: string;
    destination: string;
    productName: string;
    departureDate: string;
    productUrl: string;
    status: string;
    automationDates: {
        balanceDueDate: string;
        noticeDate: string;
        nextFollowup: string;
    };
    messages: Message[];
    sheetRowIndex?: number;
    summary?: string;
}

interface ChatViewerProps {
    chatId: string;
}

export default function ChatViewer({ chatId }: ChatViewerProps) {
    const [session, setSession] = useState<ChatSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchSession();
        // 10초마다 갱신 (실시간 동기화)
        const interval = setInterval(fetchSession, 10000);
        return () => clearInterval(interval);
    }, [chatId]);

    useEffect(() => {
        scrollToBottom();
    }, [session?.messages]);

    const fetchSession = async () => {
        try {
            const response = await fetch(`/api/chats/${chatId}`);
            const data = await response.json();

            if (data.success) {
                setSession(data.data);
                setError('');
            } else {
                setError(data.error || '상담을 불러올 수 없습니다.');
            }
        } catch (err) {
            setError('상담을 불러오는 중 오류가 발생했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const formatTime = (timestamp: string) => {
        return new Date(timestamp).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const openGoogleSheet = () => {
        const sheetId = process.env.NEXT_PUBLIC_SHEET_ID;
        if (sheetId && session?.sheetRowIndex) {
            window.open(`https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=0&range=A${session.sheetRowIndex}`, '_blank');
        } else if (sheetId) {
            window.open(`https://docs.google.com/spreadsheets/d/${sheetId}`, '_blank');
        }
    };

    if (loading) {
        return <div className="chat-viewer-loading">불러오는 중...</div>;
    }

    if (error || !session) {
        return <div className="chat-viewer-error">{error || '상담을 찾을 수 없습니다.'}</div>;
    }

    return (
        <div className="chat-viewer">
            <div className="chat-viewer-main">
                <div className="chat-viewer-header">
                    <div className="viewer-title">
                        <a href="/chats" className="back-button">← 뒤로</a>
                        <h2>{session.visitorName}님 상담 내역</h2>
                    </div>
                    <div className="viewer-actions">
                        <button onClick={openGoogleSheet} className="action-button">
                            📊 시트
                        </button>
                        <button onClick={fetchSession} className="action-button">
                            🔄 새로고침
                        </button>
                    </div>
                </div>

                <div className="chat-messages-viewer">
                    {session.messages.length === 0 ? (
                        <div className="empty-messages">아직 대화 내역이 없습니다.</div>
                    ) : (
                        session.messages.map((message) => (
                            <div key={message.id} className={`message-viewer ${message.role}`}>
                                <div className="message-avatar-viewer">
                                    {message.role === 'assistant' ? '✈️' : '👤'}
                                </div>
                                <div className="message-bubble-viewer">
                                    <div className="message-content-viewer">
                                        {message.content.split('\n').map((line, i) => (
                                            <span key={i}>
                                                {line}
                                                {i < message.content.split('\n').length - 1 && <br />}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="message-time-viewer">{formatTime(message.timestamp)}</div>
                                </div>
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="realtime-indicator">
                    🔄 실시간 동기화 중...
                </div>
            </div>

            <aside className="chat-viewer-sidebar">
                <div className="sidebar-section">
                    <h4>📋 고객 정보</h4>
                    <div className="info-list">
                        <div className="info-row">
                            <span className="info-label">이름</span>
                            <span className="info-value">{session.visitorName}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">연락처</span>
                            <span className="info-value">{session.visitorPhone}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">목적지</span>
                            <span className="info-value">{session.destination || '-'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">출발일</span>
                            <span className="info-value">{session.departureDate || '-'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">상태</span>
                            <StatusBadge status={session.status} />
                        </div>
                    </div>
                </div>

                {session.summary && (
                    <div className="sidebar-section">
                        <h4>📝 상담 요약</h4>
                        <div className="info-text" style={{
                            whiteSpace: 'pre-wrap',
                            fontSize: '14px',
                            lineHeight: '1.6',
                            color: '#d1d5db',
                            backgroundColor: '#374151',
                            padding: '12px',
                            borderRadius: '6px'
                        }}>
                            {session.summary}
                        </div>
                    </div>
                )}

                <div className="sidebar-section">
                    <h4>📅 자동화 일정</h4>
                    <div className="info-list">
                        <div className="info-row">
                            <span className="info-label">잔금 기한</span>
                            <span className="info-value">{session.automationDates.balanceDueDate || '-'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">안내 발송</span>
                            <span className="info-value">{session.automationDates.noticeDate || '-'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">팔로업</span>
                            <span className="info-value">{session.automationDates.nextFollowup || '-'}</span>
                        </div>
                    </div>
                </div>

                {session.productUrl && (
                    <div className="sidebar-section">
                        <h4>🔗 상품 링크</h4>
                        <a href={session.productUrl} target="_blank" rel="noopener noreferrer" className="product-link">
                            상품 페이지 열기 ↗
                        </a>
                    </div>
                )}
            </aside>
        </div>
    );
}

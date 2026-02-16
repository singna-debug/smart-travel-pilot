'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage, ConsultationData } from '@/types';

// 아이콘 컴포넌트
function SendIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
    );
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [userId] = useState(() => `web-${Date.now()}`);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // 메시지 영역 스크롤
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 텍스트 영역 높이 자동 조절
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    // 메시지 전송
    const sendMessage = async (content: string) => {
        if (!content.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: content.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: content, userId }),
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: data.message,
                timestamp: new Date(),
                consultationData: data.consultationData,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('메시지 전송 오류:', error);
            const errorMessage: ChatMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요. 🙏',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Enter 키 처리
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    // 퀵 버튼 클릭
    const handleQuickButton = (text: string) => {
        sendMessage(text);
    };

    // 시간 포맷
    const formatTime = (date: Date) => {
        return new Intl.DateTimeFormat('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    return (
        <div className="chat-container">
            {/* 헤더 */}
            <header className="chat-header">
                <div className="chat-header-avatar">✈️</div>
                <div className="chat-header-info">
                    <h1>Smart Travel Pilot</h1>
                    <p>
                        <span className="status-dot"></span>
                        클럽모두 실장 · 20년 경력 여행 전문가
                    </p>
                </div>
            </header>

            {/* 메시지 영역 */}
            <main className="chat-messages">
                {messages.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🌏</div>
                        <h2>여행 상담을 시작해보세요!</h2>
                        <p>
                            원하시는 여행지나 상품 링크를 보내주시면
                            <br />
                            맞춤 상담을 도와드릴게요.
                        </p>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <div key={message.id} className={`message ${message.role}`}>
                                <div className="message-avatar">
                                    {message.role === 'assistant' ? '✈️' : '👤'}
                                </div>
                                <div>
                                    <div className="message-content">
                                        {message.content.trim().split('\n').map((line, i) => (
                                            <span key={i}>
                                                {line}
                                                {i < message.content.trim().split('\n').length - 1 && <br />}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="message-time">{formatTime(message.timestamp)}</div>

                                    {/* 상담 데이터 표시 */}
                                    {message.consultationData && (
                                        <details className="consultation-data">
                                            <summary>📊 상담 데이터 보기</summary>
                                            <pre>{JSON.stringify(message.consultationData, null, 2)}</pre>
                                        </details>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* 타이핑 인디케이터 */}
                        {isLoading && (
                            <div className="message assistant">
                                <div className="message-avatar">✈️</div>
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </main>

            {/* 입력 영역 */}
            <footer className="chat-input-container">
                <div className="chat-input-wrapper">
                    <textarea
                        ref={textareaRef}
                        className="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="메시지를 입력하세요... (여행지 또는 상품 링크)"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        className="chat-send-button"
                        onClick={() => sendMessage(input)}
                        disabled={!input.trim() || isLoading}
                    >
                        <SendIcon />
                    </button>
                </div>
            </footer>
        </div>
    );
}

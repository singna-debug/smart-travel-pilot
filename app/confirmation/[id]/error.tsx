'use client';

import React, { useEffect } from 'react';

export default function ConfirmationError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to the console
        console.error('Confirmation Page Render Error:', error);
    }, [error]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
            color: '#f8fafc',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '24px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                maxWidth: '600px',
                width: '100%',
                background: 'rgba(30, 41, 59, 0.7)',
                backdropFilter: 'blur(16px)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                textAlign: 'center'
            }}>
                <div style={{
                    fontSize: '64px',
                    marginBottom: '16px'
                }}>⚠️</div>
                <h1 style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    marginBottom: '12px',
                    background: 'linear-gradient(to right, #f43f5e, #fb7185)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>화면을 표시하는 중 오류가 발생했습니다</h1>
                <p style={{
                    fontSize: '15px',
                    color: '#94a3b8',
                    lineHeight: '1.6',
                    marginBottom: '24px'
                }}>
                    데이터가 불완전하거나 브라우저 렌더링 중 일시적인 문제가 발생했습니다. 
                    아래 상세 오류 정보를 참고해 주세요.
                </p>

                <div style={{
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'left',
                    marginBottom: '32px',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    maxHeight: '200px',
                    overflowY: 'auto'
                }}>
                    <strong style={{ display: 'block', color: '#f43f5e', fontSize: '13px', marginBottom: '4px' }}>
                        Error Message:
                    </strong>
                    <code style={{ fontSize: '13px', fontFamily: 'monospace', color: '#fda4af', wordBreak: 'break-all' }}>
                        {error.message || 'Unknown runtime error'}
                    </code>
                    {error.digest && (
                        <div style={{ marginTop: '8px' }}>
                            <strong style={{ display: 'block', color: '#94a3b8', fontSize: '11px' }}>Digest:</strong>
                            <code style={{ fontSize: '11.5px', fontFamily: 'monospace', color: '#cbd5e1' }}>{error.digest}</code>
                        </div>
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'center'
                }}>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: '14.5px',
                            cursor: 'pointer',
                            transition: 'transform 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        새로고침
                    </button>
                    <button
                        onClick={() => reset()}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            color: '#cbd5e1',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '12px 24px',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: '14.5px',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        </div>
    );
}

'use client';

import React, { useEffect } from 'react';

export default function PrintError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Print Page Render Error:', error);
    }, [error]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f8fafc',
            color: '#0f172a',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '24px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                maxWidth: '600px',
                width: '100%',
                background: '#ffffff',
                borderRadius: '16px',
                padding: '40px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                border: '1px solid #e2e8f0',
                textAlign: 'center'
            }}>
                <div style={{
                    fontSize: '48px',
                    marginBottom: '16px'
                }}>🖨️⚠️</div>
                <h1 style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    marginBottom: '12px',
                    color: '#e11d48'
                }}>인쇄용 페이지를 불러오는 중 오류가 발생했습니다</h1>
                <p style={{
                    fontSize: '14px',
                    color: '#64748b',
                    lineHeight: '1.6',
                    marginBottom: '24px'
                }}>
                    인쇄용 데이터 구성 중 일시적인 결함이 있거나 정보가 완전하지 않습니다.
                </p>

                <div style={{
                    background: '#f8fafc',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'left',
                    marginBottom: '32px',
                    border: '1px solid #fda4af',
                    maxHeight: '200px',
                    overflowY: 'auto'
                }}>
                    <strong style={{ display: 'block', color: '#e11d48', fontSize: '13px', marginBottom: '4px' }}>
                        상세 에러 내용:
                    </strong>
                    <code style={{ fontSize: '13px', fontFamily: 'monospace', color: '#be123c', wordBreak: 'break-all' }}>
                        {error.message || '알 수 없는 오류'}
                    </code>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12.5px',
                    justifyContent: 'center'
                }}>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: '#0f172a',
                            color: '#ffffff',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        새로고침
                    </button>
                    <button
                        onClick={() => reset()}
                        style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            padding: '12px 24px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '14px',
                            cursor: 'pointer'
                        }}
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        </div>
    );
}

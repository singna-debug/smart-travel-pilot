'use client'

import React, { useState, Suspense } from 'react'
import { login, signup } from './actions'
import { Lock, Mail, Loader2, BarChart3 } from 'lucide-react'
import './login.css'
import { useSearchParams } from 'next/navigation'

function AuthForm() {
    const [mode, setMode] = useState<'login' | 'signup'>('login')
    const [pending, setPending] = useState(false)
    const [email, setEmail] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const searchParams = useSearchParams()
    const error = searchParams.get('error')
    const message = searchParams.get('message')

    React.useEffect(() => {
        const savedEmail = localStorage.getItem('remembered_email')
        if (savedEmail) {
            setEmail(savedEmail)
            setRememberMe(true)
        }
    }, [])

    const handleSubmit = () => {
        setPending(true)
        if (mode === 'login') {
            if (rememberMe) {
                localStorage.setItem('remembered_email', email)
            } else {
                localStorage.removeItem('remembered_email')
            }
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px' }}>
                <button
                    type="button"
                    style={{
                        flex: 1,
                        padding: '10px',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: mode === 'login' ? '#00d4aa' : 'transparent',
                        color: mode === 'login' ? '#000' : '#8a8a9e',
                        transition: 'all 0.2s ease'
                    }}
                    onClick={() => setMode('login')}
                >
                    🔑 로그인
                </button>
                <button
                    type="button"
                    style={{
                        flex: 1,
                        padding: '10px',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: mode === 'signup' ? '#00d4aa' : 'transparent',
                        color: mode === 'signup' ? '#000' : '#8a8a9e',
                        transition: 'all 0.2s ease'
                    }}
                    onClick={() => setMode('signup')}
                >
                    ✨ 신규 회원가입
                </button>
            </div>

            <form 
                className="login-form" 
                onSubmit={handleSubmit}
                action={mode === 'login' ? login : signup}
            >
                {mode === 'signup' && (
                    <>
                        <div className="form-group">
                            <label>여행사/회사명</label>
                            <div className="input-wrapper">
                                <input 
                                    type="text" 
                                    name="companyName" 
                                    placeholder="예: 클럽모두투어" 
                                    required 
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>담당자 성함</label>
                            <div className="input-wrapper">
                                <input 
                                    type="text" 
                                    name="managerName" 
                                    placeholder="예: 홍길동" 
                                    required 
                                />
                            </div>
                        </div>
                    </>
                )}

                <div className="form-group">
                    <label>이메일 계정</label>
                    <div className="input-wrapper">
                        <Mail className="input-icon" size={18} />
                        <input 
                            type="email" 
                            name="email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com" 
                            required 
                            autoComplete="email"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label>비밀번호 (6자리 이상)</label>
                    <div className="input-wrapper">
                        <Lock className="input-icon" size={18} />
                        <input 
                            type="password" 
                            name="password" 
                            placeholder="••••••••" 
                            required 
                            minLength={6}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        />
                    </div>
                </div>

                {mode === 'login' && (
                    <div className="form-options">
                        <label className="remember-me">
                            <input 
                                type="checkbox" 
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                            />
                            <span>아이디 저장</span>
                        </label>
                    </div>
                )}

                {message && (
                    <div style={{ background: 'rgba(0, 212, 170, 0.15)', border: '1px solid #00d4aa', borderRadius: '8px', padding: '12px', color: '#00d4aa', fontSize: '13px', marginBottom: '16px', lineHeight: 1.5 }}>
                        ✅ {decodeURIComponent(message)}
                    </div>
                )}

                {error && (
                    <div className="error-msg">
                        {decodeURIComponent(error)}
                    </div>
                )}

                <button className="login-btn" type="submit" disabled={pending}>
                    {pending ? (
                        <><Loader2 className="spin" size={20} /> 처리 중...</>
                    ) : (
                        mode === 'login' ? '로그인' : '🚀 신규 가입하고 무료 시작하기'
                    )}
                </button>
            </form>
        </div>
    )
}

export default function LoginPage() {
    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">
                        <BarChart3 size={32} />
                    </div>
                    <h1>Smart Travel Pilot</h1>
                    <p>스마트 트래블 파일롯 B2B SaaS 시스템</p>
                </div>

                <Suspense fallback={<div className="login-loading"><Loader2 className="spin" size={32} /></div>}>
                    <AuthForm />
                </Suspense>

                <div className="login-footer">
                    &copy; 2026 Smart Travel Pilot. All rights reserved.
                </div>
            </div>
        </div>
    )
}

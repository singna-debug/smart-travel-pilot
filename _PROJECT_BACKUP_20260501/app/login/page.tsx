'use client'

import React, { useState, Suspense } from 'react'
import { login } from './actions'
import { Lock, Mail, Loader2, BarChart3 } from 'lucide-react'
import './login.css'
import { useSearchParams } from 'next/navigation'

function LoginForm() {
    const [pending, setPending] = useState(false)
    const [email, setEmail] = useState('')
    const [rememberMe, setRememberMe] = useState(false)
    const searchParams = useSearchParams()
    const error = searchParams.get('error')

    // Load saved email on mount
    React.useEffect(() => {
        const savedEmail = localStorage.getItem('remembered_email')
        if (savedEmail) {
            setEmail(savedEmail)
            setRememberMe(true)
        }
    }, [])

    const handleSubmit = () => {
        setPending(true)
        if (rememberMe) {
            localStorage.setItem('remembered_email', email)
        } else {
            localStorage.removeItem('remembered_email')
        }
    }

    return (
        <form 
            className="login-form" 
            onSubmit={handleSubmit}
            action={login}
        >
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
                <label>비밀번호</label>
                <div className="input-wrapper">
                    <Lock className="input-icon" size={18} />
                    <input 
                        type="password" 
                        name="password" 
                        placeholder="••••••••" 
                        required 
                        autoComplete="current-password"
                    />
                </div>
            </div>

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

            {error && (
                <div className="error-msg">
                    로그인에 실패했습니다. <br/>
                    계정 정보를 다시 확인해주세요.
                </div>
            )}

            <button className="login-btn" type="submit" disabled={pending}>
                {pending ? (
                    <><Loader2 className="spin" size={20} /> 로그인 중...</>
                ) : (
                    '로그인'
                )}
            </button>
        </form>
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
                    <p>관리자 전용 시스템입니다. 로그인이 필요합니다.</p>
                </div>

                <Suspense fallback={<div className="login-loading"><Loader2 className="spin" size={32} /></div>}>
                    <LoginForm />
                </Suspense>

                <div className="login-footer">
                    &copy; 2026 Smart Travel Pilot. All rights reserved.
                </div>
            </div>
        </div>
    )
}

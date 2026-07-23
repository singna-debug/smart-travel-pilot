'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
    Clock, Calendar, Briefcase, FileText, 
    CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Download
} from 'lucide-react';

export default function AttendancePanel() {
    const [activeTab, setActiveTab] = useState('clock');
    const [toastMsg, setToastMsg] = useState('');

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 3000);
    };

    return (
        <div>
            <div className="att-tab-bar">
                <button 
                    className={`att-tab ${activeTab === 'clock' ? 'att-active' : ''}`}
                    onClick={() => setActiveTab('clock')}
                >
                    <Clock size={18} /> 출퇴근
                </button>
                <button 
                    className={`att-tab ${activeTab === 'leave' ? 'att-active' : ''}`}
                    onClick={() => setActiveTab('leave')}
                >
                    <Calendar size={18} /> 휴가/연차
                </button>
                <button 
                    className={`att-tab ${activeTab === 'field' ? 'att-active' : ''}`}
                    onClick={() => setActiveTab('field')}
                >
                    <Briefcase size={18} /> 외근/출장
                </button>
                <button 
                    className={`att-tab ${activeTab === 'report' ? 'att-active' : ''}`}
                    onClick={() => setActiveTab('report')}
                >
                    <FileText size={18} /> 월간 리포트
                </button>
            </div>

            {activeTab === 'clock' && <TabClock />}
            {activeTab === 'leave' && <TabLeave onSubmit={() => showToast('Demo 모드입니다')} />}
            {activeTab === 'field' && <TabField onSubmit={() => showToast('Demo 모드입니다')} />}
            {activeTab === 'report' && <TabReport onDownload={() => showToast('Demo 모드입니다')} />}

            {toastMsg && (
                <div className="att-toast">
                    {toastMsg}
                </div>
            )}
        </div>
    );
}

function TabClock() {
    const [clockedIn, setClockedIn] = useState(false);
    const [clockedOut, setClockedOut] = useState(false);
    const [inTime, setInTime] = useState<Date | null>(null);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleClockIn = () => {
        setClockedIn(true);
        setInTime(new Date());
    };

    const handleClockOut = () => {
        setClockedOut(true);
    };

    let status = 'idle';
    if (clockedIn && !clockedOut) status = 'active';
    else if (clockedOut) status = 'done';

    const getWorkDuration = () => {
        if (!inTime) return '00:00:00';
        const end = clockedOut ? new Date() : now; // In a real app, clockedOut time would be saved
        const diff = Math.floor((end.getTime() - inTime.getTime()) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    return (
        <div style={{ textAlign: 'center', paddingTop: '24px' }}>
            <h2 style={{ fontSize: '24px', margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
                {format(now, 'yyyy년 MM월 dd일 (EEEE)', { locale: ko })}
            </h2>
            <div style={{ fontSize: '48px', fontWeight: 700, margin: '0 0 24px 0', color: 'var(--text-primary)' }}>
                {format(now, 'HH:mm:ss')}
            </div>

            <div className={`att-status-pill ${status === 'active' ? 'att-status-active' : status === 'done' ? 'att-status-done' : 'att-status-idle'}`}>
                <div className={`att-pulse-dot ${status === 'active' ? 'att-anim' : ''}`} />
                {status === 'active' ? '근무중' : status === 'done' ? '퇴근완료' : '미출근'}
            </div>

            {clockedIn && (
                <div style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
                    출근 시간: {format(inTime!, 'HH:mm:ss')} | 근무 시간: {getWorkDuration()}
                </div>
            )}

            <div className="att-clock-btn-container">
                <button 
                    className="att-clock-btn att-btn-in" 
                    onClick={handleClockIn}
                    disabled={clockedIn}
                >
                    🟢 출근
                </button>
                <button 
                    className="att-clock-btn att-btn-out" 
                    onClick={handleClockOut}
                    disabled={!clockedIn || clockedOut}
                >
                    🔴 퇴근
                </button>
            </div>

            <div style={{ textAlign: 'left', marginTop: '48px' }}>
                <h3 className="att-section-title">이번 주 근무 현황</h3>
                <div className="att-weekly-container">
                    <div className="att-weekly-card">
                        <div style={{ fontWeight: 600 }}>월</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>09:00~18:05</div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>8h05m</div>
                        <div><span className="att-badge att-badge-green">정상</span></div>
                    </div>
                    <div className="att-weekly-card">
                        <div style={{ fontWeight: 600 }}>화</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>09:12~18:30</div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>9h18m</div>
                        <div><span className="att-badge att-badge-yellow">지각</span></div>
                    </div>
                    <div className="att-weekly-card att-today">
                        <div style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>수 (오늘)</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>09:02~진행중</div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>-</div>
                        <div><span className="att-badge att-badge-green">정상</span></div>
                    </div>
                    <div className="att-weekly-card">
                        <div style={{ fontWeight: 600 }}>목</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>-</div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>-</div>
                        <div><span className="att-badge att-badge-gray">미출근</span></div>
                    </div>
                    <div className="att-weekly-card">
                        <div style={{ fontWeight: 600 }}>금</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>-</div>
                        <div style={{ fontSize: '15px', fontWeight: 700 }}>-</div>
                        <div><span className="att-badge att-badge-gray">미출근</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TabLeave({ onSubmit }: { onSubmit: () => void }) {
    const [dashOffset, setDashOffset] = useState(314); // 2 * PI * 50 = 314
    
    useEffect(() => {
        // Animate to 8/15
        const target = 314 - (314 * (8 / 15));
        setTimeout(() => setDashOffset(target), 100);
    }, []);

    return (
        <div>
            <div className="att-leave-stats">
                <div className="att-stat-item">
                    <h4>총 연차</h4>
                    <p>15일</p>
                </div>
                
                <div className="att-progress-container">
                    <svg width="140" height="140" viewBox="0 0 120 120">
                        <defs>
                            <linearGradient id="att-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#00d4aa" />
                                <stop offset="100%" stopColor="#0077ff" />
                            </linearGradient>
                        </defs>
                        <circle className="att-progress-ring-bg" cx="60" cy="60" r="50" />
                        <circle 
                            className="att-progress-ring-fg" 
                            cx="60" cy="60" r="50" 
                            style={{ strokeDasharray: 314, strokeDashoffset: dashOffset }}
                        />
                    </svg>
                    <div className="att-progress-text">
                        8<span>잔여일수</span>
                    </div>
                </div>

                <div className="att-stat-item">
                    <h4>사용</h4>
                    <p>7일</p>
                </div>
            </div>

            <div className="att-form-container">
                <h3 className="att-section-title">휴가 신청</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="att-form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="att-form-label">종류</label>
                        <select className="att-form-select">
                            <option>연차</option>
                            <option>오전반차</option>
                            <option>오후반차</option>
                            <option>병가</option>
                            <option>경조사</option>
                        </select>
                    </div>
                    <div className="att-form-group">
                        <label className="att-form-label">시작일</label>
                        <input type="date" className="att-form-input" />
                    </div>
                    <div className="att-form-group">
                        <label className="att-form-label">종료일</label>
                        <input type="date" className="att-form-input" />
                    </div>
                    <div className="att-form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="att-form-label">사유</label>
                        <textarea className="att-form-textarea" placeholder="사유를 입력해주세요"></textarea>
                    </div>
                </div>
                <button className="att-submit-btn" onClick={onSubmit}>신청하기</button>
            </div>

            <h3 className="att-section-title">신청 내역</h3>
            <div className="att-history-list">
                {[
                    { type: '연차', date: '2026.07.10 - 2026.07.11', reason: '여름 휴가', status: '승인', color: 'green', approver: '김대표' },
                    { type: '오전반차', date: '2026.06.15', reason: '은행 업무', status: '승인', color: 'green', approver: '김대표' },
                    { type: '병가', date: '2026.05.02', reason: '감기 몸살', status: '반려', color: 'red', approver: '김대표' },
                    { type: '연차', date: '2026.08.20 - 2026.08.21', reason: '개인 사정', status: '대기중', color: 'yellow', approver: '-' },
                ].map((item, i) => (
                    <div key={i} className="att-history-item">
                        <div className="att-history-main">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="att-badge att-badge-blue">{item.type}</span>
                                <span className="att-history-title">{item.date}</span>
                            </div>
                            <div className="att-history-meta">{item.reason}</div>
                        </div>
                        <div className="att-history-side">
                            <span className={`att-badge att-badge-${item.color}`}>{item.status}</span>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>결재: {item.approver}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TabField({ onSubmit }: { onSubmit: () => void }) {
    const [type, setType] = useState('외근');

    return (
        <div>
            <div className="att-form-container">
                <div className="att-toggle-group">
                    <button 
                        className={`att-toggle-btn ${type === '외근' ? 'att-active' : ''}`}
                        onClick={() => setType('외근')}
                    >외근</button>
                    <button 
                        className={`att-toggle-btn ${type === '출장' ? 'att-active' : ''}`}
                        onClick={() => setType('출장')}
                    >출장(인솔)</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="att-form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="att-form-label">목적지</label>
                        <input type="text" className="att-form-input" placeholder="공항, 거래처, 보라카이 등" />
                    </div>
                    <div className="att-form-group">
                        <label className="att-form-label">시작일</label>
                        <input type="date" className="att-form-input" />
                    </div>
                    <div className="att-form-group">
                        <label className="att-form-label">종료일</label>
                        <input type="date" className="att-form-input" />
                    </div>
                    <div className="att-form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="att-form-label">메모</label>
                        <textarea className="att-form-textarea" placeholder="상세 내용을 입력해주세요"></textarea>
                    </div>
                </div>
                <button className="att-submit-btn" onClick={onSubmit}>등록하기</button>
            </div>

            <h3 className="att-section-title">외근/출장 내역</h3>
            <div className="att-history-list">
                {[
                    { type: '출장(인솔)', dest: '태국 방콕', date: '2026.07.25 - 2026.07.30', memo: '하나투어 30명 단체 인솔', status: '진행중', color: 'blue' },
                    { type: '외근', dest: '인천공항', date: '2026.07.20', memo: '고객 픽업 및 미팅', status: '완료', color: 'gray' },
                    { type: '외근', dest: '강남 거래처', date: '2026.07.15', memo: 'B2B 계약 미팅', status: '완료', color: 'gray' },
                ].map((item, i) => (
                    <div key={i} className="att-history-item">
                        <div className="att-history-main">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`att-badge ${item.type === '외근' ? 'att-badge-gray' : 'att-badge-blue'}`}>{item.type}</span>
                                <span className="att-history-title">{item.dest}</span>
                            </div>
                            <div className="att-history-meta">{item.date} | {item.memo}</div>
                        </div>
                        <div className="att-history-side">
                            <span className={`att-badge att-badge-${item.color}`}>{item.status}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TabReport({ onDownload }: { onDownload: () => void }) {
    // Generate dummy calendar for 2026.07
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const calendar = [];
    
    // July 2026 starts on Wednesday (3)
    for (let i = 0; i < 3; i++) calendar.push({ date: 0, status: 'empty' });
    
    // 31 days in July
    for (let i = 1; i <= 31; i++) {
        let status = 'green';
        if (i === 5 || i === 12 || i === 19 || i === 26) status = 'transparent'; // Sun
        else if (i === 4 || i === 11 || i === 18 || i === 25) status = 'transparent'; // Sat
        else if (i === 10 || i === 13) status = 'gray'; // Leave
        else if (i === 15) status = 'yellow'; // Late
        else if (i === 28 || i === 29) status = 'blue'; // Trip
        else if (i === 30) status = 'red'; // Absent
        
        calendar.push({ date: i, status });
    }

    return (
        <div>
            <div className="att-flex-between" style={{ marginBottom: '24px' }}>
                <select className="att-form-select" style={{ width: '200px' }}>
                    <option>김담당 (본인)</option>
                    <option>이직원</option>
                    <option>박팀장</option>
                </select>
                <button 
                    onClick={onDownload}
                    className="att-tab" 
                    style={{ padding: '8px 16px', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }}
                >
                    <Download size={16} /> CSV 다운로드
                </button>
            </div>

            <div className="att-month-nav">
                <button className="att-nav-btn"><ChevronLeft size={24} /></button>
                <span>2026년 7월</span>
                <button className="att-nav-btn"><ChevronRight size={24} /></button>
            </div>

            <div className="att-summary-grid">
                <div className="att-summary-card">
                    <div className="att-summary-val">15</div>
                    <div className="att-summary-label">출근일수</div>
                </div>
                <div className="att-summary-card">
                    <div className="att-summary-val">2</div>
                    <div className="att-summary-label">지각</div>
                </div>
                <div className="att-summary-card">
                    <div className="att-summary-val">0</div>
                    <div className="att-summary-label">조퇴</div>
                </div>
                <div className="att-summary-card">
                    <div className="att-summary-val">3</div>
                    <div className="att-summary-label">연차사용</div>
                </div>
                <div className="att-summary-card">
                    <div className="att-summary-val">1</div>
                    <div className="att-summary-label">외근</div>
                </div>
                <div className="att-summary-card">
                    <div className="att-summary-val">2</div>
                    <div className="att-summary-label">출장</div>
                </div>
            </div>

            <div className="att-form-container">
                <div className="att-calendar-grid">
                    {days.map(d => (
                        <div key={d} className="att-calendar-header">{d}</div>
                    ))}
                    {calendar.map((item, i) => (
                        <div 
                            key={i} 
                            className={`att-calendar-cell att-bg-${item.status}`}
                            title={item.date ? `7월 ${item.date}일` : ''}
                        >
                            {item.date || ''}
                        </div>
                    ))}
                </div>
                
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '24px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 12, height: 12, background: '#10b981', borderRadius: 3 }}></span> 정상</span>
                    <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 3 }}></span> 지각/조퇴</span>
                    <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 12, height: 12, background: '#3b82f6', borderRadius: 3 }}></span> 외근/출장</span>
                    <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 12, height: 12, background: '#6b7280', borderRadius: 3 }}></span> 휴가</span>
                    <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 3 }}></span> 결근</span>
                </div>
            </div>
        </div>
    );
}

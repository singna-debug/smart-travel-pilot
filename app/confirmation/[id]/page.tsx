'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { ConfirmationDocument } from '@/types';

type TabKey = '개요' | '일정표' | '서류' | '준비물' | '안내사항';
const TABS: TabKey[] = ['개요', '일정표', '서류', '준비물', '안내사항'];

const OutboundFlightIcon = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90px', flexShrink: 0, marginTop: '-6px' }}>
        <svg width="90" height="24" viewBox="0 0 100 24" style={{ overflow: 'visible' }}>
            <path d="M 10 20 Q 50 -5 90 20" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
            <g transform="translate(42, -5) scale(0.65) rotate(90, 12, 12)">
                <path fill="#0ea5e9" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </g>
        </svg>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>가는 편</span>
    </div>
);

const InboundFlightIcon = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '90px', flexShrink: 0, marginTop: '-6px' }}>
        <svg width="90" height="24" viewBox="0 0 100 24" style={{ overflow: 'visible' }}>
            <path d="M 90 20 Q 50 -5 10 20" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 3" />
            <g transform="translate(42, -5) scale(0.65) rotate(-90, 12, 12)">
                <path fill="#0ea5e9" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
            </g>
        </svg>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>오는 편</span>
    </div>
);

const formatFlightTime = (timeStr: string | undefined) => {
    if (!timeStr) return '--:--';
    if (timeStr.includes('+')) {
        const parts = timeStr.split('+');
        return (
            <>
                {parts[0]}
                <span style={{ fontSize: '0.75em', color: '#ef4444', marginLeft: '2px', fontWeight: 700 }}>
                    +{parts[1]}
                </span>
            </>
        );
    }
    return timeStr;
};

export default function ConfirmationViewerPage() {
    const params = useParams();
    const id = params.id as string;
    const [doc, setDoc] = useState<ConfirmationDocument | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<TabKey>('개요');
    const [showHotelModal, setShowHotelModal] = useState(false);
    const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const loadDoc = async () => {
            try {
                const res = await fetch(`/api/confirmation/${id}`);
                const json = await res.json();
                if (json.success) {
                    setDoc(json.data);
                } else {
                    setError(json.error || '확정서를 찾을 수 없습니다.');
                }
            } catch {
                setError('데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };
        loadDoc();
    }, [id]);

    // 로컬스토리지에서 체크리스트 복원
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`checklist-${id}`);
            if (saved) setCheckedItems(JSON.parse(saved));
        } catch { /* ignore */ }
    }, [id]);

    const toggleCheck = (key: string) => {
        setCheckedItems(prev => {
            const next = { ...prev, [key]: !prev[key] };
            try { localStorage.setItem(`checklist-${id}`, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    };

    const toggleDay = (idx: number) => {
        setExpandedDays(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    // D-Day 계산
    const calcDDay = (dateStr: string) => {
        if (!dateStr) return '';
        const target = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 0) return 'D-Day!';
        if (diff > 0) return `D-${diff}`;
        return `D+${Math.abs(diff)}`;
    };

    const handleShare = async () => {
        const url = window.location.href;
        if (navigator.share) {
            try { await navigator.share({ title: `${doc?.customer.name}님 여행 확정서`, url }); } catch { /* cancelled */ }
        } else {
            navigator.clipboard.writeText(url);
            alert('링크가 복사되었습니다!');
        }
    };

    if (loading) {
        return (
            <div className="mobile-confirm">
                <div className="mc-empty-notice">불러오는 중...</div>
            </div>
        );
    }

    if (error || !doc) {
        return (
            <div className="mobile-confirm">
                <div className="mc-header">
                    <div className="mc-brand">SMART TRAVEL PILOT</div>
                    <h1>확정서를 찾을 수 없습니다</h1>
                </div>
                <div className="mc-empty-notice">{error || '잘못된 링크입니다.'}</div>
            </div>
        );
    }

    const totalTravelers = doc.trip.adultCount + doc.trip.childCount + doc.trip.infantCount;
    const dDay = calcDDay(doc.trip.departureDate);
    const checklistItems = doc.checklist ? doc.checklist.split('\n').filter(Boolean) : [];
    const checkedCount = checklistItems.filter((_, i) => checkedItems[`cl-${i}`]).length;

    return (
        <div className="mobile-confirm">
            {/* 상단 헤더 */}
            <div className="mc-header">
                <div className="mc-brand">SMART TRAVEL PILOT</div>
                <h1>{doc.trip.productName || '여행 확정서'}</h1>
                <div className="mc-subtitle">{doc.trip.destination}</div>
                <div className="mc-status-badge">
                    <span className="badge-dot"></span>
                    {doc.status}
                </div>
            </div>

            {/* 상단 공지 배너 */}
            {doc.notices && (
                <div className="mc-top-notice">
                    <span className="nt-icon">🔔</span>
                    <div className="nt-text">
                        {doc.notices.split('\n')[0].length > 50
                            ? doc.notices.substring(0, 50) + '...'
                            : doc.notices.split('\n')[0]}
                    </div>
                </div>
            )}

            {/* 탭 네비게이션 */}
            <div className="mc-tabs">
                {TABS.map(tab => (
                    <div
                        key={tab}
                        className={`mc-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        <span>{tab}</span>
                        {tab === '준비물' && checklistItems.length > 0 && (
                            <span className="tab-badge">{checkedCount}/{checklistItems.length}</span>
                        )}
                    </div>
                ))}
            </div>

            <div className="mc-tab-content">

                {/* ============================== 1. 개요 ============================== */}
                {activeTab === '개요' && (
                    <>
                        {/* 예약 기본 정보 */}
                        <div className="mc-section">
                            <div className="mc-section-title">
                                <span className="sec-icon">📋</span> 예약 정보
                            </div>
                            <div className="mc-info-grid">
                                <div className="mc-info-item">
                                    <span className="info-label">예약번호</span>
                                    <span className="info-value highlight">{doc.reservationNumber}</span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">예약자</span>
                                    <span className="info-value">{doc.customer.name}</span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">연락처</span>
                                    <span className="info-value">{doc.customer.phone}</span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">인원</span>
                                    <span className="info-value">
                                        {totalTravelers}명
                                        {doc.trip.adultCount > 0 && ` (성인 ${doc.trip.adultCount}`}
                                        {doc.trip.childCount > 0 && `, 소아 ${doc.trip.childCount}`}
                                        {doc.trip.infantCount > 0 && `, 유아 ${doc.trip.infantCount}`}
                                        {doc.trip.adultCount > 0 && ')'}
                                    </span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">출발일</span>
                                    <span className="info-value">
                                        {doc.trip.departureDate}
                                        {dDay && <span className="dday-badge">{dDay}</span>}
                                    </span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">귀국일</span>
                                    <span className="info-value">{doc.trip.returnDate}</span>
                                </div>
                                {doc.trip.duration && (
                                    <div className="mc-info-item full">
                                        <span className="info-label">여행 기간</span>
                                        <span className="info-value">{doc.trip.duration}</span>
                                    </div>
                                )}
                            </div>

                            {/* 여행자 명단 */}
                            {doc.trip.travelers && doc.trip.travelers.length > 0 && (
                                <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, marginBottom: '6px' }}>여행자 명단</div>
                                    {doc.trip.travelers.map((t, i) => (
                                        <div key={i} style={{ fontSize: '0.85rem', color: '#475569', padding: '3px 0', display: 'flex', gap: '8px' }}>
                                            <span>{i + 1}. {t.name}</span>
                                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                                ({t.type === 'adult' ? '성인' : t.type === 'child' ? '소아' : '유아'})
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 항공 정보 */}
                        {(doc.flight.airline || doc.flight.departureTime) && (
                            <div className="mc-section">
                                <div className="mc-section-title">
                                    <span className="sec-icon">✈️</span> 항공 정보
                                </div>
                                {doc.flight.airline && (
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '10px' }}>
                                        항공사: <strong style={{ color: '#1e293b' }}>{doc.flight.airline}</strong>
                                        {doc.flight.departureAirport && ` · ${doc.flight.departureAirport} 출발`}
                                    </div>
                                )}
                                <div className="mc-flight-card">
                                    {doc.flight.departureTime && (
                                        <div className="mc-flight-row">
                                            <div className="flight-time">
                                                <div className="ft-time">{formatFlightTime(doc.flight.departureTime)}</div>
                                                <div className="ft-airport">{doc.flight.departureAirport || '출발'}</div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <OutboundFlightIcon />
                                            </div>
                                            <div className="flight-time right-align">
                                                <div className="ft-time">{formatFlightTime(doc.flight.arrivalTime)}</div>
                                                <div className="ft-airport">{doc.trip.destination || '도착'}</div>
                                            </div>
                                        </div>
                                    )}
                                    {doc.flight.returnDepartureTime && (
                                        <div className="mc-flight-row">
                                            <div className="flight-time">
                                                <div className="ft-time">{formatFlightTime(doc.flight.returnDepartureTime)}</div>
                                                <div className="ft-airport">{doc.trip.destination || '출발'}</div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                <InboundFlightIcon />
                                            </div>
                                            <div className="flight-time right-align">
                                                <div className="ft-time">{formatFlightTime(doc.flight.returnArrivalTime)}</div>
                                                <div className="ft-airport">{doc.flight.departureAirport || '도착'}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ============================== 2. 일정표 (+ 숙소 통합) ============================== */}
                {activeTab === '일정표' && (
                    <>
                        {/* 호텔 요약 카드 (상단) */}
                        {doc.hotel.name && (
                            <div className="mc-section" style={{ paddingBottom: '12px' }}>
                                <div className="mc-hotel-summary" onClick={() => setShowHotelModal(true)}>
                                    {doc.hotel.images && doc.hotel.images.length > 0 && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            className="hotel-summary-img"
                                            src={doc.hotel.images[0].startsWith('[IMG: ') ? doc.hotel.images[0].replace('[IMG: ', '').replace(']', '') : doc.hotel.images[0]}
                                            alt={doc.hotel.name}
                                        />
                                    )}
                                    <div className="hotel-summary-info">
                                        <div className="hotel-summary-name">{doc.hotel.name}</div>
                                        {doc.hotel.address && <div className="hotel-summary-addr">{doc.hotel.address}</div>}
                                        <div className="hotel-summary-meta">
                                            {doc.hotel.checkIn && <span>체크인 {doc.hotel.checkIn}</span>}
                                            {doc.hotel.checkOut && <span> · 체크아웃 {doc.hotel.checkOut}</span>}
                                        </div>
                                    </div>
                                    <div className="hotel-summary-arrow">›</div>
                                </div>
                            </div>
                        )}

                        {/* 일정별 아코디언 */}
                        {doc.itinerary && doc.itinerary.length > 0 && (
                            <div className="mc-section">
                                <div className="mc-section-title">
                                    <span className="sec-icon">🗓️</span> 상세 일정
                                </div>
                                <div className="mc-itinerary">
                                    {doc.itinerary.map((day: any, i: number) => {
                                        const isOpen = expandedDays[i] !== false; // 기본: 열림
                                        return (
                                            <div key={i} className={`mc-day-card ${isOpen ? 'open' : 'closed'}`}>
                                                <div className="day-header" onClick={() => toggleDay(i)}>
                                                    <div className="day-number">
                                                        {typeof day === 'string' ? `Day ${i + 1}` : (day.day || `Day ${i + 1}`)}
                                                        {day.date && <span className="day-date">{day.date}</span>}
                                                    </div>
                                                    {day.title && <div className="day-title">{day.title}</div>}
                                                    <div className={`day-chevron ${isOpen ? 'open' : ''}`}>▾</div>
                                                </div>

                                                {isOpen && (
                                                    <div className="day-body">
                                                        {day.transportation && (
                                                            <div className="day-transport">
                                                                <span className="trans-icon">교통</span> {day.transportation}
                                                            </div>
                                                        )}
                                                        <div className="day-content">
                                                            {typeof day === 'string' ? day : (
                                                                <>
                                                                    {day.activities && Array.isArray(day.activities) ? (
                                                                        day.activities.map((act: string, ai: number) => (
                                                                            <div key={ai} className="day-activity">{act}</div>
                                                                        ))
                                                                    ) : (
                                                                        day.description || day.content || ''
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* 식사 정보 */}
                                                        {day.meals && (
                                                            <div className="day-meals">
                                                                {day.meals.breakfast && (
                                                                    <span className={`meal-chip ${day.meals.breakfast === '불포함' ? 'excluded' : 'included'}`}>
                                                                        조식: {day.meals.breakfast}
                                                                    </span>
                                                                )}
                                                                {day.meals.lunch && (
                                                                    <span className={`meal-chip ${day.meals.lunch === '불포함' ? 'excluded' : 'included'}`}>
                                                                        중식: {day.meals.lunch}
                                                                    </span>
                                                                )}
                                                                {day.meals.dinner && (
                                                                    <span className={`meal-chip ${day.meals.dinner === '불포함' ? 'excluded' : 'included'}`}>
                                                                        석식: {day.meals.dinner}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* 해당일 호텔 및 체크인 정보 */}
                                                        {(day.hotel || day.hotelDetails?.name) && (
                                                            <div className="day-hotel">
                                                                <div className="dh-name">
                                                                    숙소: {day.hotel || day.hotelDetails?.name}
                                                                </div>
                                                                {(day.hotelDetails?.checkIn || day.hotelDetails?.checkOut) && (
                                                                    <div className="dh-times">
                                                                        {day.hotelDetails.checkIn && <span>체크인 {day.hotelDetails.checkIn}</span>}
                                                                        {day.hotelDetails.checkOut && <span> · 체크아웃 {day.hotelDetails.checkOut}</span>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* 일별 유의사항 */}
                                                        {day.dailyNotices && day.dailyNotices.length > 0 && (
                                                            <div className="day-notices">
                                                                {day.dailyNotices.map((note: string, ni: number) => (
                                                                    <div key={ni} className="day-notice-item">
                                                                        <span className="dn-bullet">안내</span> {note}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ============================== 3. 서류 ============================== */}
                {activeTab === '서류' && (
                    <>
                        <div className="mc-section">
                            <div className="mc-section-title">
                                <span className="sec-icon">📎</span> 전자 서류
                            </div>
                            {doc.files && doc.files.length > 0 ? (
                                <div className="mc-file-list">
                                    {doc.files.map(f => (
                                        <a
                                            key={f.id}
                                            href={f.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mc-file-btn"
                                        >
                                            <span className="file-icon">
                                                {f.type === 'boarding_pass' ? '🎫' :
                                                    f.type === 'visa' ? '📋' :
                                                        f.type === 'insurance' ? '🛡️' : '📄'}
                                            </span>
                                            <div className="file-info">
                                                <div className="file-name">{f.label || f.name}</div>
                                                <div className="file-desc">{f.name}</div>
                                            </div>
                                            <span className="file-download">⬇</span>
                                        </a>
                                    ))}
                                </div>
                            ) : (
                                <div className="mc-file-empty">
                                    <div className="file-empty-icon">📂</div>
                                    <div className="file-empty-text">아직 등록된 서류가 없습니다</div>
                                    <div className="file-empty-sub">보딩패스, 비자, 보험증권 등은<br />출발 전 이곳에 업데이트됩니다.</div>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ============================== 4. 준비물 ============================== */}
                {activeTab === '준비물' && (
                    <>
                        <div className="mc-section">
                            <div className="mc-section-title">
                                <span className="sec-icon">✅</span> 준비물 체크리스트
                                {checklistItems.length > 0 && (
                                    <span className="checklist-progress">
                                        {checkedCount}/{checklistItems.length}
                                    </span>
                                )}
                            </div>

                            {/* 진행상태 바 */}
                            {checklistItems.length > 0 && (
                                <div className="checklist-progress-bar">
                                    <div
                                        className="checklist-progress-fill"
                                        style={{ width: `${(checkedCount / checklistItems.length) * 100}%` }}
                                    />
                                </div>
                            )}

                            {checklistItems.length > 0 ? (
                                <ul className="mc-checklist-interactive">
                                    {checklistItems.map((item, i) => {
                                        const key = `cl-${i}`;
                                        const checked = !!checkedItems[key];
                                        return (
                                            <li
                                                key={i}
                                                className={`checklist-item ${checked ? 'checked' : ''}`}
                                                onClick={() => toggleCheck(key)}
                                            >
                                                <span className="check-box">{checked ? '✅' : '⬜'}</span>
                                                <span className="check-text">{item}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <div className="mc-empty-notice">준비물 목록이 없습니다.</div>
                            )}
                        </div>
                    </>
                )}

                {/* ============================== 5. 안내사항 ============================== */}
                {activeTab === '안내사항' && (
                    <>
                        {/* 포함/불포함 */}
                        {(doc.inclusions.length > 0 || doc.exclusions.length > 0) && (
                            <div className="mc-section">
                                <div className="mc-section-title">
                                    <span className="sec-icon">📌</span> 포함 · 불포함 사항
                                </div>
                                {doc.inclusions.length > 0 && (
                                    <div className="mc-include-list" style={{ marginBottom: '12px' }}>
                                        <div style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600, marginBottom: '4px' }}>포함사항</div>
                                        {doc.inclusions.map((item, i) => (
                                            <div key={i} className="mc-include-item included">
                                                <span className="inc-icon">✅</span> {item}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {doc.exclusions.length > 0 && (
                                    <div className="mc-include-list">
                                        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600, marginBottom: '4px' }}>불포함사항</div>
                                        {doc.exclusions.map((item, i) => (
                                            <div key={i} className="mc-include-item excluded">
                                                <span className="inc-icon">❌</span> {item}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 취소 규정 */}
                        {doc.cancellationPolicy && (
                            <div className="mc-section">
                                <div className="mc-section-title">
                                    <span className="sec-icon">⚠️</span> 취소 · 환불 규정
                                </div>
                                <div className="mc-policy-text">{doc.cancellationPolicy}</div>
                            </div>
                        )}

                        {/* 추가 안내 */}
                        {doc.notices && (
                            <div className="mc-section">
                                <div className="mc-section-title">
                                    <span className="sec-icon">💡</span> 추가 안내
                                </div>
                                <div className="mc-policy-text">{doc.notices}</div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 하단 액션 바 */}
            <div className="mc-bottom-bar">
                <a href={`tel:${doc.customer.phone || ''}`} className="mc-action-btn phone">
                    📞 전화
                </a>
                <a href="https://pf.kakao.com/_xjxkxbxj/chat" target="_blank" rel="noopener noreferrer" className="mc-action-btn kakao">
                    💬 카카오톡
                </a>
                <button className="mc-action-btn share" onClick={handleShare}>
                    🔗 공유
                </button>
            </div>

            {/* 숙소 상세 모달 */}
            {showHotelModal && (
                <div className="mc-modal-overlay" onClick={() => setShowHotelModal(false)}>
                    <div className="mc-modal" onClick={e => e.stopPropagation()}>
                        <div className="mc-modal-header">
                            <h2>호텔 상세정보</h2>
                            <button className="mc-modal-close" onClick={() => setShowHotelModal(false)}>✕</button>
                        </div>
                        <div className="mc-modal-body">
                            <div className="mcm-hotel-name">{doc.hotel.name}</div>
                            {doc.hotel.address && (
                                <div className="mcm-hotel-address" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                    <span>📍 {doc.hotel.address}</span>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${doc.hotel.name} ${doc.hotel.address}`)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ fontSize: '0.75rem', color: '#0ea5e9', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none', border: '1px solid #0ea5e9', padding: '2px 8px', borderRadius: '4px' }}
                                    >
                                        지도보기
                                    </a>
                                </div>
                            )}
                            <div className="mcm-times">
                                {doc.hotel.checkIn && <span>체크인: {doc.hotel.checkIn}</span>}
                                {doc.hotel.checkOut && <span> | 체크아웃: {doc.hotel.checkOut}</span>}
                            </div>
                            {doc.hotel.amenities && doc.hotel.amenities.length > 0 && (
                                <div className="mch-amenities">
                                    {(Array.isArray(doc.hotel.amenities) ? (doc.hotel.amenities.length === 1 && doc.hotel.amenities[0].includes(',') ? doc.hotel.amenities[0].split(',') : doc.hotel.amenities) : String(doc.hotel.amenities).split(',')).map((am: string, i: number) => (
                                        <span key={i} className="mc-chip">{am.trim()}</span>
                                    ))}
                                </div>
                            )}
                            <div className="mcm-images">
                                {doc.hotel.images?.map((img: string, i: number) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={i} src={img.startsWith('[IMG: ') ? img.replace('[IMG: ', '').replace(']', '') : img} alt={`Hotel ${i}`} style={{ width: '100%', borderRadius: '12px', marginBottom: '10px' }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

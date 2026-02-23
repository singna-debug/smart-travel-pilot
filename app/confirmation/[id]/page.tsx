'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { ConfirmationDocument } from '@/types';

type TabKey = '개요' | '일정표' | '여행가이드' | '서류' | '준비물' | '안내사항';
const TABS: TabKey[] = ['개요', '일정표', '여행가이드', '서류', '준비물', '안내사항'];

// AI 응답에서 객체/배열이 올 수 있으므로 안전하게 문자열로 변환
function safeStr(val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) {
        return val.map((item: any) => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item !== null) {
                const parts = [];
                if (item.name) parts.push(item.name);
                if (item.title) parts.push(item.title);
                if (item.description) parts.push(item.description);
                if (item.reason) parts.push(`(${item.reason})`);
                if (item.content) parts.push(item.content);
                return parts.length > 0 ? parts.join(' — ') : JSON.stringify(item);
            }
            return String(item);
        }).join('\n');
    }
    if (typeof val === 'object') {
        return Object.entries(val).map(([k, v]) => `${k}: ${safeStr(v)}`).join('\n');
    }
    return String(val);
}

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

const GuideAccordion = ({
    id,
    title,
    isOpen,
    onToggle,
    children
}: {
    id: string;
    title: React.ReactNode;
    isOpen: boolean;
    onToggle: (id: string) => void;
    children: React.ReactNode;
}) => {
    return (
        <div className={`mc-section guide-accordion ${isOpen ? 'open' : ''}`}>
            <div className="ga-header" onClick={() => onToggle(id)}>
                <div className="ga-title">{title}</div>
                <div className="ga-chevron">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
            </div>
            {isOpen && <div className="ga-content">{children}</div>}
        </div>
    );
};

const PinchZoomModal = ({ src, onClose }: { src: string, onClose: () => void }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // 터치/이동 상태 관리
    const isDragging = useRef(false);
    const startPos = useRef({ x: 0, y: 0 });
    const currentPos = useRef({ x: 0, y: 0 });
    const initialDistance = useRef<number | null>(null);
    const initialScale = useRef(1);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            // 핀치 줌 시작
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            initialDistance.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            initialScale.current = scale;
            isDragging.current = false;
        } else if (e.touches.length === 1) {
            // 패닝 시작 (확대된 상태에서만)
            if (scale > 1) {
                isDragging.current = true;
                startPos.current = {
                    x: e.touches[0].clientX - position.x,
                    y: e.touches[0].clientY - position.y
                };
            }
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && initialDistance.current !== null) {
            // 핀치 줌
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const delta = dist / initialDistance.current;
            const newScale = Math.min(Math.max(1, initialScale.current * delta), 5);
            setScale(newScale);
            // 축소 시 위치 초기화
            if (newScale <= 1) setPosition({ x: 0, y: 0 });
        } else if (e.touches.length === 1 && isDragging.current) {
            // 패닝
            e.preventDefault();
            const x = e.touches[0].clientX - startPos.current.x;
            const y = e.touches[0].clientY - startPos.current.y;
            setPosition({ x, y });
        }
    };

    const handleTouchEnd = () => {
        initialDistance.current = null;
        isDragging.current = false;
        if (scale < 1) {
            setScale(1);
            setPosition({ x: 0, y: 0 });
        }
    };

    return (
        <div
            className="mc-modal-overlay"
            onClick={onClose}
            style={{
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0',
                backgroundColor: 'rgba(0,0,0,0.9)',
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                margin: '0 auto',
                width: '100%',
                maxWidth: '480px',
                height: '100dvh',
                borderRadius: '0' // 모달은 전체 화면 느낌으로 (단 너비만 제한)
            }}
        >
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    touchAction: 'none',
                    position: 'relative',
                    overflow: 'hidden'
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={(e) => e.stopPropagation()}
            >
                {/* 닫기 버튼 - 안전 영역에 배치 */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        color: '#fff',
                        background: 'rgba(0,0,0,0.6)',
                        border: '1.5px solid rgba(255,255,255,0.4)',
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        zIndex: 100,
                        cursor: 'pointer'
                    }}
                >
                    ✕
                </button>
                <img
                    ref={imageRef}
                    src={src}
                    alt="Expanded View"
                    style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging.current || initialDistance.current ? 'none' : 'transform 0.2s ease-out',
                        willChange: 'transform'
                    }}
                    draggable={false}
                />
            </div>
        </div>
    );
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
    const [calcAmount, setCalcAmount] = useState('');
    const [calcDirection, setCalcDirection] = useState<'krwToTarget' | 'targetToKrw'>('krwToTarget');
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [targetCurrency, setTargetCurrency] = useState('');
    const [rateLoading, setRateLoading] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const toggleSection = (sec: string) => {
        setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
    };

    const currencyKoMap: Record<string, string> = { VND: '동', JPY: '엔', USD: '달러', EUR: '유로', PHP: '페소', THB: '바트', TWD: '대만 달러', CNY: '위안', HKD: '홍콩 달러', SGD: '싱가포르 달러', IDR: '루피아', MYR: '링깃' };

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

    // 환율 가져오기
    useEffect(() => {
        if (!doc?.secondaryResearch?.currency?.localCurrency) return;
        const curr = doc.secondaryResearch.currency.localCurrency;
        setTargetCurrency(curr);
        setRateLoading(true);
        fetch(`/api/exchange-rate?from=KRW&to=${curr}`)
            .then(r => r.json())
            .then(json => { if (json.success) setExchangeRate(json.data.rate); })
            .catch(() => { })
            .finally(() => setRateLoading(false));
    }, [doc]);

    // 브라우저 탭 타이틀 동적 변경
    useEffect(() => {
        if (!doc) return;
        const customerName = doc.customer?.name || '고객';
        const destination = doc.trip?.destination || '여행지';
        const totalTravelers = doc.trip?.travelers?.length || 1;
        const otherCount = totalTravelers - 1;

        let titleStr = `여행 확정서 - ${customerName}`;
        if (otherCount > 0) {
            titleStr += ` 외 ${otherCount}명`;
        }
        titleStr += `_${destination}`;

        document.title = titleStr;
    }, [doc]);

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

    // D-Day 계산 (한국 시간 기준)
    const calcDDay = (dateStr: string) => {
        if (!dateStr) return '';
        const target = new Date(dateStr);
        // 한국 시간(KST, UTC+9) 기준으로 오늘 날짜 계산
        const nowKST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        nowKST.setHours(0, 0, 0, 0);
        target.setHours(0, 0, 0, 0);
        const diff = Math.ceil((target.getTime() - nowKST.getTime()) / (1000 * 60 * 60 * 24));
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

    const handleFileDownload = async (fileUrl: string, fileName: string) => {
        try {
            // 모바일에선 단순히 a 태그 download 속성만으론 부족할 때가 많음 (특히 In-App Browser)
            // 직접 fetch 후 Blob으로 만들어 저장 유도
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Download failed:', e);
            // 실패 시 새 탭으로 여는 폴백
            window.open(fileUrl, '_blank');
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
                    <div className="mc-brand">CLUBMODE TRAVEL</div>
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
                <div className="mc-brand">CLUBMODE TRAVEL</div>
                <h1>{doc.trip.productName || '여행 확정서'}</h1>
                <div className="mc-subtitle">{doc.trip.destination}</div>
                <div className="mc-status-badge">
                    <span className="badge-dot"></span>
                    {doc.status}
                </div>
            </div>

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
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> 예약 정보
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
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.7l-1.2 3.6c-.1.4.1.9.5 1.1L9 14.5l-3.5 3.5-2.8-.8c-.4-.1-.8.2-1 .6L1 19.5l4.5 1 1 4.5c.1.4.4.7.9.6l1.8-.7c.4-.2.6-.6.5-1l-.8-2.8 3.5-3.5 2.9 6c.2.4.7.6 1.1.5l3.6-1.2c.5-.2.8-.6.7-1.1z"></path></svg> 항공 정보
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

                        {/* 수하물 규정 (개요 탭으로 이동) */}
                        {doc.secondaryResearch?.baggage && (
                            <GuideAccordion
                                id="baggage"
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><rect x="4" y="8" width="16" height="12" rx="2" ry="2"></rect><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> 수하물 규정</>}
                                isOpen={expandedSections['baggage'] || false}
                                onToggle={toggleSection}
                            >
                                <div className="baggage-cards">
                                    <div className="baggage-card checked">
                                        <div className="bag-icon">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="8" width="16" height="12" rx="2" ry="2"></rect><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </div>
                                        <div className="bag-label">위탁 수하물</div>
                                        <div className="bag-weight">
                                            {(() => {
                                                const weight = safeStr(doc.secondaryResearch.baggage.checkedWeight);
                                                const match = weight.match(/(\d+(?:\.\d+)?)\s*(?:kg|키로|k|KG|K)/i);
                                                if (match) return `${match[1]}kg`;
                                                if (/^\d+(?:\.\d+)?$/.test(weight.trim())) return `${weight.trim()}kg`;
                                                return (weight || '확인 필요');
                                            })()}
                                        </div>
                                        <p>{safeStr(doc.secondaryResearch.baggage.checkedNote)}</p>
                                    </div>
                                    <div className="baggage-card carryon">
                                        <div className="bag-icon">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="4" y="8" width="16" height="12" rx="2" ry="2"></rect>
                                                <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </div>
                                        <div className="bag-label">기내 수하물</div>
                                        <div className="bag-weight">
                                            {(() => {
                                                const weight = safeStr(doc.secondaryResearch.baggage.carryonWeight);
                                                const match = weight.match(/(\d+(?:\.\d+)?)\s*(?:kg|키로|k|KG|K)/i);
                                                if (match) return `${match[1]}kg`;
                                                if (/^\d+(?:\.\d+)?$/.test(weight.trim())) return `${weight.trim()}kg`;
                                                return (weight || '확인 필요');
                                            })()}
                                        </div>
                                        <p>{safeStr(doc.secondaryResearch.baggage.carryonNote)}</p>
                                    </div>
                                </div>
                                {doc.secondaryResearch.baggage.additionalNotes?.length > 0 && (
                                    <div className="baggage-notes">
                                        {doc.secondaryResearch.baggage.additionalNotes.map((note, i) => (
                                            <div key={i} className="baggage-note-item">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                {safeStr(note)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </GuideAccordion>
                        )}

                        {/* 미팅 및 수속 정보 */}
                        {doc.meetingInfo && doc.meetingInfo.length > 0 && (
                            <GuideAccordion
                                id="meeting"
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="m11 17 2 2a1 1 0 1 0 3-3"></path><path d="m14 14 2.5 2.5a2.12 2.12 0 1 0 3-3L15 9l-1 1"></path><path d="m15 15 2 2"></path><path d="m10 18-2-2"></path><path d="m14 14-2-2"></path><path d="m8 16-2-2"></path><path d="m9 10 2.5 2.5"></path><path d="M4.5 14H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1.5a2.5 2.5 0 0 1 2.5 2.5v1.5"></path><path d="M13.5 14H14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-1.5a2.5 2.5 0 0 0-2.5 2.5v1.5"></path><path d="m20 10-1-1"></path><path d="m17 7-1-1"></path></svg> 미팅 및 수속 안내</>}
                                isOpen={expandedSections['meeting'] || false}
                                onToggle={toggleSection}
                            >
                                <div className="meeting-cards-container">
                                    {doc.meetingInfo.map((m, i) => (
                                        <div key={i} className="meeting-card">
                                            {m.imageUrl && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={m.imageUrl}
                                                    alt={m.type}
                                                    className="meeting-card-img"
                                                    onClick={() => setSelectedImage(m.imageUrl as string)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            )}
                                            <div className="meeting-card-body">
                                                <div className={`meeting-type-badge ${m.type === '수속카운터' ? 'counter' : 'meeting'}`}>
                                                    {m.type}
                                                </div>
                                                <div className="meeting-time-loc">
                                                    {m.time && <span className="meeting-time">{m.time}</span>}
                                                    {m.location && <span className="meeting-loc">{m.location}</span>}
                                                </div>
                                                {m.description && <p className="meeting-desc">{m.description}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GuideAccordion>
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
                                        <div
                                            key={f.id}
                                            onClick={() => handleFileDownload(f.url, f.label || f.name)}
                                            className="mc-file-btn"
                                            style={{ cursor: 'pointer' }}
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
                                        </div>
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
                {/* 여행가이드 탭 */}
                {activeTab === '여행가이드' && doc.secondaryResearch && (() => {
                    const sr = doc.secondaryResearch;
                    return (
                        <div className="mc-guide-container">
                            <div className="guide-header-banner" style={{ background: '#0f172a', marginBottom: '20px' }}>
                                <div className="guide-header-label">TRAVEL GUIDE</div>
                                <h2>{safeStr(doc.trip.destination)} 맞춤 가이드</h2>
                            </div>

                            {/* ── 관광지 소개 ── */}
                            <GuideAccordion
                                id="landmarks"
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> 주요 관광지</>}
                                isOpen={expandedSections['landmarks'] || false}
                                onToggle={toggleSection}
                            >
                                {/* 첫 번째 랜드마크: 히어로 카드 */}
                                {sr.landmarks?.[0] && (
                                    <div className="landmark-hero">
                                        {sr.landmarks[0].imageUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={sr.landmarks[0].imageUrl} alt={safeStr(sr.landmarks[0].name)} className="landmark-hero-img" />
                                        )}
                                        <div className="landmark-hero-info">
                                            <h3>{safeStr(sr.landmarks[0].name)}</h3>
                                            {sr.landmarks[0].nameLocal && <span className="landmark-local">{safeStr(sr.landmarks[0].nameLocal)}</span>}
                                            <p>{safeStr(sr.landmarks[0].description)}</p>
                                        </div>
                                    </div>
                                )}
                                {/* 나머지 랜드마크: 그리드 카드 */}
                                <div className="landmark-grid">
                                    {sr.landmarks?.slice(1).map((lm, i) => (
                                        <div key={i} className="landmark-card">
                                            {lm.imageUrl && (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={lm.imageUrl} alt={safeStr(lm.name)} className="landmark-card-img" />
                                            )}
                                            <div className="landmark-card-body">
                                                <h4>{safeStr(lm.name)}</h4>
                                                {lm.nameLocal && <span className="landmark-local-sm">{safeStr(lm.nameLocal)}</span>}
                                                <p>{safeStr(lm.description)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GuideAccordion>

                            {/* ── 입국·세관 유의사항 ── */}
                            <GuideAccordion
                                id="customs"
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> 입국 · 세관 유의사항</>}
                                isOpen={expandedSections['customs'] || false}
                                onToggle={toggleSection}
                            >
                                {/* 경고 카드 */}
                                <div className="customs-warning-card">
                                    <div className="cw-icon">
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                    </div>
                                    <h3>{safeStr(sr.customs.warningTitle)}</h3>
                                    <p>{safeStr(sr.customs.warningContent)}</p>
                                </div>

                                {/* 미성년자 입국 */}
                                <div className="customs-info-card">
                                    <div className="ci-header">미성년자 입국 규정</div>
                                    <p>{safeStr(sr.customs.minorEntry)}</p>
                                </div>

                                {/* 면세 / 여권 2컬럼 */}
                                <div className="customs-dual-cards">
                                    <div className="customs-mini-card">
                                        <div className="cm-header">면세 한도</div>
                                        <p>{safeStr(sr.customs.dutyFree)}</p>
                                    </div>
                                    <div className="customs-mini-card">
                                        <div className="cm-header">여권 유의사항</div>
                                        <p>{safeStr(sr.customs.passportNote)}</p>
                                    </div>
                                </div>
                            </GuideAccordion>

                            {/* ── 환전 & 계산기 ── */}
                            <GuideAccordion
                                id="currency"
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> 환전 가이드 ({safeStr(sr.currency.localCurrency)})</>}
                                isOpen={expandedSections['currency'] || false}
                                onToggle={toggleSection}
                            >
                                <div className="currency-tip-cards">
                                    <div className="currency-tip-card highlight">
                                        <div className="ct-title">
                                            간편 환산법
                                        </div>
                                        <p>{safeStr(sr.currency.calculationTip)}</p>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
                                            *정확한 현재 환율이 아닌, 현지에서 체감 물가를 빠르게 계산하기 위한 대략적인 암산법입니다.
                                        </div>
                                    </div>
                                    <div className="currency-tip-card">
                                        <div className="ct-title">환전 팁</div>
                                        <p>{safeStr(sr.currency.exchangeTip)}</p>
                                    </div>
                                    <div className="currency-tip-card">
                                        <div className="ct-title">팁 문화</div>
                                        <p>{safeStr(sr.currency.tipCulture)}</p>
                                    </div>
                                </div>

                                {/* 환전 계산기 위젯 (양방향) */}
                                <div className="mc-calc-widget">
                                    <div className="mc-calc-title">실시간 환전 계산기</div>
                                    {rateLoading ? (
                                        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>환율 로딩 중...</div>
                                    ) : exchangeRate ? (
                                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div className="mc-calc-row">
                                                <label>
                                                    {calcDirection === 'krwToTarget' ? 'KRW' : targetCurrency}
                                                    <span className="mc-calc-sublabel">({calcDirection === 'krwToTarget' ? '원' : (currencyKoMap[targetCurrency] || '현지 화폐')})</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={calcAmount}
                                                    onChange={e => setCalcAmount(e.target.value)}
                                                    placeholder="금액 입력"
                                                    className="mc-calc-input"
                                                />
                                            </div>

                                            <div
                                                className="mc-calc-arrow-float"
                                                onClick={() => {
                                                    setCalcDirection(prev => prev === 'krwToTarget' ? 'targetToKrw' : 'krwToTarget');
                                                    setCalcAmount('');
                                                }}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="4" x2="12" y2="20"></line><polyline points="17 9 12 4 7 9"></polyline><polyline points="7 15 12 20 17 15"></polyline></svg>
                                            </div>

                                            <div className="mc-calc-row">
                                                <label>
                                                    {calcDirection === 'krwToTarget' ? targetCurrency : 'KRW'}
                                                    <span className="mc-calc-sublabel">({calcDirection === 'krwToTarget' ? (currencyKoMap[targetCurrency] || '현지 화폐') : '원'})</span>
                                                </label>
                                                <div className="mc-calc-result">
                                                    {calcAmount ? (
                                                        calcDirection === 'krwToTarget'
                                                            ? (parseFloat(calcAmount) * exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                                            : (parseFloat(calcAmount) / exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                                    ) : '0'}
                                                </div>
                                            </div>
                                            <div className="mc-calc-rate">
                                                기준 환율: 1 KRW = {exchangeRate.toFixed(6)} {targetCurrency}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>환율 정보를 불러올 수 없습니다.</div>
                                    )}
                                </div>
                            </GuideAccordion>

                            {/* ── 로밍·통신 ── */}
                            <GuideAccordion
                                id="roaming"
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg> 로밍 · 통신</>}
                                isOpen={expandedSections['roaming'] || false}
                                onToggle={toggleSection}
                            >
                                <div className="mc-roaming-grid">
                                    <div className="mc-roaming-header-banner">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> 통신 환경 안내
                                    </div>
                                    <p className="mc-roaming-subtitle" style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.5 }}>
                                        베트남 {safeStr(doc.trip.destination).split(' ').pop()}은(는) 주요 관광지와 리조트 내에서 사용이 원활합니다. 출국 전 <strong>데이터 로밍 차단</strong> 또는 <strong>로밍 요금제 신청</strong>이 필수입니다.
                                    </p>
                                    <div className="roaming-option-cards">
                                        <div className="roaming-opt-card" style={{ flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', width: '100%' }}>
                                                <div className="r-opt-badge">1</div>
                                                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>통신사 데이터 로밍 (가장 편리)</strong>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '8px', marginTop: '4px', width: '100%' }}>
                                                <div style={{ background: '#f8fafc', padding: '12px 4px', borderRadius: '10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> SKT
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>1599-2011</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>02-6343-9000</div>
                                                </div>
                                                <div style={{ background: '#f8fafc', padding: '12px 4px', borderRadius: '10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> KT
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>1588-0608</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>02-2190-0901</div>
                                                </div>
                                                <div style={{ background: '#f8fafc', padding: '12px 4px', borderRadius: '10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> LG U+
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>1544-0010</div>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>02-3416-7010</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="roaming-opt-card">
                                            <div className="r-opt-badge">2</div>
                                            <div className="r-opt-body">
                                                <strong>현지 유심 (USIM)</strong>
                                                <span>현지 번호 제공, 한국 사전 구매 권장</span>
                                            </div>
                                        </div>
                                        <div className="roaming-opt-card">
                                            <div className="r-opt-badge">3</div>
                                            <div className="r-opt-body">
                                                <strong>E-심 (eSIM)</strong>
                                                <span>QR코드로 간편 개통 (지원 단말기 확인 요망)</span>
                                            </div>
                                        </div>
                                        <div className="roaming-opt-card">
                                            <div className="r-opt-badge">4</div>
                                            <div className="r-opt-body">
                                                <strong>와이파이 도시락</strong>
                                                <span>가족 단위 기기 여러 대 연결 추천</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="roaming-tip-box" style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px', marginTop: '12px', fontSize: '0.8rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                                        <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> 유심/eSIM 추천
                                        </strong>
                                        {safeStr(sr.roaming?.simEsim) || '그랩(Grab) 호출이나 길찾기 시 데이터가 필요하므로 유심이나 로밍 준비를 추천합니다.'}
                                    </div>
                                </div>
                            </GuideAccordion>

                            {/* ── 커스텀 가이드 (구조화) ── */}
                            {sr.customGuides?.map((guide, gi) => (
                                <GuideAccordion
                                    key={gi}
                                    id={`customGuide-${gi}`}
                                    title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> {safeStr(guide.topic)}</>}
                                    isOpen={expandedSections[`customGuide-${gi}`] || false}
                                    onToggle={toggleSection}
                                >
                                    {guide.sections?.map((sec, si) => (
                                        <div key={si} className="custom-sub-section">
                                            <h4 className="css-title">{safeStr(sec.title)}</h4>

                                            {/* steps 타입 */}
                                            {sec.type === 'steps' && sec.steps && (
                                                <div className="css-steps">
                                                    {sec.steps.map((s, idx) => (
                                                        <div key={idx} className="css-step">
                                                            <div className="css-step-num">{idx + 1}</div>
                                                            <div>
                                                                <div className="css-step-label">{safeStr(s.step)}</div>
                                                                <div className="css-step-detail">{safeStr(s.detail)}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* table 타입 */}
                                            {sec.type === 'table' && sec.headers && sec.rows && (
                                                <div className="css-table-wrap">
                                                    <table className="css-table">
                                                        <thead><tr>{sec.headers.map((h, hi) => <th key={hi}>{safeStr(h)}</th>)}</tr></thead>
                                                        <tbody>
                                                            {sec.rows.map((row, ri) => (
                                                                <tr key={ri}>{row.map((c, ci) => <td key={ci}>{safeStr(c)}</td>)}</tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            {/* list 타입 */}
                                            {sec.type === 'list' && sec.items && (
                                                <ul className="css-list">
                                                    {sec.items.map((item, ii) => <li key={ii}>{safeStr(item)}</li>)}
                                                </ul>
                                            )}

                                            {/* text 타입 */}
                                            {sec.type === 'text' && sec.content && (
                                                <div className="css-text">{safeStr(sec.content)}</div>
                                            )}

                                            {/* route 타입 */}
                                            {sec.type === 'route' && sec.route && (
                                                <div className="css-route">
                                                    {sec.route.map((r, ri) => (
                                                        <span key={ri}>
                                                            <span className="css-route-badge">{safeStr(r)}</span>
                                                            {ri < (sec.route?.length || 0) - 1 && <span className="css-route-arrow">→</span>}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </GuideAccordion>
                            ))}
                        </div>
                    );
                })()}

                {activeTab === '여행가이드' && !doc.secondaryResearch && (
                    <div className="mc-section">
                        <div className="mc-empty-guide">
                            <span style={{ fontSize: '2.5rem' }}>🔬</span>
                            <p style={{ fontWeight: 600, fontSize: '1rem' }}>여행 가이드가 아직 준비되지 않았습니다.</p>
                            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>담당자가 2차 조사를 완료하면 여행지 맞춤 가이드가 표시됩니다.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* 하단 액션 바 */}
            <div className="mc-bottom-bar">
                <a href="https://pf.kakao.com/_xjxkxbxj/chat" target="_blank" rel="noopener noreferrer" className="mc-action-btn kakao" style={{ flex: 2 }}>
                    💬 상담원 연결
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

            {/* 미팅 안내 이미지 모달 */}
            {selectedImage && <PinchZoomModal src={selectedImage} onClose={() => setSelectedImage(null)} />}
        </div>
    );
}

'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { useParams } from 'next/navigation';
import type { ConfirmationDocument } from '@/types';
import { AIRLINE_MAP, CITY_CODE_MAP } from '@/lib/constants/travel-data';

const COUNTRY_CITY_MAP: Record<string, string> = {
    '리스본': 'LIS', '아테네': 'ATH', '이스탄불': 'IST',
    '두바이': 'DXB', '아부다비': 'AUH', '도하': 'DOH', '무스카트': 'MCT',
    '타슈켄트': 'TAS', '알마티': 'ALA',
    
    // 🌍 국가 대응 (안전망)
    '체코': 'PRG', '체코공화국': 'PRG', '오스트리아': 'VIE', '헝가리': 'BUD', '스위스': 'ZRH',
    '영국': 'LHR', '프랑스': 'CDG', '독일': 'FRA', '이탈리아': 'FCO', '스페인': 'MAD'
};

const TIMEZONE_OFFSETS: Record<string, number> = {
    'CXR': 2, 'DAD': 2, 'SGN': 2, 'HAN': 2, 'PQC': 2, // 베트남
    'BKK': 2, 'HKT': 2, 'USM': 2, 'CNX': 2, // 태국
    'SIN': 1, 'MNL': 1, 'CEB': 1, 'TPE': 1, 'HKG': 1, 'PVG': 1, 'PEK': 1, // 동남아/중화권
    'GUM': -1, 'SPN': -1, // 괌/사이판
    'PRG': 7, 'VIE': 7, 'BUD': 7, 'ZRH': 7, 'FRA': 7, 'MUC': 7, 'CDG': 7, 'AMS': 7, 'LHR': 8, 'LIS': 8, 'MAD': 7, 'BCN': 7, 'FCO': 7, 'IST': 6, 'HEL': 6, // 유럽
    'DXB': 5, 'DOH': 6, 'AUH': 5, // 중동
    'JFK': 13, 'LAX': 16, 'SFO': 16, 'YVR': 16, 'YYZ': 13, 'HNL': 19, // 북미 (표준시 기준)
    'SYD': -1, 'MEL': -1, 'BNE': -1, 'AKL': -3, 'CHC': -3, // 대양주
    'ICN': 0, 'PUS': 0, 'GMP': 0, 'CJU': 0, // 한국
};

const getKSTOffset = (cityName?: string) => {
    if (!cityName) return 0;
    const cleanName = cityName.replace(/[()]/g, '').trim();
    
    // 1. 코드로 직접 매핑 (PRG 등)
    const upperCode = cleanName.toUpperCase();
    if (TIMEZONE_OFFSETS[upperCode]) return TIMEZONE_OFFSETS[upperCode];
    
    // 2. 도시명/국가명으로 코드 찾기 (프라하 -> PRG, 체코 -> PRG)
    const code = CITY_CODE_MAP[cleanName] || COUNTRY_CITY_MAP[cleanName];
    if (code && TIMEZONE_OFFSETS[code]) return TIMEZONE_OFFSETS[code];
    
    return 0;
};

const calculateFlightDuration = (dept: string, deptCity: string | undefined, arr: string, arrCity: string | undefined) => {
    if (!dept || !arr) return null;
    try {
        const [dHour, dMin] = dept.split(':').map(Number);
        const [aHour, aMin] = arr.split(':').map(Number);
        if (isNaN(dHour) || isNaN(dMin) || isNaN(aHour) || isNaN(aMin)) return null;
        const dOffset = getKSTOffset(deptCity);
        const aOffset = getKSTOffset(arrCity);
        let dMinsKST = (dHour * 60 + dMin) + (dOffset * 60);
        let aMinsKST = (aHour * 60 + aMin) + (aOffset * 60);
        let diff = aMinsKST - dMinsKST;
        if (diff <= 0) diff += 1440;
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
    } catch { return null; }
};

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

const WeatherIcon = ({ description }: { description: string }) => {
    const d = description || '';
    
    // Icon mapping logic
    if (d.includes('맑음') || d.includes('태양') || d.includes('화창')) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
            </svg>
        );
    }
    if (d.includes('비') || d.includes('소나기') || d.includes('강수')) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/>
            </svg>
        );
    }
    if (d.includes('눈') || d.includes('빙판')) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M8 15h.01"/><path d="M8 19h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M16 15h.01"/><path d="M16 19h.01"/>
            </svg>
        );
    }
    if (d.includes('천둥') || d.includes('번개')) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="m13 10-4 6h3v4l4-6h-3v-4Z"/>
            </svg>
        );
    }
    if (d.includes('흐림') || d.includes('구름') || d.includes('안개')) {
        return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.5 19x"/><path d="M17.5 19c2.31 0 4.19-1.88 4.19-4.19 0-1.89-1.25-3.48-2.96-3.98A5.95 5.95 0 0 0 19 9c0-3.31-2.69-6-6-6-2.5 0-4.66 1.54-5.52 3.73A4.54 4.54 0 0 0 2 11c0 2.49 2.01 4.5 4.5 4.5h11"/>
            </svg>
        );
    }
    
    // Default: Cloudy
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.5 19x"/><path d="M17.5 19c2.31 0 4.19-1.88 4.19-4.19 0-1.89-1.25-3.48-2.96-3.98A5.95 5.95 0 0 0 19 9c0-3.31-2.69-6-6-6-2.5 0-4.66 1.54-5.52 3.73A4.54 4.54 0 0 0 2 11c0 2.49 2.01 4.5 4.5 4.5h11"/>
        </svg>
    );
};

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

// 날짜 문자열에서 T00:00:00 등 시간 부분 제거
const formatDateStr = (dateStr: string | undefined): string => {
    if (!dateStr) return '';
    return String(dateStr)
        .replace(/T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g, '')
        .trim();
};

// HTML 이스케이프 해제 (예: &lt;IMG -> <IMG)
const cleanupHtml = (html: string | undefined): string => {
    if (!html) return '';
    return String(html)
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
};

const TimelineItem = ({ item }: { item: any }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);
    const [needsCollapse, setNeedsCollapse] = useState(false);

    useEffect(() => {
        if (contentRef.current) {
            // 대략 3줄(60px) 이상이면 더보기 버튼 노출
            setNeedsCollapse(contentRef.current.scrollHeight > 64);
        }
    }, [item.description]);

    const isLocation = item.type === 'location';

    return (
        <div className="timeline-item-wrapper" style={{ display: 'flex', gap: '14px', marginBottom: '24px', position: 'relative' }}>
            {/* 좌측 타임라인 라인 및 아이콘 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '24px', flexShrink: 0 }}>
                <div style={{ 
                    width: isLocation ? '24px' : '10px', 
                    height: isLocation ? '24px' : '10px', 
                    borderRadius: '50%', 
                    background: isLocation ? 'transparent' : '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    marginTop: isLocation ? '0' : '6px'
                }}>
                    {isLocation ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                    ) : null}
                </div>
                {/* 연결 선 */}
                <div style={{ position: 'absolute', top: '24px', bottom: '-28px', left: '11px', width: '2px', background: '#f1f5f9', zIndex: 1 }}></div>
            </div>

            {/* 우측 콘텐츠 영역 */}
            <div style={{ flex: 1, paddingTop: isLocation ? '2px' : '0', minWidth: 0, overflow: 'hidden' }}>
                <div 
                    style={{ 
                        fontSize: '0.95rem', 
                        fontWeight: 700, 
                        color: '#1e293b', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        cursor: needsCollapse ? 'pointer' : 'default',
                        lineHeight: 1.4
                    }} 
                    onClick={() => needsCollapse && setIsExpanded(!isExpanded)}
                >
                    <span dangerouslySetInnerHTML={{ __html: cleanupHtml(item.title) }} />
                    {isLocation && <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 400, marginLeft: '2px' }}>›</span>}
                </div>
                
                {item.subtitle && (
                    <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, marginTop: '4px', lineHeight: 1.4 }}>
                        <span dangerouslySetInnerHTML={{ __html: cleanupHtml(item.subtitle) }} />
                    </div>
                )}

                {item.description && (
                    <div style={{ marginTop: '6px', position: 'relative' }}>
                        <div 
                            ref={contentRef}
                            style={{ 
                                fontSize: '0.82rem', 
                                color: '#64748b', 
                                lineHeight: '1.6',
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: isExpanded ? 'unset' : '3',
                                WebkitBoxOrient: 'vertical',
                                transition: 'max-height 0.3s ease-in-out',
                                whiteSpace: 'pre-line'
                            }}
                            dangerouslySetInnerHTML={{ __html: cleanupHtml(item.description) }}
                        />
                        {needsCollapse && (
                            <div 
                                onClick={() => setIsExpanded(!isExpanded)}
                                style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px', 
                                    fontSize: '0.75rem', 
                                    color: '#94a3b8', 
                                    marginTop: '6px', 
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                {isExpanded ? '접기' : '더보기'}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const PinchZoomModal = ({ src, onClose, footer, isPdf }: { src: string, onClose: () => void, footer?: React.ReactNode, isPdf?: boolean }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [imgLoading, setImgLoading] = useState(true);
    const [imgError, setImgError] = useState(false);
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
                inset: 0,
                margin: '0 auto',
                width: '100%',
                maxWidth: '480px',
                height: '100vh',
                borderRadius: '0',
                overflow: 'hidden'
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

                {isPdf ? (
                    <div style={{ width: '100%', height: '100%', paddingTop: '60px' }}>
                        <iframe
                            src={src}
                            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                            title="Document Viewer"
                        />
                    </div>
                ) : (
                    <>
                        {imgLoading && !imgError && (
                            <div style={{ color: '#fff', fontSize: '0.9rem', opacity: 0.7 }}>이미지 불러오는 중...</div>
                        )}
                        {imgError && (
                            <div style={{ textAlign: 'center', color: '#fff', padding: '20px' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚠️</div>
                                <div style={{ fontSize: '0.9rem' }}>이미지를 불러올 수 없습니다.</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '8px', wordBreak: 'break-all', maxWidth: '80vw' }}>{src}</div>
                            </div>
                        )}

                        <img
                            ref={imageRef}
                            src={src}
                            alt="Expanded View"
                            onLoad={() => setImgLoading(false)}
                            onError={() => {
                                setImgLoading(false);
                                setImgError(true);
                            }}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                opacity: imgLoading || imgError ? 0 : 1,
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                transition: isDragging.current || initialDistance.current ? 'none' : 'transform 0.15s ease-out',
                                willChange: 'transform'
                            }}
                            draggable={false}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

const getKoreaTimeText = (localTime: string, cityCode?: string) => {
    if (!localTime || !cityCode) return null;
    const offset = getKSTOffset(cityCode);
    if (offset === 0) return null;
    try {
        const [h, m] = localTime.split(':').map(Number);
        let kH = h + offset;
        let dayNote = "";
        if (kH >= 24) { kH -= 24; dayNote = " +1일"; }
        else if (kH < 0) { kH += 24; dayNote = " -1일"; }
        return `(한국 ${String(kH).padStart(2, '0')}:${String(m).padStart(2, '0')}${dayNote})`;
    } catch { return null; }
};

const simplifyDestination = (dest: any) => {
    if (!dest) return '도착';
    const firstPart = String(dest).split(',')[0].trim();
    const words = firstPart.split(' ');
    // 단어 배열의 마지막 요소를 선택하여 '일본 삿포로' 같은 경우 '삿포로'만 추출
    return words[words.length - 1];
};

const cleanWeatherDesc = (desc: any, destination: any) => {
    if (!desc) return '정보 없음';
    let clean = String(desc);
    
    // 1. 여행지 관련 단어(국가, 도시)가 포함된 경우 제거
    if (destination) {
        const destStr = String(destination);
        const destParts = destStr.split(/[\s,·\(\)]+/).filter(p => p.length > 1);
        destParts.forEach(part => {
             const regex = new RegExp(`\\s*${part}\\s*`, 'gi');
             clean = clean.replace(regex, ' ').trim();
        });
    }

    // 2. 영어 날씨 용어 한글 변환
    // 긴 구문부터 먼저 변환되도록 정렬 (예: 'partly cloudy'가 'cloudy'보다 먼저)
    const translations: [string, string][] = [
        ['partly cloudy', '구름 조금'],
        ['mostly cloudy', '대체로 흐림'],
        ['thunderstorm', '천둥번개'],
        ['thunderstorms', '천둥번개'],
        ['light rain', '약한 비'],
        ['heavy rain', '폭우'],
        ['partly', '구름 조금'],
        ['sunny', '맑음'],
        ['clear', '맑음'],
        ['cloudy', '흐림'],
        ['overcast', '흐림'],
        ['rainy', '비'],
        ['rain', '비'],
        ['showers', '소나기'],
        ['shower', '소나기'],
        ['thunder', '천둥'],
        ['storm', '폭풍'],
        ['snowy', '눈'],
        ['snow', '눈'],
        ['mist', '안개'],
        ['fog', '안개'],
        ['haze', '연무'],
        ['humid', '습함']
    ];

    translations.forEach(([eng, kor]) => {
        const regex = new RegExp(`\\b${eng}\\b`, 'gi');
        clean = clean.replace(regex, kor);
    });

    // 3. 마지막 정제
    clean = clean.replace(/[,\s·\-:;]+$/g, '').replace(/^[,\s·\-:;]+/g, '').replace(/\s+/g, ' ').trim();
    
    // 특수 케이스: '구름 조금 흐림' -> '구름 조금'
    if (clean.includes('구름 조금') && clean.includes('흐림')) {
        clean = '구름 조금';
    }

    return clean || '정보 없음';
};

const getExtraTransportation = (day: any) => {
    // 1. 크롤러에서 추출한 transport 필드 우선 (기존 유저 데이터 호환)
    if (day.transport) return day.transport;
    
    // 2. 구형 데이터 transportation 매핑 하위 호환
    if (day.transportation) {
        const matchOld = day.transportation.match(/비행기\s*([A-Z0-9]*)\s*\((.+?)\s+(\d{2}:\d{2})\s*출발,\s*(.+?)\s+(\d{2}:\d{2})\s*도착,\s*(.+?)\s*소요\)(?:,\s*(.+))?/);
        const matchNew = day.transportation.match(/([가-힣a-zA-Z]+항공|[가-힣a-zA-Z]+에어)\s*([A-Za-z0-9]+)?,\s*출발\s*(\d{2}:\d{2}),\s*도착\s*(\d{2}:\d{2}),\s*소요(?:시간)?\s*(.+)/);
        
        if (matchOld) {
            return matchOld[7] ? matchOld[7] : null; 
        } else if (matchNew) {
            return null;
        }
        return day.transportation;
    }
    return null;
};

const getAirlineInfo = (codeOrName: string) => {
    if (!codeOrName) return { name: '항공편', logoUrl: null, color: '#3b82f6' };
    
    const code2 = codeOrName.slice(0, 2).toUpperCase();
    if (AIRLINE_MAP[code2]) return AIRLINE_MAP[code2];
    
    const byName = Object.values(AIRLINE_MAP).find(v => codeOrName.includes(v.name));
    if (byName) return byName;
    
    return { name: codeOrName, logoUrl: null, color: '#3b82f6' };
};
const ParsedFlightCard = ({ day, isFirst, isLast }: { day: any, isFirst: boolean, isLast: boolean }) => {
    // 1. 크롤러가 직접 주입한 flight 객체 우선
    let flightInfo = day.flight;
    
    // 2. transport/transportation 파싱 fallback
    if (!flightInfo) {
        if (day.transport) {
            const t = day.transport;
            flightInfo = {
                flightNo: t.flightNo,
                airline: t.airline,
                departureCity: t.departureCity,
                departureTime: t.departureTime,
                arrivalCity: t.arrivalCity,
                arrivalTime: t.arrivalTime,
                duration: t.duration,
            };
        } else if (day.transportation) {
            const matchOld = day.transportation.match(/비행기\s*([A-Z0-9]*)\s*\((.+?)\s+(\d{2}:\d{2})\s*출발,\s*(.+?)\s+(\d{2}:\d{2})\s*도착,\s*(.+?)\s*소요\)/);
            const matchNew = day.transportation.match(/([가-힣a-zA-Z]+항공|[가-힣a-zA-Z]+에어)\s*([A-Za-z0-9]+)?,\s*출발\s*(\d{2}:\d{2}),\s*도착\s*(\d{2}:\d{2}),\s*소요(?:시간)?\s*(.+)/);
            if (matchOld) {
                flightInfo = { flightNo: matchOld[1], departureCity: matchOld[2], departureTime: matchOld[3], arrivalCity: matchOld[4], arrivalTime: matchOld[5], duration: matchOld[6] };
            } else if (matchNew) {
                flightInfo = { airline: matchNew[1], flightNo: matchNew[2] || '', departureTime: matchNew[3], arrivalTime: matchNew[4], duration: matchNew[5] };
            }
        }
    }
    
    // 데이터가 유효한지(최소한 편명이나 시간이 있는지) 체크하여 노출 결정
    if (!flightInfo || (!flightInfo.flightNo && !flightInfo.departureTime)) return null;
    const title = isFirst ? '가는 편' : (isLast ? '오는 편' : undefined);
    return <UnifiedFlightCard flightInfo={flightInfo} dateStr={day.date} title={title} />;
};

const parseDurationToMins = (durationStr: string) => {
    if (!durationStr) return 0;
    let mins = 0;
    const hMatch = durationStr.match(/(\d+)\s*(?:시간|h|H)/);
    const mMatch = durationStr.match(/(\d+)\s*(?:분|m|M)/);
    if (hMatch) mins += parseInt(hMatch[1], 10) * 60;
    if (mMatch) mins += parseInt(mMatch[1], 10);
    return mins;
};

const getArrivalKST = (deptTimeKST: string, durationStr: string) => {
    if (!deptTimeKST || !durationStr) return null;
    const durMins = parseDurationToMins(durationStr);
    if (durMins === 0) return null;
    try {
        const [h, m] = deptTimeKST.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        const totalMins = h * 60 + m + durMins;
        const outH = Math.floor(totalMins / 60);
        const outM = totalMins % 60;
        const dayOffset = Math.floor(outH / 24);
        const finalH = outH % 24;
        const dayStr = dayOffset > 0 ? ` +${dayOffset}일` : '';
        return `(한국 ${String(finalH).padStart(2, '0')}:${String(outM).padStart(2, '0')}${dayStr})`;
    } catch { return null; }
};

const getDepartureKST = (arrTimeKST: string, durationStr: string) => {
    if (!arrTimeKST || !durationStr) return null;
    const durMins = parseDurationToMins(durationStr);
    if (durMins === 0) return null;
    try {
        const [h, m] = arrTimeKST.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        let totalMins = h * 60 + m - durMins;
        let dayOffset = 0;
        while (totalMins < 0) {
            totalMins += 24 * 60;
            dayOffset -= 1;
        }
        const outH = Math.floor(totalMins / 60);
        const outM = totalMins % 60;
        const dayStr = dayOffset < 0 ? ` ${dayOffset}일` : '';
        return `(한국 ${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}${dayStr})`;
    } catch { return null; }
};

const LayoverConnector = ({ duration }: { duration: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0' }}>
        <div style={{ width: '2px', height: '16px', background: 'repeating-linear-gradient(to bottom, #cbd5e1 0, #cbd5e1 4px, transparent 4px, transparent 8px)' }}></div>
        <div style={{ 
            background: '#10b981', 
            color: 'white', 
            fontSize: '0.75rem', 
            fontWeight: 800, 
            padding: '4px 12px', 
            borderRadius: '20px',
            margin: '4px 0',
            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
        }}>
            경유 ({duration})
        </div>
        <div style={{ width: '2px', height: '16px', background: 'repeating-linear-gradient(to bottom, #cbd5e1 0, #cbd5e1 4px, transparent 4px, transparent 8px)' }}></div>
    </div>
);

const FlightSegmentCard = ({ segment, dateStr, isLastSegment }: { segment: any, dateStr?: string, isLastSegment?: boolean }) => {
    const planeSrc = segment.airline || segment.flightNo;
    const info = getAirlineInfo(planeSrc);

    const deptCity = (segment.departureCity || '출발지').trim();
    const arrCity = (segment.arrivalCity || '도착지').trim();
    const deptCode = CITY_CODE_MAP[deptCity] ? ` (${CITY_CODE_MAP[deptCity]})` : '';
    const arrCode = CITY_CODE_MAP[arrCity] ? ` (${CITY_CODE_MAP[arrCity]})` : '';

    let durationText = segment.duration || calculateFlightDuration(segment.departureTime, deptCode, segment.arrivalTime, arrCode);
    if (durationText && durationText.includes(':') && durationText.length <= 5) {
        const [hh, mm] = durationText.split(':').map(Number);
        if (!isNaN(hh)) {
            durationText = mm > 0 ? `${hh}시간 ${mm}분` : `${hh}시간`;
        }
    }

    const ktDept = getKoreaTimeText(segment.departureTime, deptCode);
    const ktArr = getKoreaTimeText(segment.arrivalTime, arrCode);

    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px 20px 20px',
            position: 'relative',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left', width: '32%', minWidth: '95px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px', wordBreak: 'keep-all' }}>{deptCity}{deptCode}</div>
                    {dateStr && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px' }}>{formatDateStr(dateStr)}</div>}
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>{segment.departureTime}</div>
                    {ktDept && (
                        <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 700, marginTop: '6px', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }}>
                            {ktDept}
                        </div>
                    )}
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 8px' }}>
                    {segment.flightNo && (
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#2563eb', marginBottom: '4px' }}>
                            {segment.flightNo}
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        {info.logoUrl ? (
                            <img src={info.logoUrl} alt={info.name} style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ width: '16px', height: '16px', background: info.color, color: 'white', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '3px' }}>
                                {info.name.slice(0, 1)}
                            </div>
                        )}
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>{info.name}</span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#cbd5e1' }}></div>
                        <div style={{ flex: 1, height: '1.5px', background: 'linear-gradient(90deg, #cbd5e1 0%, #e2e8f0 50%, #cbd5e1 100%)' }}></div>
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#cbd5e1' }}></div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700, marginTop: '8px', background: '#f0fdf4', padding: '2px 8px', borderRadius: '10px' }}>
                        {durationText} 소요
                    </div>
                </div>

                <div style={{ textAlign: 'right', width: '32%', minWidth: '95px' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px', wordBreak: 'keep-all' }}>{arrCity}{arrCode}</div>
                    {/* 첫 출발일자가 아니라 마지막 도착일자면 dateStr을 보여주지 않아도 되지만, 일단 동일하게 표시 */}
                    {dateStr && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', visibility: 'hidden' }}>-</div>}
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>{segment.arrivalTime}</div>
                    {ktArr && (
                        <div style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 700, marginTop: '6px', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center' }}>
                            {ktArr}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const UnifiedFlightCard = ({ flightInfo, dateStr, title }: { flightInfo: any, dateStr?: string, title?: string }) => {
    const segments = flightInfo.segments && flightInfo.segments.length > 0 ? flightInfo.segments : [flightInfo];

    return (
        <div style={{ marginBottom: '24px', marginTop: title ? '16px' : '0', position: 'relative' }}>
            {title && (
                <div style={{ 
                    position: 'absolute', 
                    top: '-12px', 
                    left: '16px', 
                    background: title === '가는 편' ? '#e0f2fe' : '#eef2ff',
                    border: `1px solid ${title === '가는 편' ? '#bae6fd' : '#c7d2fe'}`,
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    color: title === '가는 편' ? '#0369a1' : '#4338ca',
                    zIndex: 2,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                    letterSpacing: '-0.02em'
                }}>
                    {title}
                </div>
            )}
            
            {segments.map((seg: any, idx: number) => (
                <Fragment key={idx}>
                    <FlightSegmentCard 
                        segment={seg} 
                        dateStr={idx === 0 ? dateStr : undefined} 
                        isLastSegment={idx === segments.length - 1} 
                    />
                    {idx < segments.length - 1 && (
                        <LayoverConnector duration={seg.layoverDuration || '정보 없음'} />
                    )}
                </Fragment>
            ))}
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
    const [selectedHotelIdx, setSelectedHotelIdx] = useState(0);
    const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [calcAmount, setCalcAmount] = useState('');
    const [calcDirection, setCalcDirection] = useState<'krwToTarget' | 'targetToKrw'>('krwToTarget');
    const [exchangeRate, setExchangeRate] = useState<number | null>(null);
    const [targetCurrency, setTargetCurrency] = useState('');
    const [rateLoading, setRateLoading] = useState(false);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [viewerFile, setViewerFile] = useState<any>(null); // {url: string, name: string}

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
                    // 미팅 정보가 있으면 기본적으로 아코디언을 엽니다.
                    if (json.data.meetingInfo && json.data.meetingInfo.length > 0) {
                        setExpandedSections(prev => ({ ...prev, meeting: true }));
                    }
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

    const isImageFile = (url: string, fileName?: string) => {
        if (!url) return false;
        const lowerUrl = url.toLowerCase();
        const lowerName = (fileName || '').toLowerCase();

        // 확장자 목록
        const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'];

        // 1. URL 확장자 확인
        const urlExtMatch = lowerUrl.split('?')[0].match(/\.([^.]+)$/);
        const urlExt = urlExtMatch ? urlExtMatch[1] : '';

        // 2. 파일명 확장자 확인
        const nameExtMatch = lowerName.match(/\.([^.]+)$/);
        const nameExt = nameExtMatch ? nameExtMatch[1] : '';

        if (imgExts.includes(urlExt) || imgExts.includes(nameExt)) return true;

        // 3. 키워드 확인 (blob 제외)
        if (!lowerUrl.startsWith('blob:') && (lowerUrl.includes('image') || lowerUrl.includes('img'))) return true;

        return false;
    };

    const handleFileAction = (file: any) => {
        setViewerFile(file);
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
            // alert('다운로드 실패, 브라우저 뷰어로 전환합니다.');
            window.location.href = fileUrl;
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
    const checklistItems = doc.checklist ? doc.checklist.split('\n') : [];
    const realChecklistItems = checklistItems.filter(item => item.trim() !== '');
    const checkedCount = checklistItems.filter((item, i) => item.trim() !== '' && checkedItems[`cl-${i}`]).length;

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
                        {tab === '준비물' && realChecklistItems.length > 0 && (
                            <span className="tab-badge">{checkedCount}/{realChecklistItems.length}</span>
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
                                <div className="mc-info-item full">
                                    <span className="info-label">여행 상품명</span>
                                    <span className="info-value">{doc.trip.productName}</span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">예약번호</span>
                                    <span className="info-value highlight">{doc.reservationNumber}</span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">예약자</span>
                                    <span className="info-value">{doc.customer.name}</span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">목적지</span>
                                    <span className="info-value">{doc.trip.destination}</span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">여행 기간</span>
                                    <span className="info-value">{doc.trip.duration || `${itinerary.length-1}박 ${itinerary.length}일`}</span>
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
                                        {formatDateStr(doc.trip.departureDate)}
                                        {dDay && <span className="dday-badge">{dDay}</span>}
                                    </span>
                                </div>
                                <div className="mc-info-item">
                                    <span className="info-label">귀국일</span>
                                    <span className="info-value">{formatDateStr(doc.trip.returnDate)}</span>
                                </div>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                                    {doc.flight.departureTime && (
                                        <UnifiedFlightCard 
                                            title="가는 편"
                                            dateStr={doc.trip.departureDate}
                                            flightInfo={{
                                                airline: doc.flight.airline,
                                                flightNo: doc.flight.departureFlightNumber,
                                                departureCity: simplifyDestination(doc.flight.departureAirport),
                                                departureTime: doc.flight.departureTime,
                                                arrivalCity: simplifyDestination(
                                                    (doc.flight as any).arrivalAirport || 
                                                    (doc.itinerary[0] as any)?.flight?.arrivalCity || 
                                                    doc.trip.destination
                                                ),
                                                arrivalTime: doc.flight.arrivalTime,
                                                duration: (doc.flight as any).departureDuration || (doc.itinerary[0] as any)?.flight?.duration,
                                                segments: doc.flight.departureSegments
                                            }} 
                                        />
                                    )}
                                    {doc.flight.returnDepartureTime && (
                                        <UnifiedFlightCard 
                                            title="오는 편"
                                            dateStr={doc.trip.returnDate}
                                            flightInfo={{
                                                airline: doc.flight.airline,
                                                flightNo: doc.flight.returnFlightNumber,
                                                departureCity: simplifyDestination(
                                                    (doc.flight as any).returnDepartureAirport || 
                                                    (doc.itinerary[doc.itinerary.length-1] as any)?.flight?.departureCity || 
                                                    doc.trip.destination
                                                ),
                                                departureTime: doc.flight.returnDepartureTime,
                                                arrivalCity: simplifyDestination(doc.flight.departureAirport),
                                                arrivalTime: doc.flight.returnArrivalTime,
                                                duration: (doc.flight as any).returnDuration || (doc.itinerary[doc.itinerary.length-1] as any)?.flight?.duration,
                                                segments: doc.flight.returnSegments
                                            }} 
                                        />
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
                                        <div className="bag-label" style={{ marginBottom: '4px' }}>위탁 수하물</div>
                                        <div className="bag-weight" style={{ marginBottom: '16px' }}>
                                            {(() => {
                                                const weight = safeStr(doc.secondaryResearch.baggage.checkedWeight);
                                                const match = weight.match(/(\d+(?:\.\d+)?)\s*(?:kg|키로|k|KG|K)/i);
                                                if (match) return `${match[1]}kg`;
                                                return (weight || '확인 필요');
                                            })()}
                                        </div>
                                        <div style={{ marginTop: '0', color: '#64748b', fontSize: '0.82rem', lineHeight: '1.6', wordBreak: 'keep-all', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {safeStr(doc.secondaryResearch.baggage.checkedNote).split('. ').filter(s => s.trim()).map((sentence, idx) => (
                                                <div key={idx} style={{ position: 'relative', paddingLeft: '14px' }}>
                                                    <span style={{ position: 'absolute', left: 0, top: '2px', color: '#cbd5e1' }}>•</span>
                                                    {sentence.trim()}{!sentence.trim().endsWith('.') && '.'}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="baggage-card carryon">
                                        <div className="bag-icon">
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="4" y="8" width="16" height="12" rx="2" ry="2"></rect>
                                                <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                        </div>
                                        <div className="bag-label" style={{ marginBottom: '4px' }}>기내 수하물</div>
                                        <div className="bag-weight" style={{ marginBottom: '16px' }}>
                                            {(() => {
                                                const weight = safeStr(doc.secondaryResearch.baggage.carryonWeight);
                                                const match = weight.match(/(\d+(?:\.\d+)?)\s*(?:kg|키로|k|KG|K)/i);
                                                if (match) return `${match[1]}kg`;
                                                return (weight || '확인 필요');
                                            })()}
                                        </div>
                                        <div style={{ marginTop: '0', color: '#64748b', fontSize: '0.82rem', lineHeight: '1.6', wordBreak: 'keep-all', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {safeStr(doc.secondaryResearch.baggage.carryonNote).split('. ').filter(s => s.trim()).map((sentence, idx) => (
                                                <div key={idx} style={{ position: 'relative', paddingLeft: '14px' }}>
                                                    <span style={{ position: 'absolute', left: 0, top: '2px', color: '#cbd5e1' }}>•</span>
                                                    {sentence.trim()}{!sentence.trim().endsWith('.') && '.'}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {doc.secondaryResearch.baggage.additionalNotes?.length > 0 && (
                                    <div className="baggage-notes">
                                        {doc.secondaryResearch.baggage.additionalNotes.map((note, i) => (
                                            <div key={i} className="baggage-note-item">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', verticalAlign: 'middle' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                                {safeStr(note).replace(/📏/g, '')}
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
                        {/* 호텔 요약 카드 (다중 지원) */}
                        {doc.hotels && doc.hotels.length > 0 ? (
                            <div className="mc-section" style={{ paddingBottom: '12px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: '8px', paddingLeft: '4px' }}>숙소 정보 ({doc.hotels.length})</div>
                                <div className="hotel-summary-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {doc.hotels.map((h, idx) => (
                                        <div key={idx} className="mc-hotel-summary" onClick={() => { setSelectedHotelIdx(idx); setShowHotelModal(true); }}>
                                            {h.images && h.images.length > 0 && (
                                                <img
                                                    className="hotel-summary-img"
                                                    src={h.images[0]?.startsWith('[IMG: ') ? h.images[0].replace('[IMG: ', '').replace(']', '') : (h.images[0] || '')}
                                                    alt={h.name}
                                                />
                                            )}
                                            <div className="hotel-summary-info">
                                                <div className="hotel-summary-name">{h.name}</div>
                                                {h.address && <div className="hotel-summary-addr">{h.address}</div>}
                                                <div className="hotel-summary-meta">
                                                    {h.checkIn && <span>체크인 {h.checkIn}</span>}
                                                    {h.checkOut && <span> · 체크아웃 {h.checkOut}</span>}
                                                </div>
                                            </div>
                                            <div className="hotel-summary-arrow">›</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {/* 일정표 */}
                        {doc.itinerary && doc.itinerary.length > 0 && (
                            <div className="mc-section">
                                <div className="mc-section-title">
                                    <span className="sec-icon"></span> 상세 일정
                                </div>
                                <div className="mc-itinerary">
                                    {doc.itinerary.map((day: any, i: number) => {
                                        const isOpen = expandedDays[i] !== false; // 기본: 열림
                                        return (
                                            <div key={i} className={`mc-day-card ${isOpen ? 'open' : 'closed'}`}>
                                                <div className="day-header" onClick={() => toggleDay(i)}>
                                                    <div className="day-number">
                                                        {typeof day === 'string' ? `${i + 1}일차` : (day.day ? `${day.day}일차` : `${i + 1}일차`)}
                                                        {day.date && <span className="day-date">{formatDateStr(day.date)}</span>}
                                                    </div>
                                                    {day.title && <div className="day-title">{day.title}</div>}
                                                    <div className={`day-chevron ${isOpen ? 'open' : ''}`}>›</div>
                                                </div>

                                                {isOpen && (
                                                    <div className="day-body">
                                                        <ParsedFlightCard 
                                                            day={day} 
                                                            isFirst={i === 0} 
                                                            isLast={i === doc.itinerary.length - 1} 
                                                        />
                                                        <div className="day-content" style={{ marginTop: '16px' }}>
                                                            {day.timeline && Array.isArray(day.timeline) && day.timeline.length > 0 ? (
                                                                <div className="timeline-list" style={{ paddingLeft: '4px' }}>
                                                                    {day.timeline.map((item: any, ti: number) => (
                                                                        <TimelineItem key={ti} item={item} />
                                                                    ))}
                                                                </div>
                                                            ) : day.activities && Array.isArray(day.activities) ? (
                                                                <div className="activity-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                    {day.activities.flatMap((act: string) => act.split('\n')).map((line: string, ai: number) => {
                                                                        let cleanText = line.trim();
                                                                        if (!cleanText) return null;
                                                                        
                                                                        const hasImage = cleanText.toLowerCase().includes('<img');
                                                                        
                                                                        // 개조식 명사형 종결 변환 (하위 호환용, 단 이미지가 없을 때만 적용)
                                                                        if (!hasImage) {
                                                                            cleanText = cleanText.replace(/(이동|구경|감상|산책|관람|방문|체크인|진행|제공|이용|탑승|출발|도착|해산|귀환|관광|쇼핑|체험|시식|식사|숙박|휴식)합니다\.?$/, '$1');
                                                                            cleanText = cleanText.replace(/(을|를)\s*가집니다\.?$/, ' 진행');
                                                                        }
                                                                        cleanText = cleanText.trim();
                                                                        
                                                                        return (
                                                                            <div key={ai} className="day-activity-item" style={{ display: 'flex', gap: '10px', alignItems: hasImage ? 'flex-start' : 'center' }}>
                                                                                <div className="activity-icon-wrap" style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: '2px', width: '20px', textAlign: 'center' }}>
                                                                                    {hasImage ? '🖼️' : '•'}
                                                                                </div>
                                                                                <div className="activity-text" style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                                                                                    <div 
                                                                                        className="activity-header itinerary-img-fix" 
                                                                                        style={{ fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.6, overflowWrap: 'break-word', wordBreak: 'break-word' }}
                                                                                        dangerouslySetInnerHTML={{ __html: cleanupHtml(cleanText) }} 
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="day-activity" dangerouslySetInnerHTML={{ __html: cleanupHtml(day.description || day.content || '') }} />
                                                            )}
                                                        </div>

                                                        {/* 하단 통합 정보 박스 (숙소/식사/교통) */}
                                                        <div className="day-summary-box" style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                            {(day.hotel || day.hotelDetails?.name) && (
                                                                <div className="summary-row" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                                    <div className="summary-icon" style={{ marginTop: '2px' }}>
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>
                                                                    </div>
                                                                    <div className="summary-content" style={{ flex: 1 }}>
                                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>예정호텔</div>
                                                                        <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600, lineHeight: 1.4 }}>{day.hotel || day.hotelDetails?.name}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {day.meals && (
                                                                <div className="summary-row" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                                    <div className="summary-icon" style={{ marginTop: '2px' }}>
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>
                                                                    </div>
                                                                    <div className="summary-content" style={{ flex: 1 }}>
                                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>식사</div>
                                                                        <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500, lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                            {day.meals.breakfast && day.meals.breakfast !== '불포함' && <div>조식: {day.meals.breakfast}</div>}
                                                                            {day.meals.lunch && day.meals.lunch !== '불포함' && <div>중식: {day.meals.lunch}</div>}
                                                                            {day.meals.dinner && day.meals.dinner !== '불포함' && <div>석식: {day.meals.dinner}</div>}
                                                                            {(!day.meals.breakfast || day.meals.breakfast === '불포함') && (!day.meals.lunch || day.meals.lunch === '불포함') && (!day.meals.dinner || day.meals.dinner === '불포함') && <div>현지 자유식</div>}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {getExtraTransportation(day) && (
                                                                <div className="summary-row" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                                    <div className="summary-icon" style={{ marginTop: '2px' }}>
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>
                                                                    </div>
                                                                    <div className="summary-content" style={{ flex: 1 }}>
                                                                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '2px' }}>교통</div>
                                                                        <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500, lineHeight: 1.4 }}>{getExtraTransportation(day)}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

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
                                        <button
                                            key={f.id}
                                            onClick={() => handleFileAction(f)}
                                            className="mc-file-btn"
                                            style={{
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                WebkitTapHighlightColor: 'transparent',
                                                border: 'none',
                                                background: 'none',
                                                textAlign: 'left',
                                                padding: 0,
                                                width: '100%'
                                            }}
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
                                            <span className="file-view-btn">보기</span>
                                        </button>
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
                                {realChecklistItems.length > 0 && (
                                    <span className="checklist-progress">
                                        {checkedCount}/{realChecklistItems.length}
                                    </span>
                                )}
                            </div>

                            {/* 진행상태 바 */}
                            {realChecklistItems.length > 0 && (
                                <div className="checklist-progress-bar">
                                    <div
                                        className="checklist-progress-fill"
                                        style={{ width: `${(checkedCount / realChecklistItems.length) * 100}%` }}
                                    />
                                </div>
                            )}

                            {checklistItems.length > 0 ? (
                                <ul className="mc-checklist-interactive">
                                    {checklistItems.map((item, i) => {
                                        const key = `cl-${i}`;
                                        const checked = !!checkedItems[key];
                                        if (!item.trim()) {
                                            return <li key={i} style={{ listStyle: 'none', height: '14px' }} />;
                                        }
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

                            {/* ── 현지 날씨 & 복장 ── */}
                            <GuideAccordion
                                id="weather"
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="M12 2v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="M20 12h2"></path><path d="m19.07 4.93-1.41 1.41"></path><path d="M15.94 14.94a1.5 1.5 0 0 1-2.12 0 1.5 1.5 0 0 1 0-2.12l5.53-5.53a2.5 2.5 0 0 1 3.54 0 2.5 2.5 0 0 1 0 3.54Z"></path><path d="M15 12V9a2 2 0 0 0-2-2c-.73 0-1.38.4-1.73 1.02"></path><path d="M7 10a2 2 0 0 0-2 2c0 1.1.9 2 2 2h7a2 2 0 0 0 2-2c0-1.1-.9-2-2-2Z"></path></svg> 현지 날씨 & 복장</>}
                                isOpen={expandedSections['weather'] !== false}
                                onToggle={toggleSection}
                            >
                                <div className="weather-guide-wrap">
                                    <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                        <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, wordBreak: 'keep-all', margin: 0 }}>
                                            {safeStr(sr.weather?.summary)}
                                        </p>
                                    </div>

                                    {/* 일별 예보 카드 (미니멀 디자인) */}
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                            일별 기온 및 날씨
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', WebkitOverflowScrolling: 'touch', paddingLeft: '4px', paddingRight: '4px' }}>
                                            {sr.weather?.forecast?.map((day: any, i: number) => {
                                                let displayDate = day.date;
                                                try {
                                                    if (doc.trip.departureDate) {
                                                        const d = new Date(doc.trip.departureDate);
                                                        d.setDate(d.getDate() + i);
                                                        const month = d.getMonth() + 1;
                                                        const date = d.getDate();
                                                        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                                                        const dayName = dayNames[d.getDay()];
                                                        displayDate = `${month}.${date} (${dayName})`;
                                                    }
                                                } catch (e) {}

                                                return (
                                                    <div key={i} style={{ 
                                                        minWidth: '165px', 
                                                        background: 'rgba(15, 23, 42, 0.9)', 
                                                        backdropFilter: 'blur(10px)',
                                                        borderRadius: '22px', 
                                                        padding: '24px 16px 20px', 
                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        textAlign: 'center',
                                                        minHeight: '265px', // 전체 높이 소폭 확보
                                                        height: '265px' // 고정 높이로 통일감 부여
                                                    }}>
                                                        {/* 상단 정보 영역: 높이 고정 */}
                                                        <div style={{ height: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', marginBottom: '4px', letterSpacing: '-0.02em' }}>{i + 1}일차</div>
                                                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{displayDate}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, opacity: 0.9 }}>
                                                                {`(${String(day.location || simplifyDestination(doc.trip.destination)).replace(/[\(\)]/g, '')})`}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* 아이콘 영역: flex: 1을 사용하여 상하 텍스트 사이의 정중앙에 배치 */}
                                                        <div style={{ 
                                                            flex: 1, 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            justifyContent: 'center', 
                                                            width: '100%',
                                                            margin: '10px 0'
                                                        }}>
                                                            <div style={{ transform: 'scale(1.65)' }}>
                                                                <WeatherIcon description={cleanWeatherDesc(day.description, doc.trip.destination)} />
                                                            </div>
                                                        </div>

                                                        {/* 날씨 설명 영역: 하단 기온과의 균형을 위해 높이 고정 */}
                                                        <div style={{ 
                                                            height: '42px', // 2줄 내외 텍스트를 위한 최적 높이
                                                            fontSize: '0.82rem', 
                                                            color: '#e2e8f0', 
                                                            fontWeight: 500, 
                                                            lineHeight: 1.4,
                                                            wordBreak: 'keep-all',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '100%',
                                                            padding: '0 4px',
                                                            marginBottom: '10px'
                                                        }}>
                                                            {cleanWeatherDesc(day.description, doc.trip.destination)}
                                                        </div>
                                                        
                                                        {/* 온도 정보: 최하단 고정 */}
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            alignItems: 'baseline', 
                                                            gap: '8px',
                                                            paddingBottom: '4px'
                                                        }}>
                                                            <span style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff' }}>{String(day.tempMax ?? '').replace(/[^0-9.-]/g, '')}°</span>
                                                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'rgba(148, 163, 184, 0.7)' }}>/ {String(day.tempMin ?? '').replace(/[^0-9.-]/g, '')}°</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 의류 및 준비물 가이드 */}
                                    <div style={{ marginBottom: '24px' }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.62 1.96v.18A2 2 0 0 0 3 7.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.5a2 2 0 0 0 1-1.9v-.18a2 2 0 0 0-1.62-1.96Z"></path><path d="M12 21V7"></path><path d="M16 21V11"></path><path d="M8 21V11"></path></svg>
                                            상세기후 및 복장 가이드
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            {sr.weather?.clothingTips?.map((tip: any, i: number) => {
                                                const getIcon = (title: string) => {
                                                    if (title.includes('상의') || title.includes('외투')) return '🧥';
                                                    if (title.includes('하의')) return '👖';
                                                    if (title.includes('신발')) return '👟';
                                                    return '🎒';
                                                };
                                                return (
                                                    <div key={i} style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontSize: '1rem' }}>{getIcon(tip.title)}</span>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#1e293b' }}>{tip.title}</div>
                                                        </div>
                                                        <div style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.6, wordBreak: 'keep-all', fontWeight: 500 }}>
                                                            {tip.content.split('. ').map((s: string, idx: number) => (
                                                                <div key={idx} style={{ marginBottom: '4px', display: 'flex', gap: '4px' }}>
                                                                    <span style={{ color: '#94a3b8' }}>•</span>
                                                                    <span>{s.trim()}{!s.trim().endsWith('.') && s.trim().length > 0 ? '.' : ''}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 최종 요약 */}
                                    <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ fontSize: '1.2rem' }}>🎒</div>
                                        <div style={{ fontSize: '0.82rem', color: '#1e40af', fontWeight: 600, lineHeight: 1.5, wordBreak: 'keep-all' }}>
                                            {safeStr(sr.weather?.packingSummary)}
                                        </div>
                                    </div>
                                </div>
                            </GuideAccordion>

                            {/* ── 관광지 소개 ── */}
                            <GuideAccordion
                                id="landmarks"
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg> 주요 관광지</>}
                                isOpen={expandedSections['landmarks'] || false}
                                onToggle={toggleSection}
                            >
                                <div style={{ 
                                    marginBottom: '20px', 
                                    background: '#f1f5f9', 
                                    padding: '12px 16px', 
                                    borderRadius: '12px', 
                                    fontSize: '0.8rem', 
                                    color: '#64748b', 
                                    lineHeight: 1.5,
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'flex-start'
                                }}>
                                    <span style={{ flexShrink: 0, fontSize: '0.9rem' }}>💡</span>
                                    <span>아래 내용은 해당 도시의 주요 명소를 소개하는 가이드이며, 실제 확정된 일정상 방문지 구성과는 차이가 있을 수 있습니다.</span>
                                </div>

                                {/* 첫 번째 랜드마크: 히어로 카드 */}
                                {sr.landmarks?.[0] && (
                                    <div className="landmark-hero">
                                        {sr.landmarks[0].imageUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={sr.landmarks[0].imageUrl} alt={safeStr(sr.landmarks[0].name)} className="landmark-hero-img" />
                                        )}
                                        <div className="landmark-hero-info">
                                            <h4>{safeStr(sr.landmarks[0].name)}</h4>
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
                                 {/* (1) 국가별 핵심 경보 (식품류 등) - 프리미엄 경고 스타일 */}
                                 {sr.customs?.majorAlert && sr.customs.majorAlert.title && (
                                     <div style={{ marginBottom: '24px', border: '1px solid #fee2e2', background: 'linear-gradient(135deg, #fff5f5 0%, #fff 100%)', padding: '24px 20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(220, 38, 38, 0.05)' }}>
                                         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1.05rem', fontWeight: 900, color: '#dc2626', marginBottom: '14px' }}>
                                             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                             {safeStr(sr.customs.majorAlert.title)}
                                         </div>
                                         <div style={{ fontSize: '0.88rem', color: '#7f1d1d', lineHeight: 1.7, marginBottom: '16px', textAlign: 'center', wordBreak: 'keep-all', fontWeight: 500 }}>
                                             {safeStr(sr.customs.majorAlert.content)}
                                         </div>
                                         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#fff', fontSize: '0.8rem', fontWeight: 800, background: '#dc2626', padding: '10px 16px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(220, 38, 38, 0.2)' }}>
                                             {safeStr(sr.customs.majorAlert.penalty || '위반 시 항공기 탑승 거절 또는 압수')}
                                         </div>
                                     </div>
                                 )}

                                 {/* (2) 반입 금지/제한 품목 - 세련된 레드 테마 디자인 */}
                                 {sr.customs?.prohibitedItems && sr.customs.prohibitedItems.length > 0 && (
                                     <div style={{ marginBottom: '24px', border: '1px solid #fee2e2', background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(220, 38, 38, 0.03)' }}>
                                         <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(220, 38, 38, 0.03)', borderBottom: '1px solid #fee2e2' }}>
                                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                                             <span style={{ fontSize: '1rem', fontWeight: 900, color: '#dc2626', letterSpacing: '-0.02em' }}>반입 금지 · 제한 품목</span>
                                         </div>
                                         <div style={{ padding: '20px' }}>
                                             {sr.customs?.prohibitedItems?.map((pi, pii) => (
                                                 <div key={pii} style={{ marginBottom: pii === sr.customs.prohibitedItems.length - 1 ? 0 : '18px' }}>
                                                     <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#991b1b', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                         <div style={{ width: '4px', height: '14px', background: '#dc2626', borderRadius: '2px' }}></div>
                                                         {safeStr(pi.category)}
                                                     </div>
                                                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                         {(pi.items || []).map((it: any, iti: number) => (
                                                             <span key={iti} style={{ fontSize: '0.78rem', background: '#fff', color: '#dc2626', border: '1px solid #fee2e2', padding: '6px 14px', borderRadius: '12px', fontWeight: 700, boxShadow: '0 2px 4px rgba(220,38,38,0.05)' }}>
                                                                 {safeStr(it)}
                                                             </span>
                                                         ))}
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 )}

                                 {/* (3) 면세 한도 & 여권 유의사항 - 세로 정렬 카드 스타일 */}
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                                     <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 8px rgba(12, 148, 217, 0.05)' }}>
                                         <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#0369a1', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                             <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                                             </div>
                                             면세 한도
                                         </div>
                                         <div style={{ fontSize: '0.85rem', color: '#075985', lineHeight: 1.6, wordBreak: 'keep-all', paddingLeft: '2px', fontWeight: 500 }}>
                                             {safeStr(sr.customs?.dutyFree || '담배 1보루, 주류 1리터 등')}
                                         </div>
                                     </div>
                                     <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 8px rgba(124, 58, 237, 0.05)' }}>
                                         <div style={{ fontSize: '0.95rem', fontWeight: 900, color: '#6d28d9', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                             <div style={{ width: '32px', height: '32px', background: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                             </div>
                                             여권 유의사항
                                         </div>
                                         <div style={{ fontSize: '0.85rem', color: '#5b21b6', lineHeight: 1.6, wordBreak: 'keep-all', paddingLeft: '2px', fontWeight: 500 }}>
                                             {safeStr(sr.customs?.passportNote || '만료일 6개월 이상 권장')}
                                         </div>
                                     </div>
                                 </div>

                                 {/* (4) 입국 절차 - 이미지 번호 리스트 스타일 */}
                                 {sr.customs?.arrivalProcedure && sr.customs.arrivalProcedure.steps?.length > 0 && (
                                     <div style={{ marginBottom: '24px', border: '1.5px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', background: '#fff' }}>
                                         <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                             <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>{safeStr(sr?.customs?.arrivalProcedure?.title || '여행지 입국 절차')}</span>
                                         </div>
                                         <div style={{ padding: '0 18px 18px 18px' }}>
                                             <div style={{ background: '#e0f2fe', color: '#0369a1', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                                 미리 준비하면 편리합니다.
                                             </div>
                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                 {sr.customs?.arrivalProcedure?.steps?.map((st, i) => (
                                                     <div key={i} style={{ display: 'flex', gap: '14px' }}>
                                                         <div style={{ background: '#0284c7', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0, marginTop: '2px' }}>{i + 1}</div>
                                                         <div>
                                                             <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>{safeStr(st.step)}</div>
                                                             <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>{safeStr(st.description)}</div>
                                                         </div>
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                     </div>
                                 )}

                                 {/* (5) 미성년자 자녀 입국 규정 - 이미지 스타일 매칭 */}
                                 {(sr.customs?.minorEntry || sr.customs?.minorDetail) && (
                                     <div style={{ marginBottom: '24px', background: '#fffde7', border: '1.5px solid #fef08a', borderRadius: '16px', overflow: 'hidden' }}>
                                         <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '8px', color: '#854d0e' }}>
                                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                             <span style={{ fontSize: '0.92rem', fontWeight: 800 }}>미성년자 입국 규정</span>
                                         </div>
                                         <div style={{ padding: '0 18px 18px 18px' }}>
                                             <div style={{ fontSize: '0.85rem', color: '#713f12', lineHeight: 1.6, marginBottom: '14px', wordBreak: 'keep-all' }}>
                                                 {safeStr(sr?.customs?.minorEntry)}
                                             </div>
                                             {sr.customs.minorDetail && (
                                                 <div style={{ background: '#fff', border: '1px solid #fdf4ff', borderRadius: '12px', padding: '16px', borderLeft: '4px solid #facc15' }}>
                                                     <div style={{ color: '#854d0e', fontSize: '0.82rem', lineHeight: 1.6, display: 'flex', gap: '10px' }}>
                                                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                         <span style={{ wordBreak: 'keep-all' }}>{safeStr(sr?.customs?.minorDetail)}</span>
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                 )}

                                 {/* (6) 공식 사이트 퀵링크 - 이미지 스타일 매칭 (Dark Blue Header) */}
                                 {sr.customs?.links && sr.customs.links.length > 0 && (
                                     <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
                                         <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
                                             사전 입국 준비 사항
                                         </div>
                                         {sr.customs?.links?.map((link, li) => (
                                             <div key={li} style={{ border: '1.5px solid #005a96', borderRadius: '16px', overflow: 'hidden', background: '#fff' }}>
                                                 <div style={{ background: '#005a96', padding: '14px 20px', display: 'flex', alignItems: 'center', color: '#fff', gap: '14px' }}>
                                                     <span style={{ background: '#fff', color: '#005a96', padding: '6px 12px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                         {link.type === 'visa' ? '비자/ETA' : (link.type === 'customs' ? '세관신고' : '입국신고')}
                                                     </span>
                                                     <span style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.3, marginTop: '4px', wordBreak: 'keep-all' }}>{safeStr(link.label)}</span>
                                                 </div>
                                                 <div style={{ padding: '24px' }}>
                                                     <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
                                                         <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.7, wordBreak: 'keep-all' }}>
                                                             {safeStr(link.description) || "한국 국적자가 해당 국가에 입국하기 위해 사전 준비가 필요한 절차입니다. 세부 내용을 확인해 주세요."}
                                                         </div>
                                                     </div>
                                                     <div style={{ marginBottom: '20px' }}>
                                                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', fontSize: '0.88rem', fontWeight: 800, marginBottom: '8px' }}>
                                                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                             신청 방법
                                                         </div>
                                                         <div style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: 1.6 }}>
                                                             공식 홈페이지({link.url.replace('https://', '').split('/')[0]})에 접속하여 여권 정보 및 체류지 주소를 입력하고 제출합니다. 승인 후 안내에 따라 절차를 완료합니다.
                                                         </div>
                                                     </div>
                                                     <a
                                                         href={link.url}
                                                         target="_blank"
                                                         rel="noopener noreferrer"
                                                         style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to right, #00ace2, #008ebc)', color: '#fff', padding: '16px', borderRadius: '14px', fontWeight: 800, gap: '10px', fontSize: '1rem', boxShadow: '0 4px 12px rgba(0, 172, 226, 0.2)' }}
                                                     >
                                                         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                         공식 사이트 바로가기
                                                     </a>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 )}

                                 <div className="customs-warning-card" style={{ marginTop: '10px', opacity: 0.6 }}>
                                     <h3>기타 기본 유의사항</h3>
                                     <p>{safeStr(sr.customs?.warningContent)}</p>
                                 </div>
                            </GuideAccordion>

                            {/* ── 환전 & 계산기 ── */}
                            <GuideAccordion
                                id="currency"
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> 환전 가이드 ({safeStr(sr.currency?.localCurrency)})</>}
                                isOpen={expandedSections['currency'] || false}
                                onToggle={toggleSection}
                            >
                                <div className="currency-tip-cards">
                                    <div className="currency-tip-card highlight">
                                        <div className="ct-title">
                                            간편 환산법
                                        </div>
                                        <p>{safeStr(sr?.currency?.calculationTip)}</p>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
                                            *정확한 현재 환율이 아닌, 현지에서 체감 물가를 빠르게 계산하기 위한 대략적인 암산법입니다.
                                        </div>
                                    </div>
                                    
                                    <div className="currency-tip-card">
                                        <div className="ct-title">환전 팁</div>
                                        <ul className="guide-list-wrap">
                                            {safeStr(sr?.currency?.exchangeTip).split(/[\n·\-\*]/).filter(t => t.trim().length > 1).map((text, i) => (
                                                <li key={i} className="guide-list-item">{text.trim()}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="currency-tip-card">
                                        <div className="ct-title">팁 문화</div>
                                        <ul className="guide-list-wrap">
                                            {safeStr(sr?.currency?.tipCulture).split(/[\n·\-\*]/).filter(t => t.trim().length > 1).map((text, i) => (
                                                <li key={i} className="guide-list-item">{text.trim()}</li>
                                            ))}
                                        </ul>
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
                                                    <a href="tel:02-6343-9000" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none', marginBottom: '4px' }}>02-6343-9000</a>
                                                    <a href="tel:1599-2011" style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', textDecoration: 'none' }}>1599-2011</a>
                                                </div>
                                                <div style={{ background: '#f8fafc', padding: '12px 4px', borderRadius: '10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> KT
                                                    </div>
                                                    <a href="tel:02-2190-0901" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none', marginBottom: '4px' }}>02-2190-0901</a>
                                                    <a href="tel:1588-0608" style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', textDecoration: 'none' }}>1588-0608</a>
                                                </div>
                                                <div style={{ background: '#f8fafc', padding: '12px 4px', borderRadius: '10px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg> LG U+
                                                    </div>
                                                    <a href="tel:02-3416-7010" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none', marginBottom: '4px' }}>02-3416-7010</a>
                                                    <a href="tel:1544-0010" style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', textDecoration: 'none' }}>1544-0010</a>
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
                <a href="tel:01093079004" className="mc-action-btn kakao" style={{ flex: 2 }}>
                    상담원 연결
                </a>
                <button className="mc-action-btn share" onClick={handleShare}>
                    공유
                </button>
            </div>

            {/* 숙소 상세 모달 */}
            {showHotelModal && doc && (doc.hotels?.[selectedHotelIdx] || (doc as any).hotel) && (
                <div className="mc-modal-overlay" onClick={() => setShowHotelModal(false)}>
                    <div className="mc-modal" onClick={e => e.stopPropagation()}>
                        <div className="mc-modal-header">
                            <h2>호텔 상세정보</h2>
                            <button className="mc-modal-close" onClick={() => setShowHotelModal(false)}>✕</button>
                        </div>
                        <div className="mc-modal-body">
                            {(() => {
                                const h = (doc?.hotels?.[selectedHotelIdx] || (doc as any)?.hotel);
                                if (!h) return null;
                                return (
                                    <>
                                        <div className="mcm-hotel-name">{h.name}</div>
                                        {h.address && (
                                            <div className="mcm-hotel-address" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                                <span>📍 {h.address}</span>
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${h.name} ${h.address}`)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ fontSize: '0.75rem', color: '#0ea5e9', fontWeight: 600, whiteSpace: 'nowrap', textDecoration: 'none', border: '1px solid #0ea5e9', padding: '2px 8px', borderRadius: '4px' }}
                                                >
                                                    지도보기
                                                </a>
                                            </div>
                                        )}
                                        <div className="mcm-times">
                                            {h.checkIn && <span>체크인: {h.checkIn}</span>}
                                            {h.checkOut && <span> | 체크아웃: {h.checkOut}</span>}
                                        </div>
                                        {h.amenities && (Array.isArray(h.amenities) ? h.amenities.length > 0 : String(h.amenities).length > 0) && (
                                            <div className="mch-amenities">
                                                {(Array.isArray(h.amenities) ? (h.amenities.length === 1 && h.amenities[0].includes(',') ? h.amenities[0].split(',') : h.amenities) : String(h.amenities).split(',')).map((am: string, i: number) => (
                                                    <span key={i} className="mc-chip">{am.trim()}</span>
                                                ))}
                                            </div>
                                        )}
                                        <div className="mcm-images">
                                            {h.images?.map((img: string, i: number) => (
                                                <img key={i} src={img.startsWith('[IMG: ') ? img.replace('[IMG: ', '').replace(']', '') : img} alt={`Hotel ${i}`} style={{ width: '100%', borderRadius: '12px', marginBottom: '10px' }} />
                                            ))}
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* 미팅 안내 이미지 모달 */}
            {selectedImage && <PinchZoomModal src={selectedImage} onClose={() => setSelectedImage(null)} />}
            {/* 서류 뷰어 모달 (전체 화면 통합 뷰어) */}
            {viewerFile && (
                <PinchZoomModal
                    src={viewerFile.url}
                    onClose={() => setViewerFile(null)}
                    isPdf={!isImageFile(viewerFile.url, viewerFile.name)}
                    footer={(
                        <button
                            className="mcv-download-btn"
                            onClick={() => handleFileDownload(viewerFile.url, viewerFile.name)}
                        >
                            ⬇ 원본 파일 저장
                        </button>
                    )}
                />
            )}
        </div>
    );
}

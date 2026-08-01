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
    'NBO': 6, 'CPT': 7, 'JNB': 7, 'VFA': 7, 'ADD': 6, // 아프리카
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

type TabKey = '개요' | '일정표' | '필요서류' | '안내사항' | '준비물' | '날씨' | '복장' | '환전/로밍' | '관광지' | '기타';
const TABS: TabKey[] = ['개요', '일정표', '필요서류', '안내사항', '준비물', '날씨', '복장', '환전/로밍', '관광지', '기타'];

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

const formatBulletPoints = (text: string) => {
    if (!text) return null;
    const cleanText = safeStr(text);
    
    // Split by common delimiters like " - " or newline followed by "-" or "* " or "· "
    const parts = cleanText
        .split(/[\r\n]+|(?:\s+|^)-\s+|(?:\s+|^)\*\s+|(?:\s+|^)·\s+/)
        .map(p => p.trim())
        .filter(p => p.length > 0);
        
    if (parts.length <= 1) {
        const inlineParts = cleanText
            .split(/\s+-\s+/)
            .map(p => p.trim())
            .filter(p => p.length > 0);
            
        if (inlineParts.length > 1) {
            let prefix = '';
            let listContent = inlineParts;
            if (inlineParts[0].startsWith('-')) {
                listContent[0] = listContent[0].replace(/^-/, '').trim();
            } else if (inlineParts[0].endsWith(':') || inlineParts[0].includes('면세 한도') || inlineParts[0].includes('유의사항')) {
                prefix = inlineParts[0];
                listContent = inlineParts.slice(1);
            }
            
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {prefix && <div style={{ fontWeight: 700, fontSize: '0.8rem', opacity: 0.9 }}>{prefix}</div>}
                    <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {listContent.map((item, idx) => (
                            <li key={idx} style={{ fontSize: '0.8rem', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            );
        }
        
        return <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.5, wordBreak: 'keep-all' }}>{cleanText}</p>;
    }
    
    let prefix = '';
    let listContent = parts;
    if (!cleanText.startsWith('-') && !cleanText.startsWith('*') && !cleanText.startsWith('·') && (parts[0].endsWith(':') || parts[0].includes('면세 한도') || parts[0].includes('유의사항'))) {
        prefix = parts[0];
        listContent = parts.slice(1);
    }
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {prefix && <div style={{ fontWeight: 700, fontSize: '0.8rem', opacity: 0.9 }}>{prefix}</div>}
            <ul style={{ margin: 0, paddingLeft: '16px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {listContent.map((item, idx) => {
                    const cleanItem = item.replace(/^[-*·]\s*/, '').trim();
                    if (!cleanItem) return null;
                    return (
                        <li key={idx} style={{ fontSize: '0.8rem', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                            {cleanItem}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

const renderFormattedText = (text: string) => {
    if (!text) return null;
    const cleanText = safeStr(text);
    const lines = cleanText.split('\n');
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lines.map((line, idx) => {
                let trimmed = line.trim();
                if (!trimmed) {
                    return <div key={idx} style={{ height: '6px' }} />;
                }

                // Inline bold formatting using **text**
                const formatInlineBold = (str: string) => {
                    const parts = str.split('**');
                    return parts.map((part, pIdx) => {
                        if (pIdx % 2 === 1) {
                            return <strong key={pIdx} style={{ color: '#0f172a', fontWeight: 700 }}>{part}</strong>;
                        }
                        return part;
                    });
                };

                // Identify if the line is a styled header/numbered header
                const isTitle = trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**');
                const isNumberedTitle = /^\**\d+\./.test(trimmed);

                if (isTitle || isNumberedTitle) {
                    const cleanTitle = trimmed.replace(/\*\*/g, '').replace(/^[#\s]*/, '');
                    return (
                        <h5 key={idx} style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', margin: '14px 0 6px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {cleanTitle}
                        </h5>
                    );
                }

                // Bullet point matching (* or - or •)
                if (trimmed.startsWith('*') || trimmed.startsWith('-') || trimmed.startsWith('•')) {
                    const cleanBullet = trimmed.replace(/^[\*\-•]\s*/, '');
                    return (
                        <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', paddingLeft: '8px', fontSize: '0.82rem', color: '#475569', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                            <span style={{ color: '#3b82f6', flexShrink: 0, marginTop: '4px', fontSize: '0.6rem' }}>●</span>
                            <span style={{ flex: 1 }}>{formatInlineBold(cleanBullet)}</span>
                        </div>
                    );
                }

                return (
                    <p key={idx} style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.6, wordBreak: 'keep-all' }}>
                        {formatInlineBold(trimmed)}
                    </p>
                );
            })}
        </div>
    );
};


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
        <div 
            className={`mc-section guide-accordion ${isOpen ? 'open' : ''}`}
            style={{ 
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)', 
                border: '1px solid #f1f5f9', 
                borderRadius: '16px',
                marginBottom: '16px' 
            }}
        >
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

    // 일정 내부 항공 정보 카드 렌더링
    if (item.type === 'flight' || (item.badges && item.badges.includes('항공편'))) {
        const info = item.flightInfo || {};
        const isReturn = item.title?.includes('오는') || item.title?.includes('귀국');
        return (
            <div style={{ margin: '14px 0 20px 0', width: '100%' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                    color: '#ffffff',
                    padding: '8px 16px',
                    borderRadius: '16px 16px 0 0',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>✈️ {isReturn ? '오는 편' : '가는 편'} 항공권 정보</span>
                    <span style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px' }}>{info.flightNo || (isReturn ? '7C2126' : '7C2125')}</span>
                </div>
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderTop: 'none',
                    borderRadius: '0 0 16px 16px',
                    padding: '16px 20px',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{info.departureCity || (isReturn ? '보홀 (TAG)' : '서울 (ICN)')}</div>
                            <div style={{ fontSize: '1.3rem', color: '#0f172a', fontWeight: 800, marginTop: '2px' }}>
                                {info.departureTime || (isReturn ? '02:00' : '21:30')}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, padding: '0 16px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#ea580c', fontWeight: 700 }}>
                                {info.airline || '제주항공'}
                            </div>
                            <div style={{ width: '100%', height: '2px', background: '#cbd5e1', margin: '8px 0', position: 'relative' }}>
                                <div style={{ position: 'absolute', top: '-3px', left: '0', width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }}></div>
                                <div style={{ position: 'absolute', top: '-3px', right: '0', width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }}></div>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#0d9488', fontWeight: 700 }}>
                                {info.duration || '3시간 45분 소요'}
                            </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>{info.arrivalCity || (isReturn ? '서울 (ICN)' : '보홀 (TAG)')}</div>
                            <div style={{ fontSize: '1.3rem', color: '#0f172a', fontWeight: 800, marginTop: '2px' }}>
                                {info.arrivalTime || (isReturn ? '07:30' : '01:15')}<span style={{ fontSize: '0.75rem', color: '#ef4444', marginLeft: '2px', verticalAlign: 'super' }}>+1</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Extract img tags from description to render them outside clamped container
    let cleanDesc = item.description || '';
    
    // 1. Safeguard: Remove Swiper navigation controls and "이전다음" text
    cleanDesc = cleanDesc
        .replace(/<a[^>]+href="#none"[^>]*>([\s\S]*?)<\/a>/gi, '')
        .replace(/<span[^>]+class="blind"[^>]*>([\s\S]*?)<\/span>/gi, '')
        .replace(/<div[^>]+class="controller"[^>]*>([\s\S]*?)<\/div>/gi, '')
        .replace(/이전다음/gi, '')
        .trim();

    // 2. Extract images
    const imgMatches = cleanDesc.match(/<img[^>]+src="([^">]+)"[^>]*>/gi) || [];
    const imageUrls: string[] = [];

    if (imgMatches.length > 0) {
        imgMatches.forEach((m: string) => {
            const srcMatch = m.match(/src="([^">]+)"/i);
            if (srcMatch) imageUrls.push(srcMatch[1]);
        });
        cleanDesc = cleanDesc.replace(/<img[^>]+>/gi, '');
    }

    // 2-1. Fallback: Check item.images or item.image if no HTML img tags extracted
    if (imageUrls.length === 0) {
        if (Array.isArray(item.images) && item.images.length > 0) {
            item.images.forEach((imgUrl: any) => {
                if (typeof imgUrl === 'string' && imgUrl.startsWith('http')) {
                    imageUrls.push(imgUrl);
                }
            });
        } else if (item.image && typeof item.image === 'string' && item.image.startsWith('http')) {
            imageUrls.push(item.image);
        }
    }

    // 3. Format and collapse duplicate spacing/newlines for ALL descriptions
    cleanDesc = cleanDesc
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/\n\s*\n+/g, '\n\n') // Collapse 3+ newlines (with optional spaces) to exactly 2 newlines (a clean paragraph break)
        .replace(/^\s*\n+/g, '')       // Remove leading newlines
        .replace(/\n+\s*$/g, '')       // Remove trailing newlines
        .trim();

    useEffect(() => {
        if (contentRef.current) {
            setNeedsCollapse(contentRef.current.scrollHeight > 64);
        }
    }, [cleanDesc]);

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
                        flexWrap: 'wrap',
                        gap: '6px',
                        cursor: needsCollapse ? 'pointer' : 'default',
                        lineHeight: 1.4
                    }} 
                    onClick={() => needsCollapse && setIsExpanded(!isExpanded)}
                >
                    <span dangerouslySetInnerHTML={{ __html: cleanupHtml(item.title) }} />
                    {item.badges && item.badges.map((b: string, bi: number) => (
                        <span key={bi} style={{
                            background: b === '선택관광' ? '#ef4444' : (b === 'MD추천' ? '#f59e0b' : (b === '항공편' ? '#2563eb' : '#10b981')),
                            color: '#ffffff',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            lineHeight: 1.2
                        }}>{b}</span>
                    ))}
                    {isLocation && <span style={{ fontSize: '0.9rem', color: '#94a3b8', fontWeight: 400, marginLeft: '2px' }}>›</span>}
                </div>
                
                {item.subtitle && (
                    <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, marginTop: '4px', lineHeight: 1.4 }}>
                        <span dangerouslySetInnerHTML={{ __html: cleanupHtml(item.subtitle) }} />
                    </div>
                )}

                {/* 관광지 제목 바로 아래 1:1 슬라이더 및 클릭 확대 */}
                {(() => {
                    const allImages: string[] = [...imageUrls];
                    if (item.image && !allImages.includes(item.image)) allImages.unshift(item.image);
                    if (item.images && Array.isArray(item.images)) {
                        item.images.forEach((img: string) => {
                            if (img && !allImages.includes(img)) allImages.push(img);
                        });
                    }

                    if (allImages.length === 0) return null;

                    return (
                        <div style={{ 
                            display: 'flex', 
                            gap: '10px', 
                            overflowX: 'auto', 
                            padding: '8px 0 10px 0', 
                            marginTop: '8px',
                            scrollSnapType: 'x mandatory',
                            WebkitOverflowScrolling: 'touch'
                        }}>
                            {allImages.map((url, uidx) => (
                                <img 
                                    key={uidx} 
                                    src={url} 
                                    style={{ 
                                        width: '340px',
                                        height: '190px',
                                        objectFit: 'cover', 
                                        borderRadius: '12px', 
                                        display: 'block',
                                        border: '1px solid #e2e8f0',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                        cursor: 'pointer',
                                        scrollSnapAlign: 'start',
                                        flexShrink: 0
                                    }} 
                                    alt="일정 이미지" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (typeof (window as any).openImageModal === 'function') {
                                            (window as any).openImageModal(url);
                                        }
                                    }}
                                />
                            ))}
                        </div>
                    );
                })()}



                {cleanDesc && (
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
                            dangerouslySetInnerHTML={{ __html: cleanupHtml(cleanDesc) }}
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

const getKoreaTimeText = (localTime: string, cityCode?: string, dayOffset = 0) => {
    if (!localTime || !cityCode) return null;
    const offset = getKSTOffset(cityCode);
    if (offset === 0) return null;
    try {
        const [h, m] = localTime.split(':').map(Number);
        let kH = h + offset;
        let finalOffset = dayOffset;
        if (kH >= 24) {
            kH -= 24;
            finalOffset += 1;
        } else if (kH < 0) {
            kH += 24;
            finalOffset -= 1;
        }
        const dayNote = finalOffset > 0 ? ` +${finalOffset}일` : (finalOffset < 0 ? ` ${finalOffset}일` : '');
        return `(한국 ${String(kH).padStart(2, '0')}:${String(m).padStart(2, '0')}${dayNote})`;
    } catch { return null; }
};

const formatDestination = (destStr?: string | null) => {
    if (!destStr) return '-';
    const list = destStr.split(/[,/]/).map(s => s.trim()).filter(Boolean);
    if (list.length <= 1) return destStr;
    return `${list[0]} 외 ${list.length - 1}곳`;
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
    
    const cleanInput = codeOrName.replace(/\s+/g, '').toUpperCase();
    
    // 1. Check if first 2 characters match airline code (e.g. EK, SK, KE)
    const code2 = cleanInput.slice(0, 2);
    if (AIRLINE_MAP[code2]) return AIRLINE_MAP[code2];
    
    // 2. Check if name matches (ignoring spaces)
    const byName = Object.values(AIRLINE_MAP).find(v => {
        const cleanName = v.name.replace(/\s+/g, '').toUpperCase();
        return cleanInput.includes(cleanName) || cleanName.includes(cleanInput);
    });
    if (byName) return byName;
    
    // 3. Fallback to extracting airline code from flight number (e.g. SK988 -> SK)
    const flightCodeMatch = codeOrName.match(/([A-Z0-9]{2})[0-9]+/i);
    if (flightCodeMatch) {
        const code = flightCodeMatch[1].toUpperCase();
        if (AIRLINE_MAP[code]) return AIRLINE_MAP[code];
    }
    
    return { name: codeOrName, logoUrl: null, color: '#3b82f6' };
};
const ParsedFlightCard = ({ day, isFirst, isLast }: { day: any, isFirst: boolean, isLast: boolean }) => {
    // 1일차(가는편)나 마지막일차가 아니면 일정표 내부 항공 카드 미출력
    if (!isFirst && !isLast) return null;

    let flightInfo = day.flight || day.flightInfo;

    // 1일차는 무조건 가는 편 항공 정보만 노출
    if (isFirst) {
        if (!flightInfo || String(flightInfo.title || '').includes('오는')) {
            flightInfo = {
                airline: day.airline || '항공사',
                flightNo: day.departureFlightNumber || '',
                departureCity: day.departureAirport || '인천',
                departureTime: day.departureTime || '',
                arrivalCity: day.arrivalAirport || '',
                arrivalTime: day.arrivalTime || ''
            };
        }
        if (!flightInfo.flightNo && !flightInfo.departureTime) return null;
        return <UnifiedFlightCard flightInfo={flightInfo} dateStr={day.date} title="가는 편" />;
    }

    // 마지막일차는 무조건 오는 편 항공 정보만 노출
    if (isLast) {
        if (!flightInfo || String(flightInfo.title || '').includes('가는')) {
            flightInfo = {
                airline: day.airline || '항공사',
                flightNo: day.returnFlightNumber || '',
                departureCity: day.returnDepartureAirport || '',
                departureTime: day.returnDepartureTime || '',
                arrivalCity: day.departureAirport || '인천',
                arrivalTime: day.returnArrivalTime || ''
            };
        }
        if (!flightInfo.flightNo && !flightInfo.departureTime) return null;
        return <UnifiedFlightCard flightInfo={flightInfo} dateStr={day.date} title="오는 편" />;
    }

    return null;
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '2px 0' }}>
        <div style={{ width: '2px', height: '14px', background: 'repeating-linear-gradient(to bottom, #cbd5e1 0, #cbd5e1 3px, transparent 3px, transparent 6px)' }}></div>
        <div style={{ 
            background: '#f1f5f9', 
            color: '#475569', 
            border: '1px solid #e2e8f0',
            fontSize: '0.72rem', 
            fontWeight: 600, 
            padding: '3px 10px', 
            borderRadius: '12px',
            margin: '2px 0',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
        }}>
            경유 대기 {duration}
        </div>
        <div style={{ width: '2px', height: '14px', background: 'repeating-linear-gradient(to bottom, #cbd5e1 0, #cbd5e1 3px, transparent 3px, transparent 6px)' }}></div>
    </div>
);

const getDayOffsets = (
    deptTime: string,
    deptCity: string | undefined,
    arrTime: string,
    arrCity: string | undefined,
    durationText: string
) => {
    try {
        const [dHour, dMin] = deptTime.split(':').map(Number);
        const [aHour, aMin] = arrTime.split(':').map(Number);
        if (isNaN(dHour) || isNaN(dMin) || isNaN(aHour) || isNaN(aMin)) return { local: 0, kst: 0 };

        const dOffset = getKSTOffset(deptCity);
        const aOffset = getKSTOffset(arrCity);

        let durMins = parseDurationToMins(durationText);
        if (durMins === 0) {
            let diff = (aHour * 60 + aMin + aOffset * 60) - (dHour * 60 + dMin + dOffset * 60);
            if (diff <= 0) diff += 1440;
            durMins = diff;
        }

        const dLocalMins = dHour * 60 + dMin;
        const aLocalMins = dLocalMins + durMins - (aOffset - dOffset) * 60;
        const localOffset = Math.floor(aLocalMins / 1440) - Math.floor(dLocalMins / 1440);

        const dKstMins = dHour * 60 + dMin + dOffset * 60;
        const aKstMins = dKstMins + durMins;
        const kstOffset = Math.floor(aKstMins / 1440) - Math.floor(dKstMins / 1440);

        return { local: localOffset, kst: kstOffset };
    } catch {
        return { local: 0, kst: 0 };
    }
};

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

    const dayOffsets = getDayOffsets(
        segment.departureTime,
        deptCity,
        segment.arrivalTime,
        arrCity,
        durationText
    );

    const ktDept = getKoreaTimeText(segment.departureTime, deptCode, 0);
    const ktArr = getKoreaTimeText(segment.arrivalTime, arrCode, dayOffsets.local);

    return (
        <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
            {/* Times & Cities Row with Centralized Flight Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Left: Departure */}
                <div style={{ textAlign: 'left', width: '32%' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', wordBreak: 'keep-all' }}>
                        {deptCity}{deptCode}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em' }}>
                        {segment.departureTime}
                    </div>
                    {ktDept && (
                        <div style={{ fontSize: '0.62rem', color: '#2563eb', fontWeight: 700, marginTop: '4px', background: '#eff6ff', padding: '1px 5px', borderRadius: '3px', display: 'inline-block' }}>
                            {ktDept}
                        </div>
                    )}
                </div>

                {/* Middle: Line & Flight info / Duration */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 6px' }}>
                    {/* 상단 2줄: 1줄(로고+항공사명), 2줄(편명 EK323) */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {info.logoUrl ? (
                                <img src={info.logoUrl} alt={info.name} style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ width: '14px', height: '14px', background: info.color, color: 'white', fontSize: '8px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px' }}>
                                    {info.name.slice(0, 1)}
                                </div>
                            )}
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                                {info.name}
                            </span>
                        </div>
                        {segment.flightNo && (
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', whiteSpace: 'nowrap' }}>
                                {segment.flightNo}
                            </span>
                        )}
                    </div>

                    {/* 비행선 라인 */}
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px 0' }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }}></div>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #cbd5e1 0%, #3b82f6 50%, #cbd5e1 100%)' }}></div>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }}></div>
                    </div>

                    {/* 하단: 소요시간 (동그라미/테두리 박스 없이 텍스트로 배치) */}
                    <div style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700, marginTop: '4px', whiteSpace: 'nowrap' }}>
                        {durationText} 소요
                    </div>
                </div>

                {/* Right: Arrival */}
                <div style={{ textAlign: 'right', width: '35%' }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', wordBreak: 'keep-all' }}>
                        {arrCity}{arrCode}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', marginTop: '2px', letterSpacing: '-0.02em', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '2px' }}>
                        <span>{segment.arrivalTime}</span>
                        {dayOffsets.local > 0 && (
                            <span style={{ 
                                fontSize: '0.72rem', 
                                color: '#ef4444', 
                                fontWeight: 800, 
                                verticalAlign: 'super',
                                marginTop: '-2px'
                            }}>
                                +{dayOffsets.local}
                            </span>
                        )}
                    </div>
                    {ktArr && (
                        <div style={{ fontSize: '0.62rem', color: '#2563eb', fontWeight: 700, marginTop: '4px', background: '#eff6ff', padding: '1px 5px', borderRadius: '3px', display: 'inline-block' }}>
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
    const isOutbound = title === '가는 편';
    
    // 강렬하고 선명한 헤더 스타일
    const headerBg = isOutbound ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' : 'linear-gradient(135deg, #581c87 0%, #7c3aed 100%)';

    return (
        <div style={{ marginTop: '12px', marginBottom: '24px' }}>
            {title && (
                <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    background: headerBg,
                    color: '#ffffff',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    marginBottom: '12px',
                    boxShadow: isOutbound ? '0 4px 12px rgba(37, 99, 235, 0.25)' : '0 4px 12px rgba(124, 58, 237, 0.25)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.05rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                            {title}
                        </span>
                        {dateStr && (
                            <span style={{ 
                                fontSize: '0.9rem', 
                                fontWeight: 600, 
                                color: 'rgba(255, 255, 255, 0.95)'
                            }}>
                                {formatDateStr(dateStr)}
                            </span>
                        )}
                    </div>
                </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {segments.map((seg: any, idx: number) => (
                    <Fragment key={idx}>
                        <FlightSegmentCard 
                            segment={seg} 
                            dateStr={undefined} 
                            isLastSegment={idx === segments.length - 1} 
                        />
                        {idx < segments.length - 1 && (
                            <LayoverConnector duration={seg.layoverDuration || '정보 없음'} />
                        )}
                    </Fragment>
                ))}
            </div>
        </div>
    );
};


export default function ConfirmationViewerPage({ isDummy = false }: { isDummy?: boolean }) {
    const params = useParams();
    const id = params.id as string;
    const getApiUrl = (path: string) => {
        return isDummy ? `/api/dummy${path}` : `/api${path}`;
    };
    const [doc, setDoc] = useState<ConfirmationDocument | null>(null);
    const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);

    useEffect(() => {
        (window as any).openImageModal = (url: string) => {
            setModalImageUrl(url);
        };
    }, []);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<TabKey>('개요');
    const [showHotelModal, setShowHotelModal] = useState(false);
    const [selectedHotelIdx, setSelectedHotelIdx] = useState(0);
    const [isHotelCollapsed, setIsHotelCollapsed] = useState(true);
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
    
    // 가이드 섹션 스크롤용 Refs
    const weatherRef = useRef<HTMLDivElement>(null);
    const clothingRef = useRef<HTMLDivElement>(null);
    const landmarksRef = useRef<HTMLDivElement>(null);
    const customsRef = useRef<HTMLDivElement>(null);
    const currencyRef = useRef<HTMLDivElement>(null);
    const roamingRef = useRef<HTMLDivElement>(null);

    const toggleSection = (sec: string) => {
        setExpandedSections(prev => ({ ...prev, [sec]: !prev[sec] }));
    };

    const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>, sectionId?: string) => {
        if (sectionId) {
            // 해당 섹션 아코디언이 닫혀있다면 엽니다.
            setExpandedSections(prev => ({ ...prev, [sectionId]: true }));
        }
        
        // 아코디언이 열리는 애니메이션 시간을 고려하여 약간의 지연 후 스크롤
        setTimeout(() => {
            if (ref.current) {
                const offset = 120; // 상단 탭바 오프셋
                const elementPosition = ref.current.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - offset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        }, 150);
    };

    const currencyKoMap: Record<string, string> = { 
        VND: '베트남', JPY: '일본', USD: '미국', EUR: '유럽', PHP: '필리핀', 
        THB: '태국', TWD: '대만', CNY: '중국', HKD: '홍콩', SGD: '싱가포르', 
        IDR: '인도네시아', MYR: '말레이시아', DKK: '덴마크', NOK: '노르웨이', 
        SEK: '스웨덴', ISK: '아이슬란드', GBP: '영국', CHF: '스위스' 
    };

    const [brandName, setBrandName] = useState('CLUBMODE TRAVEL');

    useEffect(() => {
        const loadDoc = async () => {
            try {
                const res = await fetch(getApiUrl(`/confirmation/${id}`));
                const json = await res.json();
                if (json.success) {
                    setDoc(json.data);
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

        const loadSettings = async () => {
            try {
                let tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;
                const { createClient } = await import('@/utils/supabase/client');
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    if (user.email === 'gktla71@gmail.com') {
                        tenantId = 'default_tenant';
                    } else if (user.id) {
                        tenantId = user.id;
                    }
                }

                const res = await fetch('/api/settings', {
                    headers: tenantId ? { 'x-tenant-id': tenantId } : {}
                });
                const json = await res.json();
                if (json.success && json.settings?.companyEnglishName) {
                    setBrandName(json.settings.companyEnglishName);
                }
            } catch (e) {
                // 기본값 유지
            }
        };

        loadDoc();
        loadSettings();
    }, [id]);

    // 환율 관련 설정 초기화 및 통화 목록 추출
    useEffect(() => {
        if (!doc?.secondaryResearch?.currency) return;
        const cur = doc.secondaryResearch.currency;
        
        // 통화 목록 추출 (targetCodes가 없으면 localCurrency에서 파싱)
        let codes = cur.targetCodes || [];
        if (codes.length === 0 && cur.localCurrency) {
            // 쉼표, 공백, 괄호 등으로 구분된 3자리 대문자 코드들을 모두 찾음
            const matches = cur.localCurrency.match(/[A-Z]{3}/g);
            if (matches) {
                codes = Array.from(new Set(matches)); // 중복 제거
            }
        }

        const initialCurr = codes[0] || cur.localCurrency;
        if (initialCurr && (!targetCurrency || targetCurrency.includes(','))) {
            setTargetCurrency(initialCurr);
        }
    }, [doc]);

    // 환율 가져오기 (선택된 통화가 바뀔 때마다)
    useEffect(() => {
        if (!targetCurrency) return;
        
        // 통화 코드 세척 (설명이 포함된 경우 대비: "DKK (덴마크)" -> "DKK")
        // 쉼표로 연결된 경우 첫 번째 것만 취함
        const cleanCode = targetCurrency.split(/[\s\(\),]/)[0].toUpperCase().replace(/[^A-Z]/g, '');
        if (cleanCode.length !== 3) return;

        setRateLoading(true);
        fetch(`/api/exchange-rate?from=KRW&to=${cleanCode}`)
            .then(r => r.json())
            .then(json => { 
                if (json.success) {
                    setExchangeRate(json.data.rate); 
                } else {
                    setExchangeRate(null);
                }
            })
            .catch(() => { 
                setExchangeRate(null);
            })
            .finally(() => setRateLoading(false));
    }, [targetCurrency]);

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
                    <div className="mc-brand">{brandName}</div>
                    <h1>확정서를 찾을 수 없습니다</h1>
                </div>
                <div className="mc-empty-notice">{error || '잘못된 링크입니다.'}</div>
            </div>
        );
    }

    // Ensure all optional nested objects/arrays exist with default empty fallbacks to prevent runtime client crashes
    if (doc) {
        doc.trip = doc.trip || {};
        doc.trip.adultCount = doc.trip.adultCount || 0;
        doc.trip.childCount = doc.trip.childCount || 0;
        doc.trip.infantCount = doc.trip.infantCount || 0;
        doc.trip.travelers = Array.isArray(doc.trip.travelers) ? doc.trip.travelers : [];
        
        doc.flight = doc.flight || {};
        doc.flight.airline = doc.flight.airline || '';
        doc.flight.departureTime = doc.flight.departureTime || '';
        doc.flight.departureFlightNumber = doc.flight.departureFlightNumber || '';
        doc.flight.departureAirport = doc.flight.departureAirport || '';
        doc.flight.arrivalTime = doc.flight.arrivalTime || '';
        doc.flight.departureSegments = Array.isArray(doc.flight.departureSegments) ? doc.flight.departureSegments : [];
        doc.flight.returnDepartureTime = doc.flight.returnDepartureTime || '';
        doc.flight.returnFlightNumber = doc.flight.returnFlightNumber || '';
        doc.flight.returnArrivalTime = doc.flight.returnArrivalTime || '';
        doc.flight.returnSegments = Array.isArray(doc.flight.returnSegments) ? doc.flight.returnSegments : [];
        
        doc.customer = doc.customer || {};
        doc.customer.name = doc.customer.name || '';
        
        doc.itinerary = Array.isArray(doc.itinerary) ? doc.itinerary : [];
        // Ensure day objects are safe
        doc.itinerary.forEach((day: any) => {
            if (day) {
                day.timeline = Array.isArray(day.timeline) ? day.timeline : [];
                day.activities = Array.isArray(day.activities) ? day.activities : [];
                day.dailyNotices = Array.isArray(day.dailyNotices) ? day.dailyNotices : [];
                day.meals = day.meals || {};
            }
        });
        
        doc.hotels = Array.isArray(doc.hotels) ? doc.hotels : [];
        doc.meetingInfo = Array.isArray(doc.meetingInfo) ? doc.meetingInfo : [];
        doc.inclusions = Array.isArray(doc.inclusions) ? doc.inclusions : [];
        doc.exclusions = Array.isArray(doc.exclusions) ? doc.exclusions : [];
        doc.files = Array.isArray(doc.files) ? doc.files : [];
        
        doc.secondaryResearch = doc.secondaryResearch || {};
        const sr = doc.secondaryResearch;
        sr.baggage = sr.baggage || {};
        sr.baggage.additionalNotes = Array.isArray(sr.baggage.additionalNotes) ? sr.baggage.additionalNotes : [];
        sr.weather = sr.weather || {};
        sr.weather.forecast = Array.isArray(sr.weather.forecast) ? sr.weather.forecast : [];
        sr.weather.clothingTips = Array.isArray(sr.weather.clothingTips) ? sr.weather.clothingTips : [];
        sr.currency = sr.currency || {};
        sr.currency.exchangeRateTips = Array.isArray(sr.currency.exchangeRateTips) ? sr.currency.exchangeRateTips : [];
        sr.roaming = sr.roaming || {};
        sr.roaming.tips = Array.isArray(sr.roaming.tips) ? sr.roaming.tips : [];
        sr.landmarks = Array.isArray(sr.landmarks) ? sr.landmarks : [];
        sr.customGuides = Array.isArray(sr.customGuides) ? sr.customGuides : [];
    }

    const totalTravelers = (doc.trip?.adultCount || 0) + (doc.trip?.childCount || 0) + (doc.trip?.infantCount || 0);
    const dDay = calcDDay(doc.trip?.departureDate);
    const checklistItems = typeof doc.checklist === 'string' ? doc.checklist.split('\n') : (Array.isArray(doc.checklist) ? doc.checklist : []);
    const realChecklistItems = checklistItems.filter((item: any) => typeof item === 'string' && item.trim() !== '');
    const checkedCount = checklistItems.filter((item: any, i: number) => typeof item === 'string' && item.trim() !== '' && checkedItems[`cl-${i}`]).length;

    return (
        <div className="mobile-confirm">
            {/* 상단 헤더 */}
            <div className="mc-header">
                <div className="mc-brand">{brandName}</div>
                <h1>{doc.trip.productName || '여행 확정서'}</h1>
                <div className="mc-subtitle" title={doc.trip.destination}>{formatDestination(doc.trip.destination)}</div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '14px', alignItems: 'center' }}>
                    <div className="mc-status-badge" style={{ marginTop: 0 }}>
                        <span className="badge-dot"></span>
                        {doc.status}
                    </div>
                    <a 
                        href={isDummy ? `/dummy/confirmation/${id}/print` : `/confirmation/${id}/print`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            color: '#fff',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                            backdropFilter: 'blur(4px)'
                        }}
                    >
                        🖨️ 인쇄용/PDF 보기
                    </a>
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
                                                segments: (Array.isArray(doc.flight.departureSegments) && doc.flight.departureSegments.length > 1) ? doc.flight.departureSegments : undefined
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
                                                segments: (Array.isArray(doc.flight.returnSegments) && doc.flight.returnSegments.length > 1) ? doc.flight.returnSegments : undefined
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
                        {/* 호텔 요약 카드 (다중 지원 - 기본 접힘) */}
                        {doc.hotels && doc.hotels.length > 0 ? (
                            <div className="mc-section" style={{ padding: isHotelCollapsed ? '16px' : '16px 16px 12px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <div 
                                    onClick={() => setIsHotelCollapsed(!isHotelCollapsed)}
                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', width: '100%', minHeight: '24px', margin: 0 }}
                                >
                                    <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 700, lineHeight: 1.2, display: 'flex', alignItems: 'center' }}>숙소 정보 ({doc.hotels.length}개)</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px', lineHeight: 1.2 }}>
                                        <span>{isHotelCollapsed ? '펼쳐보기' : '접기'}</span>
                                        <span style={{ fontSize: '0.65rem', transform: isHotelCollapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease', display: 'inline-flex', alignItems: 'center' }}>▼</span>
                                    </div>
                                </div>
                                {!isHotelCollapsed && (
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
                                )}
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
                                        
                                        const formatDateShort = (dateStr: string) => {
                                            if (!dateStr || dateStr.toLowerCase().includes('nan') || dateStr.toLowerCase().includes('undefined')) return '';
                                            return dateStr;
                                        };

                                        return (
                                            <div key={i} className={`mc-day-card ${isOpen ? 'open' : 'closed'}`}>
                                                <div className="day-header" onClick={() => toggleDay(i)} style={{ padding: 0, display: 'flex', alignItems: 'stretch', minHeight: '56px', borderBottom: '1px solid #f1f5f9' }}>
                                                    {day.title && day.title.trim() ? (
                                                        <>
                                                            <div className="day-number" style={{ background: '#475569', color: '#fff', padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '2px', minWidth: '76px', flexShrink: 0, textAlign: 'center' }}>
                                                                <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{day.day || (i + 1)}일차</span>
                                                                {formatDateShort(day.date) && <span style={{ fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 500 }}>{formatDateShort(day.date)}</span>}
                                                            </div>
                                                            <div style={{ flex: 1, padding: '10px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px', minWidth: 0 }}>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>{day.title}</div>
                                                                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {((day.timeline || []).filter((item: any) => item.title && !item.title.includes('조식') && !item.title.includes('중식') && !item.title.includes('석식')).map((item: any) => item.title).join(', ')) || '상세내용을 확인해보세요'}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div style={{ flex: 1, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                            <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1d4ed8' }}>{day.day || (i + 1)}일차</span>
                                                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>{formatDateShort(day.date)}</span>
                                                        </div>
                                                    )}
                                                    <div className={`day-chevron ${isOpen ? 'open' : ''}`} style={{ alignSelf: 'center', marginRight: '16px' }}>›</div>
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
                                                                    {day.timeline
                                                                        .filter((item: any) => item.type !== 'flight' && !(item.badges && item.badges.includes('항공편')))
                                                                        .map((item: any, ti: number) => (
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
                                                                            {day.meals.breakfast && <div>조식: {day.meals.breakfast}</div>}
                                                                            {day.meals.lunch && <div>중식: {day.meals.lunch}</div>}
                                                                            {day.meals.dinner && <div>석식: {day.meals.dinner}</div>}
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

                {/* ============================== 3. 필요서류 ============================== */}
                {activeTab === '필요서류' && (
                    <>
                        <div className="mc-section">
                            <div className="mc-section-title">
                                <span className="sec-icon">📎</span> 필수 전자 서류
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

                        {/* 입국 및 비자/세관 정보 */}
                        {doc.secondaryResearch?.customs && (
                            <div className="mc-section" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
                                <div className="mc-section-title" style={{ paddingLeft: '4px', marginBottom: '14px' }}>
                                    <span className="sec-icon">🛂</span> 국가별 입국 & 비자/세관 가이드
                                </div>

                                 {/* (1) 국가별 핵심 경보 (식품류 등) */}
                                 {doc.secondaryResearch.customs.majorAlert?.title && (
                                     <div style={{ marginBottom: '16px', border: '1.5px solid #fecaca', background: '#fff', padding: '16px', borderRadius: '16px', boxShadow: '0 4px 6px rgba(239, 68, 68, 0.03)' }}>
                                         <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#dc2626', marginBottom: '8px', textAlign: 'center' }}>
                                             🚨 {safeStr(doc.secondaryResearch.customs.majorAlert.title)}
                                         </div>
                                         <div style={{ fontSize: '0.8rem', color: '#7f1d1d', lineHeight: 1.5, marginBottom: '10px', textAlign: 'center', wordBreak: 'keep-all' }}>
                                             {safeStr(doc.secondaryResearch.customs.majorAlert.content)}
                                         </div>
                                         {doc.secondaryResearch.customs.majorAlert.penalty && (
                                             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#dc2626', fontSize: '0.75rem', fontWeight: 700, background: '#fef2f2', padding: '6px 10px', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                                                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                                 {safeStr(doc.secondaryResearch.customs.majorAlert.penalty)}
                                             </div>
                                         )}
                                     </div>
                                 )}

                                 {/* (2) 사전 입국 준비 및 비자/ETA 퀵링크 */}
                                 {doc.secondaryResearch.customs.links && doc.secondaryResearch.customs.links.length > 0 && (
                                     <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                                         {doc.secondaryResearch.customs.links.map((link: any, li: number) => (
                                             <div key={li} style={{ border: '1.5px solid #005a96', borderRadius: '16px', overflow: 'hidden', background: '#fff', boxShadow: '0 4px 8px rgba(0, 90, 150, 0.03)' }}>
                                                 <div style={{ background: '#005a96', padding: '10px 16px', display: 'flex', alignItems: 'center', color: '#fff', gap: '10px' }}>
                                                     <span style={{ background: '#fff', color: '#005a96', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                         {link.type === 'visa' ? '비자/ETA' : (link.type === 'customs' ? '세관신고' : '입국신고')}
                                                     </span>
                                                     <span style={{ fontSize: '0.88rem', fontWeight: 800, lineHeight: 1.3, wordBreak: 'keep-all' }}>{safeStr(link.label)}</span>
                                                 </div>
                                                 <div style={{ padding: '14px' }}>
                                                     <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
                                                         <div style={{ fontSize: '0.78rem', color: '#334155', lineHeight: 1.5, wordBreak: 'keep-all' }}>
                                                             {safeStr(link.description)}
                                                         </div>
                                                     </div>
                                                     {link.howTo && (
                                                         <div style={{ marginBottom: '10px' }}>
                                                             <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontSize: '0.78rem', fontWeight: 800, marginBottom: '2px' }}>
                                                                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                                 신청 및 준비 방법
                                                             </div>
                                                             <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.4, wordBreak: 'keep-all' }}>
                                                                 {safeStr(link.howTo)}
                                                             </div>
                                                         </div>
                                                     )}
                                                     <a
                                                         href={link.url}
                                                         target="_blank"
                                                         rel="noopener noreferrer"
                                                         style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(to right, #00ace2, #008ebc)', color: '#fff', padding: '10px', borderRadius: '10px', fontWeight: 800, gap: '6px', fontSize: '0.82rem', boxShadow: '0 4px 8px rgba(0, 172, 226, 0.1)' }}
                                                     >
                                                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                                         공식 사이트 바로가기
                                                     </a>
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 )}

                                 {/* (3) 면세 한도 & 여권 유의사항 */}
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
                                     <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 6px rgba(14, 165, 233, 0.03)' }}>
                                         <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0369a1', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg> 면세 한도
                                         </div>
                                         <div style={{ fontSize: '0.8rem', color: '#075985', lineHeight: 1.5 }}>
                                             {formatBulletPoints(doc.secondaryResearch.customs.dutyFree)}
                                         </div>
                                     </div>
                                     <div style={{ background: '#f5f3ff', border: '1.5px solid #ddd6fe', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 6px rgba(124, 58, 237, 0.03)' }}>
                                         <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#6d28d9', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> 여권 유의사항
                                         </div>
                                         <div style={{ fontSize: '0.8rem', color: '#5b21b6', lineHeight: 1.5 }}>
                                             {formatBulletPoints(doc.secondaryResearch.customs.passportNote)}
                                         </div>
                                     </div>
                                </div>

                                 {/* (4) 입국 절차 */}
                                 {doc.secondaryResearch.customs.arrivalProcedure && doc.secondaryResearch.customs.arrivalProcedure.steps?.length > 0 && (
                                     <div style={{ marginBottom: '16px', border: '1.5px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                                         <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                             <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b' }}>{safeStr(doc.secondaryResearch.customs.arrivalProcedure.title || '입국 절차')}</span>
                                         </div>
                                         <div style={{ padding: '14px' }}>
                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                 {doc.secondaryResearch.customs.arrivalProcedure.steps.map((st: any, i: number) => (
                                                     <div key={i} style={{ display: 'flex', gap: '10px' }}>
                                                         <div style={{ background: '#0284c7', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800, flexShrink: 0, marginTop: '2px' }}>{i + 1}</div>
                                                         <div>
                                                             <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', marginBottom: '2px' }}>{safeStr(st.step)}</div>
                                                             <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4, wordBreak: 'keep-all' }}>{safeStr(st.description)}</div>
                                                         </div>
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                     </div>
                                 )}

                                 {/* (5) 미성년자 자녀 입국 규정 */}
                                 {(doc.secondaryResearch.customs.minorEntry || doc.secondaryResearch.customs.minorDetail) && (
                                     <div style={{ marginBottom: '16px', background: '#fffde7', border: '1.5px solid #fef08a', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(254, 240, 138, 0.1)' }}>
                                         <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#854d0e', borderBottom: '1px solid #fef9c3', background: '#fefcbf' }}>
                                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                                             <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>미성년자 동반 입국 규정</span>
                                         </div>
                                         <div style={{ padding: '14px' }}>
                                             {doc.secondaryResearch.customs.minorEntry && (
                                                 <div style={{ fontSize: '0.78rem', color: '#713f12', lineHeight: 1.5, marginBottom: '8px', wordBreak: 'keep-all' }}>
                                                     {safeStr(doc.secondaryResearch.customs.minorEntry)}
                                                 </div>
                                             )}
                                             {doc.secondaryResearch.customs.minorDetail && (
                                                 <div style={{ background: '#fff', border: '1px solid #fef9c3', borderRadius: '10px', padding: '10px', borderLeft: '4px solid #facc15' }}>
                                                     <div style={{ color: '#854d0e', fontSize: '0.75rem', lineHeight: 1.4, display: 'flex', gap: '6px' }}>
                                                         <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                                                         <span style={{ wordBreak: 'keep-all' }}>{safeStr(doc.secondaryResearch.customs.minorDetail)}</span>
                                                     </div>
                                                 </div>
                                             )}
                                         </div>
                                     </div>
                                 )}

                                 {/* (6) 반입 금지/제한 품목 */}
                                 {doc.secondaryResearch.customs.prohibitedItems && doc.secondaryResearch.customs.prohibitedItems.length > 0 && (
                                     <div style={{ marginBottom: '16px', border: '1.5px solid #fee2e2', background: '#fff5f5', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.01)' }}>
                                         <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #fde2e2', background: '#fee2e2' }}>
                                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                                             <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#dc2626' }}>반입 금지 및 제한 품목</span>
                                         </div>
                                         <div style={{ padding: '14px' }}>
                                             {doc.secondaryResearch.customs.prohibitedItems.map((pi: any, pii: number) => (
                                                 <div key={pii} style={{ marginBottom: '10px' }}>
                                                     <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#991b1b', marginBottom: '4px' }}>{safeStr(pi.category)}</div>
                                                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                         {pi.items.map((it: any, iti: number) => (
                                                             <span key={iti} style={{ fontSize: '0.72rem', background: '#fff', color: '#dc2626', border: '1px solid #fee2e2', padding: '3px 8px', borderRadius: '20px', fontWeight: 700 }}>
                                                                 {safeStr(it)}
                                                             </span>
                                                         ))}
                                                     </div>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 )}
                            </div>
                        )}
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
                        {doc.cancellationPolicy && (Array.isArray(doc.cancellationPolicy) ? doc.cancellationPolicy.length > 0 : String(doc.cancellationPolicy).trim().length > 0) && (
                            <div className="mc-section">
                                <div className="mc-section-title">
                                    <span className="sec-icon">⚠️</span> 취소 · 환불 규정
                                </div>
                                <div className="mc-policy-text" style={{ whiteSpace: 'pre-line', lineHeight: 1.8, fontSize: '0.87rem', color: '#334155' }}>
                                    {Array.isArray(doc.cancellationPolicy)
                                        ? doc.cancellationPolicy.join('\n\n')
                                        : String(doc.cancellationPolicy)}
                                </div>
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
                {/* ============================== 6. 날씨 ============================== */}
                {activeTab === '날씨' && doc.secondaryResearch && (() => {
                    const sr = doc.secondaryResearch;
                    return (
                        <div className="mc-guide-container" style={{ padding: '0 12px 40px' }}>
                            {sr.weather?.summary && (
                                <div className="mc-section" style={{ margin: '0 0 16px 0' }}>
                                    <div className="mc-section-title">
                                        <span className="sec-icon">☀️</span> 현지 날씨 & 기후 요약
                                    </div>
                                    <p style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, wordBreak: 'keep-all', margin: 0 }}>
                                        {safeStr(sr.weather?.summary)}
                                    </p>
                                </div>
                            )}

                            {/* 일별 예보 카드 */}
                            {sr.weather?.forecast && sr.weather.forecast.length > 0 && (
                                <div className="mc-section" style={{ background: 'transparent', boxShadow: 'none', padding: 0, margin: 0 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '4px' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                        일별 기온 및 날씨
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '12px', WebkitOverflowScrolling: 'touch', paddingLeft: '4px', paddingRight: '4px' }}>
                                        {sr.weather.forecast.map((day: any, i: number) => {
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
                                                    minHeight: '265px',
                                                    height: '265px'
                                                }}>
                                                    <div style={{ height: '82px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981', marginBottom: '4px', letterSpacing: '-0.02em' }}>{i + 1}일차</div>
                                                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>{displayDate}</div>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, opacity: 0.9 }}>
                                                            {`(${String(day.location || simplifyDestination(doc.trip.destination)).replace(/[\(\)]/g, '')})`}
                                                        </div>
                                                    </div>
                                                    
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

                                                    <div style={{ 
                                                        height: '42px', 
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
                            )}
                        </div>
                    );
                })()}
                {activeTab === '날씨' && !doc.secondaryResearch && (
                    <div className="mc-section">
                        <div className="mc-empty-guide">
                            <span style={{ fontSize: '2.5rem' }}>🔬</span>
                            <p style={{ fontWeight: 600, fontSize: '1rem' }}>날씨 정보가 아직 준비되지 않았습니다.</p>
                        </div>
                    </div>
                )}

                {/* ============================== 7. 복장 ============================== */}
                {activeTab === '복장' && doc.secondaryResearch && (() => {
                    const sr = doc.secondaryResearch;
                    return (
                        <div className="mc-guide-container" style={{ padding: '0 12px 40px' }}>
                            {sr.weather?.clothingTips && sr.weather.clothingTips.length > 0 && (
                                <div className="mc-section" style={{ background: 'transparent', boxShadow: 'none', padding: 0, margin: '0 0 20px 0' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '4px' }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.62 1.96v.18A2 2 0 0 0 3 7.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.5a2 2 0 0 0 1-1.9v-.18a2 2 0 0 0-1.62-1.96Z"></path><path d="M12 21V7"></path><path d="M16 21V11"></path><path d="M8 21V11"></path></svg>
                                        상세기후 및 복장 가이드
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {sr.weather.clothingTips.map((tip: any, i: number) => {
                                            const getIcon = (title: string) => {
                                                if (title.includes('상의') || title.includes('외투')) return '🧥';
                                                if (title.includes('하의')) return '👖';
                                                if (title.includes('신발')) return '👟';
                                                return '🎒';
                                            };
                                            return (
                                                <div key={i} style={{ background: '#fff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
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
                            )}

                            {/* 최종 요약 */}
                            {sr.weather?.packingSummary && (
                                <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '12px', padding: '14px', display: 'flex', gap: '12px', alignItems: 'center', margin: 0 }}>
                                    <div style={{ fontSize: '1.2rem' }}>🎒</div>
                                    <div style={{ fontSize: '0.82rem', color: '#1e40af', fontWeight: 600, lineHeight: 1.5, wordBreak: 'keep-all' }}>
                                        {safeStr(sr.weather?.packingSummary)}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
                {activeTab === '복장' && !doc.secondaryResearch && (
                    <div className="mc-section">
                        <div className="mc-empty-guide">
                            <span style={{ fontSize: '2.5rem' }}>🧥</span>
                            <p style={{ fontWeight: 600, fontSize: '1rem' }}>복장 정보가 아직 준비되지 않았습니다.</p>
                        </div>
                    </div>
                )}

                {/* ============================== 8. 환전/로밍 ============================== */}
                {activeTab === '환전/로밍' && doc.secondaryResearch && (() => {
                    const sr = doc.secondaryResearch;
                    return (
                        <div className="mc-guide-container" style={{ padding: '0 12px 40px' }}>
                            {/* 환전 정보 카드 */}
                            {sr.currency && (
                                <div className="mc-section" style={{ margin: '0 0 16px 0' }}>
                                    <div className="mc-section-title">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg> 환전 가이드
                                    </div>
                                    <div className="currency-tip-cards" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {sr.currency.calculationTip && (
                                            <div className="currency-tip-card highlight" style={{ background: '#eff6ff', border: '1px solid #dbeafe', padding: '14px', borderRadius: '10px' }}>
                                                <div className="ct-title" style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e40af', marginBottom: '6px' }}>간편 환산법</div>
                                                <p style={{ fontSize: '0.8rem', color: '#1e40af', lineHeight: 1.5, margin: 0 }}>{safeStr(sr.currency.calculationTip)}</p>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px', lineHeight: 1.4 }}>
                                                    *정확한 현재 환율이 아닌, 현지에서 체감 물가를 빠르게 계산하기 위한 대략적인 암산법입니다.
                                                </div>
                                            </div>
                                        )}
                                        
                                        {sr.currency.exchangeTip && (
                                            <div className="currency-tip-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '10px' }}>
                                                <div className="ct-title" style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>환전 팁</div>
                                                <ul className="guide-list-wrap" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                                    {safeStr(sr.currency.exchangeTip).split(/[\n·\-\*]/).filter(t => t.trim().length > 1).map((text, i) => (
                                                        <li key={i} className="guide-list-item" style={{ position: 'relative', paddingLeft: '14px', fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, marginBottom: '4px' }}>
                                                            <span style={{ position: 'absolute', left: 0, color: '#94a3b8' }}>•</span>
                                                            {text.trim()}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {sr.currency.tipCulture && (
                                            <div className="currency-tip-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '10px' }}>
                                                <div className="ct-title" style={{ fontSize: '0.85rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>팁 문화</div>
                                                <ul className="guide-list-wrap" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                                    {safeStr(sr.currency.tipCulture).split(/[\n·\-\*]/).filter(t => t.trim().length > 1).map((text, i) => (
                                                        <li key={i} className="guide-list-item" style={{ position: 'relative', paddingLeft: '14px', fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, marginBottom: '4px' }}>
                                                            <span style={{ position: 'absolute', left: 0, color: '#94a3b8' }}>•</span>
                                                            {text.trim()}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 환전 계산기 위젯 */}
                            {sr.currency && (
                                <div className="mc-calc-widget mc-section" style={{ margin: '0 0 16px 0' }}>
                                    <div className="mc-calc-title" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="16" y1="14" x2="16" y2="18"></line><line x1="16" y1="10" x2="16" y2="10.01"></line><line x1="12" y1="10" x2="12" y2="10.01"></line><line x1="8" y1="10" x2="8" y2="10.01"></line><line x1="12" y1="14" x2="12" y2="14.01"></line><line x1="8" y1="14" x2="8" y2="14.01"></line><line x1="12" y1="18" x2="12" y2="18.01"></line><line x1="8" y1="18" x2="8" y2="18.01"></line></svg>
                                        실시간 환전 계산기
                                    </div>
                                    
                                    {(() => {
                                        const cur = sr.currency;
                                        let codes = cur?.targetCodes || [];
                                        if (codes.length === 0 && cur?.localCurrency) {
                                            const matches = cur.localCurrency.match(/[A-Z]{3}/g);
                                            if (matches) codes = Array.from(new Set(matches));
                                        }
                                        
                                        if (codes.length <= 1) return null;

                                        return (
                                            <div style={{ marginBottom: '16px' }}>
                                                <select
                                                    value={targetCurrency}
                                                    onChange={(e) => {
                                                        setTargetCurrency(e.target.value);
                                                        setCalcAmount('');
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        borderRadius: '12px',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 600,
                                                        border: '1.5px solid #e2e8f0',
                                                        background: '#fff',
                                                        color: '#1e293b',
                                                        cursor: 'pointer',
                                                        appearance: 'none',
                                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`,
                                                        backgroundRepeat: 'no-repeat',
                                                        backgroundPosition: 'right 12px center',
                                                        backgroundSize: '16px',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                                    }}
                                                >
                                                    {codes.map((code: string) => {
                                                        const cleanCode = code.split(/[\s\(\),]/)[0].toUpperCase().replace(/[^A-Z]/g, '');
                                                        return (
                                                            <option key={code} value={code}>
                                                                {cleanCode}{currencyKoMap[cleanCode] ? ` (${currencyKoMap[cleanCode]})` : ''}
                                                                {code.includes('(') && !currencyKoMap[cleanCode] ? ` ${code.substring(code.indexOf('('))}` : ''}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            </div>
                                        );
                                    })()}

                                    {rateLoading ? (
                                        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>환율 로딩 중...</div>
                                    ) : exchangeRate ? (
                                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            <div className="mc-calc-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                                                    {(() => {
                                                        const clean = targetCurrency.split(/[\s\(\),]/)[0].toUpperCase().replace(/[^A-Z]/g, '');
                                                        return calcDirection === 'krwToTarget' ? 'KRW' : clean;
                                                    })()}
                                                    <span className="mc-calc-sublabel" style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '4px' }}>({(() => {
                                                        const clean = targetCurrency.split(/[\s\(\),]/)[0].toUpperCase().replace(/[^A-Z]/g, '');
                                                        return calcDirection === 'krwToTarget' ? '원' : (currencyKoMap[clean] || '현지 화폐');
                                                    })()})</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={calcAmount}
                                                    onChange={e => setCalcAmount(e.target.value)}
                                                    placeholder="금액 입력"
                                                    className="mc-calc-input"
                                                    style={{ border: 'none', background: 'transparent', textAlign: 'right', fontSize: '1rem', fontWeight: 700, color: '#1e293b', width: '60%', outline: 'none' }}
                                                />
                                            </div>

                                            <div
                                                className="mc-calc-arrow-float"
                                                onClick={() => {
                                                    setCalcDirection(prev => prev === 'krwToTarget' ? 'targetToKrw' : 'krwToTarget');
                                                    setCalcAmount('');
                                                }}
                                                style={{ alignSelf: 'center', cursor: 'pointer', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', margin: '4px 0' }}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline><polyline points="5 12 12 5 19 12"></polyline></svg>
                                            </div>

                                            <div className="mc-calc-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                                                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
                                                    {(() => {
                                                        const clean = targetCurrency.split(/[\s\(\),]/)[0].toUpperCase().replace(/[^A-Z]/g, '');
                                                        return calcDirection === 'krwToTarget' ? clean : 'KRW';
                                                    })()}
                                                    <span className="mc-calc-sublabel" style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '4px' }}>({(() => {
                                                        const clean = targetCurrency.split(/[\s\(\),]/)[0].toUpperCase().replace(/[^A-Z]/g, '');
                                                        return calcDirection === 'krwToTarget' ? (currencyKoMap[clean] || '현지 화폐') : '원';
                                                    })()})</span>
                                                </label>
                                                <div className="mc-calc-result" style={{ fontSize: '1rem', fontWeight: 700, color: '#0ea5e9' }}>
                                                    {calcAmount ? (
                                                        calcDirection === 'krwToTarget'
                                                            ? (parseFloat(calcAmount) * exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                                            : (parseFloat(calcAmount) / exchangeRate).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                                    ) : '0'}
                                                </div>
                                            </div>
                                            <div className="mc-calc-rate" style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>
                                                기준 환율: 1 KRW = {exchangeRate.toFixed(6)} {(() => {
                                                    return targetCurrency.split(/[\s\(\),]/)[0].toUpperCase().replace(/[^A-Z]/g, '');
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.6 }}>환율 정보를 불러올 수 없습니다.</div>
                                    )}
                                </div>
                            )}

                            {/* 로밍 및 통신 */}
                            {sr.roaming && (
                                <div className="mc-section" style={{ margin: 0 }}>
                                    <div className="mc-section-title">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line></svg> 로밍 · 통신
                                    </div>
                                    <div className="mc-roaming-grid">
                                        <div className="mc-roaming-header-banner" style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg> 통신 환경 안내
                                        </div>
                                        <p className="mc-roaming-subtitle" style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                                            {sr.roaming.description || `${safeStr(doc.trip.destination).split(' ').pop()}은(는) 주요 관광지와 리조트 내에서 사용이 원활합니다. 출국 전 데이터 로밍 차단 또는 로밍 요금제 신청이 필수입니다.`}
                                        </p>
                                        <div className="roaming-option-cards" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <div className="roaming-opt-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#fff', border: '1px solid #e2e8f0', padding: '14px', borderRadius: '12px' }}>
                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
                                                    <div className="r-opt-badge" style={{ background: '#0284c7', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800 }}>1</div>
                                                    <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>통신사 데이터 로밍 (가장 편리)</strong>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', width: '100%' }}>
                                                    <div style={{ background: '#f8fafc', padding: '8px 2px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>SKT</div>
                                                        <a href="tel:02-6343-9000" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none', marginBottom: '2px' }}>02-6343-9000</a>
                                                        <a href="tel:1599-2011" style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', textDecoration: 'none' }}>1599-2011</a>
                                                    </div>
                                                    <div style={{ background: '#f8fafc', padding: '8px 2px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>KT</div>
                                                        <a href="tel:02-2190-0901" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none', marginBottom: '2px' }}>02-2190-0901</a>
                                                        <a href="tel:1588-0608" style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', textDecoration: 'none' }}>1588-0608</a>
                                                    </div>
                                                    <div style={{ background: '#f8fafc', padding: '8px 2px', borderRadius: '10px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                                                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1d4ed8', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>LG U+</div>
                                                        <a href="tel:02-3416-7010" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', textDecoration: 'none', marginBottom: '2px' }}>02-3416-7010</a>
                                                        <a href="tel:1544-0010" style={{ display: 'block', fontSize: '0.65rem', color: '#64748b', textDecoration: 'none' }}>1544-0010</a>
                                                    </div>
                                                </div>
                                                {sr.roaming.carriers && (
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b', background: '#f1f5f9', padding: '6px 10px', borderRadius: '8px', marginTop: '4px', lineHeight: 1.4 }}>
                                                        <strong>💡 현지 통신사 파트너:</strong> {sr.roaming.carriers}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="roaming-opt-card" style={{ display: 'flex', gap: '10px', background: '#fff', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '12px', alignItems: 'center' }}>
                                                <div className="r-opt-badge" style={{ background: '#0284c7', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>2</div>
                                                <div className="r-opt-body" style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <strong style={{ fontSize: '0.82rem', color: '#1e293b' }}>현지 유심 (USIM)</strong>
                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>현지 번호 제공, 한국 사전 구매 권장</span>
                                                </div>
                                            </div>

                                            <div className="roaming-opt-card" style={{ display: 'flex', gap: '10px', background: '#fff', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '12px', alignItems: 'center' }}>
                                                <div className="r-opt-badge" style={{ background: '#0284c7', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>3</div>
                                                <div className="r-opt-body" style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <strong style={{ fontSize: '0.82rem', color: '#1e293b' }}>E-심 (eSIM)</strong>
                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>QR코드로 간편 개통 (지원 단말기 확인 요망)</span>
                                                </div>
                                            </div>

                                            <div className="roaming-opt-card" style={{ display: 'flex', gap: '10px', background: '#fff', border: '1px solid #e2e8f0', padding: '12px 14px', borderRadius: '12px', alignItems: 'center' }}>
                                                <div className="r-opt-badge" style={{ background: '#0284c7', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, flexShrink: 0 }}>4</div>
                                                <div className="r-opt-body" style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <strong style={{ fontSize: '0.82rem', color: '#1e293b' }}>와이파이 도시락</strong>
                                                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>가족 단위 기기 여러 대 연결 추천</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="roaming-tip-box" style={{ background: '#eff6ff', borderRadius: '10px', padding: '12px', marginTop: '12px', fontSize: '0.8rem', color: '#1e3a8a', lineHeight: 1.5 }}>
                                            <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg> 유심/eSIM 추천
                                            </strong>
                                            {safeStr(sr.roaming.simEsim) || '그랩(Grab) 호출이나 길찾기 시 데이터가 필요하므로 유심이나 로밍 준비를 추천합니다.'}
                                        </div>

                                        {sr.roaming.roamingTip && (
                                            <div className="roaming-tip-box" style={{ background: '#fffbeb', borderRadius: '10px', padding: '12px', marginTop: '10px', fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5, border: '1px solid #fef3c7' }}>
                                                <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> 통신 이용 꿀팁
                                                </strong>
                                                {sr.roaming.roamingTip}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
                {activeTab === '환전/로밍' && !doc.secondaryResearch && (
                    <div className="mc-section">
                        <div className="mc-empty-guide">
                            <span style={{ fontSize: '2.5rem' }}>💸</span>
                            <p style={{ fontWeight: 600, fontSize: '1rem' }}>환전/로밍 정보가 아직 준비되지 않았습니다.</p>
                        </div>
                    </div>
                )}

                {/* ============================== 9. 관광지 ============================== */}
                {activeTab === '관광지' && doc.secondaryResearch && (() => {
                    const sr = doc.secondaryResearch;
                    return (
                        <div className="mc-guide-container" style={{ padding: '0 12px 40px' }}>
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
                                <div className="landmark-hero" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', overflow: 'hidden', marginBottom: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', margin: '0' }}>
                                    {sr.landmarks[0].imageUrl && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={sr.landmarks[0].imageUrl} alt={safeStr(sr.landmarks[0].name)} className="landmark-hero-img" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                                    )}
                                    <div className="landmark-hero-info" style={{ padding: '20px' }}>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{safeStr(sr.landmarks[0].name)}</h4>
                                        {sr.landmarks[0].nameLocal && <span className="landmark-local" style={{ display: 'block', fontSize: '0.8rem', color: '#64748b', marginBottom: '10px', fontWeight: 500 }}>{safeStr(sr.landmarks[0].nameLocal)}</span>}
                                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#475569', lineHeight: 1.6, wordBreak: 'keep-all' }}>{safeStr(sr.landmarks[0].description)}</p>
                                    </div>
                                </div>
                            )}
                            {/* 나머지 랜드마크: 그리드 카드 */}
                            <div className="landmark-grid" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
                                {sr.landmarks?.slice(1).map((lm: any, i: number) => (
                                    <div key={i} className="landmark-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                                        {lm.imageUrl && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={lm.imageUrl} alt={safeStr(lm.name)} className="landmark-card-img" style={{ width: '100%', height: '180px', objectFit: 'cover' }} />
                                        )}
                                        <div className="landmark-card-body" style={{ padding: '20px' }}>
                                            <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{safeStr(lm.name)}</h4>
                                            {lm.nameLocal && <span className="landmark-local-sm" style={{ display: 'block', fontSize: '0.78rem', color: '#64748b', marginBottom: '8px', fontWeight: 500 }}>{safeStr(lm.nameLocal)}</span>}
                                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, wordBreak: 'keep-all' }}>{safeStr(lm.description)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
                {activeTab === '관광지' && !doc.secondaryResearch && (
                    <div className="mc-section">
                        <div className="mc-empty-guide">
                            <span style={{ fontSize: '2.5rem' }}>🗺️</span>
                            <p style={{ fontWeight: 600, fontSize: '1rem' }}>관광지 정보가 아직 준비되지 않았습니다.</p>
                        </div>
                    </div>
                )}

                {/* ============================== 10. 기타 ============================== */}
                {activeTab === '기타' && doc.secondaryResearch?.customGuides && doc.secondaryResearch.customGuides.length > 0 && (
                    <div className="mc-guide-container" style={{ padding: '0 12px 40px' }}>
                        {doc.secondaryResearch.customGuides.map((guide: any, gi: number) => (
                            <GuideAccordion
                                key={gi}
                                id={`customGuide-${gi}`}
                                title={<><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sec-icon-svg"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> {safeStr(guide.topic)}</>}
                                isOpen={expandedSections[`customGuide-${gi}`] || false}
                                onToggle={toggleSection}
                            >
                                {guide.sections?.map((sec: any, si: number) => (
                                    <div key={si} className="custom-sub-section" style={{ marginBottom: '20px' }}>
                                        <h4 className="css-title" style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', margin: '0 0 10px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>{safeStr(sec.title)}</h4>

                                        {/* steps 타입 */}
                                        {sec.type === 'steps' && sec.steps && (
                                            <div className="css-steps" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {sec.steps.map((s: any, idx: number) => (
                                                    <div key={idx} className="css-step" style={{ display: 'flex', gap: '10px' }}>
                                                        <div className="css-step-num" style={{ background: '#e2e8f0', color: '#475569', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, flexShrink: 0 }}>{idx + 1}</div>
                                                        <div>
                                                            <div className="css-step-label" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>{safeStr(s.step)}</div>
                                                            <div className="css-step-detail" style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>{safeStr(s.detail)}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* table 타입 */}
                                        {sec.type === 'table' && sec.headers && sec.rows && (
                                            <div className="css-table-wrap" style={{ overflowX: 'auto' }}>
                                                <table className="css-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                                                    <thead><tr style={{ background: '#f8fafc' }}>{sec.headers.map((h: any, hi: number) => <th key={hi} style={{ padding: '8px 10px', borderBottom: '1.5px solid #e2e8f0', fontWeight: 700, color: '#475569' }}>{safeStr(h)}</th>)}</tr></thead>
                                                    <tbody>
                                                        {sec.rows.map((row: any, ri: number) => (
                                                            <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}>{row.map((c: any, ci: number) => <td key={ci} style={{ padding: '8px 10px', color: '#475569' }}>{safeStr(c)}</td>)}</tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {/* list 타입 */}
                                        {sec.type === 'list' && sec.items && (
                                            <ul className="css-list" style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                                                {sec.items.map((item: any, ii: number) => <li key={ii} style={{ marginBottom: '4px' }}>{safeStr(item)}</li>)}
                                            </ul>
                                        )}

                                        {/* text 타입 */}
                                        {sec.type === 'text' && sec.content && (
                                            <div className="css-text" style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                                                {renderFormattedText(sec.content)}
                                            </div>
                                        )}

                                        {/* route 타입 */}
                                        {sec.type === 'route' && sec.route && (
                                            <div className="css-route" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                                                {sec.route.map((r: any, ri: number) => (
                                                    <span key={ri} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <span className="css-route-badge" style={{ background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600 }}>{safeStr(r)}</span>
                                                        {ri < (sec.route?.length || 0) - 1 && <span className="css-route-arrow" style={{ color: '#94a3b8', fontSize: '0.8rem' }}>→</span>}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </GuideAccordion>
                        ))}
                    </div>
                )}
                {activeTab === '기타' && (!doc.secondaryResearch?.customGuides || doc.secondaryResearch.customGuides.length === 0) && (
                    <div className="mc-section">
                        <div className="mc-empty-guide">
                            <span style={{ fontSize: '2.5rem' }}>🗂️</span>
                            <p style={{ fontWeight: 600, fontSize: '1rem' }}>추가 가이드 정보가 없습니다.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* 하단 액션 바 */}
            <div className="mc-bottom-bar">
                <a href={`tel:${(doc as any).agencyPhone || '010-9307-9004'}`} className="mc-action-btn kakao" style={{ flex: 2 }}>
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

            {/* 일정 이미지 확대 보기 모달 (PinchZoomModal 활용) */}
            {modalImageUrl && (
                <PinchZoomModal 
                    src={modalImageUrl} 
                    onClose={() => setModalImageUrl(null)} 
                />
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

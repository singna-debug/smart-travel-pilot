"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import '../../../print-confirmation.css';

// 확정서 데이터 인터페이스
interface ConfirmationDocument {
    id: string;
    status: string;
    reservationNumber: string;
    customer: {
        name: string;
        phone: string;
    };
    trip: {
        productName: string;
        destination: string;
        duration: string;
        departureDate: string;
        returnDate: string;
        adultCount: number;
        childCount: number;
        infantCount: number;
        travelers?: Array<{ name: string; type: string }>;
    };
    flight: {
        airline: string;
        departureAirport: string;
        departureFlightNumber: string;
        departureTime: string;
        arrivalTime: string;
        returnFlightNumber: string;
        returnDepartureTime: string;
        returnArrivalTime: string;
        departureSegments?: any[];
        returnSegments?: any[];
        arrivalAirport?: string;
        returnDepartureAirport?: string;
    };
    hotels: Array<{
        name: string;
        englishName?: string;
        address?: string;
        checkIn?: string;
        checkOut?: string;
        amenities?: string[];
    }>;
    meetingInfo?: Array<{
        type?: string;
        location?: string;
        time?: string;
        description?: string;
        imageUrl?: string;
    }>;
    itinerary: Array<{
        day: number | string;
        date?: string;
        title?: string;
        transport?: string;
        flight?: any;
        timeline?: any[];
        activities?: string[];
        items?: any[];
        description?: string;
        content?: string;
        hotel?: string;
        hotelDetails?: any;
        dailyNotices?: string[];
        meals?: {
            breakfast?: string;
            lunch?: string;
            dinner?: string;
        };
    }>;
    inclusions?: string[];
    exclusions?: string[];
    notices?: string;
    checklist?: string;
    cancellationPolicy?: string;
    secondaryResearch?: {
        weather?: {
            summary?: string;
            forecast?: Array<{ date: string; tempMin: string; tempMax: string; description: string; icon: string }>;
            clothingTips?: string[];
            packingSummary?: string;
        };
        baggage?: {
            checkedWeight?: string;
            checkedNote?: string;
            carryonWeight?: string;
            carryonNote?: string;
        };
        landmarks?: Array<{ name: string; nameLocal?: string; description: string; imageUrl?: string }>;
        customs?: {
            rules?: string[];
        };
        currency?: {
            localCurrency?: string;
            exchangeRateTips?: string[];
        };
        roaming?: {
            tips?: string[];
        };
    };
}

export default function PrintConfirmationPage() {
    const params = useParams();
    const router = useRouter();
    const id = params.id as string;
    const [doc, setDoc] = useState<ConfirmationDocument | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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
            } catch (err) {
                setError('데이터를 불러오는 중 오류가 발생했습니다.');
            } finally {
                setLoading(false);
            }
        };
        loadDoc();
    }, [id]);

    // 브라우저 탭 타이틀 동적 변경
    useEffect(() => {
        if (!doc) return;
        const customerName = doc.customer?.name || '고객';
        const destination = doc.trip?.destination || '여행지';
        document.title = `여행 확정서 - ${customerName}_${destination} (인쇄용)`;
    }, [doc]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="print-confirm">
                <div className="pc-loading">
                    <div className="pc-loading-spinner"></div>
                    <p>인쇄용 확정서를 준비하고 있습니다...</p>
                </div>
            </div>
        );
    }

    if (error || !doc) {
        return (
            <div className="print-confirm">
                <div className="pc-error">
                    <span className="pc-error-icon">⚠️</span>
                    <h2>데이터 로드 실패</h2>
                    <p>{error || '확정서 정보를 불러오지 못했습니다.'}</p>
                    <button onClick={() => router.back()} className="pc-error-btn">이전 페이지로 돌아가기</button>
                </div>
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
        // Protect hotel fields
        doc.hotels.forEach((h: any) => {
            if (h) {
                h.amenities = Array.isArray(h.amenities) ? h.amenities : [];
            }
        });

        doc.meetingInfo = Array.isArray(doc.meetingInfo) ? doc.meetingInfo : [];
        doc.inclusions = Array.isArray(doc.inclusions) ? doc.inclusions : [];
        doc.exclusions = Array.isArray(doc.exclusions) ? doc.exclusions : [];
        
        doc.secondaryResearch = doc.secondaryResearch || {};
        const sr = doc.secondaryResearch;
        sr.baggage = sr.baggage || {};
        sr.weather = sr.weather || {};
        sr.weather.forecast = Array.isArray(sr.weather.forecast) ? sr.weather.forecast : [];
        sr.weather.clothingTips = Array.isArray(sr.weather.clothingTips) ? sr.weather.clothingTips : [];
        sr.currency = sr.currency || {};
        sr.currency.exchangeRateTips = Array.isArray(sr.currency.exchangeRateTips) ? sr.currency.exchangeRateTips : [];
        sr.roaming = sr.roaming || {};
        sr.roaming.tips = Array.isArray(sr.roaming.tips) ? sr.roaming.tips : [];
        sr.landmarks = Array.isArray(sr.landmarks) ? sr.landmarks : [];
    }

    const trip = doc.trip || {};
    const flight = doc.flight || {};
    const customer = doc.customer || {};
    const itinerary = doc.itinerary || [];
    const hotels = doc.hotels || [];
    const meetingInfo = doc.meetingInfo || [];
    const secondaryResearch = doc.secondaryResearch || {};

    const totalTravelers = (trip.adultCount || 0) + (trip.childCount || 0) + (trip.infantCount || 0);

    const formatPrintDate = (dStr?: string) => {
        if (!dStr) return '-';
        try {
            const date = new Date(dStr);
            const week = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
            return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${week})`;
        } catch {
            return dStr;
        }
    };

    const cleanupHtml = (html?: string) => {
        if (!html) return '';
        // HTML 이스케이프 해제
        let unescaped = String(html)
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'");
            
        // 마크다운 이미지 렌더링 (![alt](url))
        unescaped = unescaped.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" />');

        // 이미지 태그 폭 제한, 인쇄시 잘리지 않게
        return unescaped.replace(/<img([^>]*)>/gi, '<img$1 style="max-width:100%; height:auto; display:block; border-radius:12px; margin:10px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />');
    };

    const getExtraTransportation = (day: any) => {
        if (!day) return null;
        if (day.transport && day.transport !== '해당없음' && day.transport !== 'null') return day.transport;
        if (day.flight && day.flight.airline) {
            return `항공이동 (${day.flight.airline} ${day.flight.flightNo || ''})`;
        }
        return null;
    };

    const noticesList = typeof doc.notices === 'string' ? doc.notices.split('\n').filter((l: string) => l.trim()) : (Array.isArray(doc.notices) ? doc.notices : []);
    const checklistItems = typeof doc.checklist === 'string' ? doc.checklist.split('\n').filter((l: string) => l.trim()) : (Array.isArray(doc.checklist) ? doc.checklist : []);

    return (
        <div className="print-confirm">
            {/* 액션 바 (인쇄 시 숨김) */}
            <div className="pc-action-bar">
                <button onClick={() => router.back()} className="pc-back-btn">
                    ← 모바일 뷰로 돌아가기
                </button>
                <button onClick={handlePrint} className="pc-print-btn">
                    🖨️ 인쇄하기 / PDF 저장
                </button>
            </div>

            {/* A4 용지 영역 */}
            <div className="pc-paper">

                {/* ─── 1. 헤더 ─── */}
                <div className="pc-header">
                    <div className="pc-header-left">
                        <div className="pc-brand">CLUBMODE TRAVEL</div>
                        <h1 className="pc-doc-title">여행 예약 확정서</h1>
                        <p className="pc-doc-subtitle">TRAVEL CONFIRMATION & ITINERARY</p>
                    </div>
                    <div className="pc-header-right">
                        <div className="pc-status-badge">
                            <span className="pc-badge-dot"></span>
                            {doc.status || '확정'}
                        </div>
                        <p className="pc-print-date">출력일자: {new Date().toLocaleDateString('ko-KR')}</p>
                    </div>
                </div>

                {/* ─── 2. 예약 기본 정보 ─── */}
                <div className="pc-section">
                    <h3 className="pc-section-title">
                        <span className="pc-section-icon">📋</span>
                        예약 기본 정보
                    </h3>
                    <table className="pc-info-table">
                        <tbody>
                            <tr>
                                <th>여행 상품명</th>
                                <td colSpan={3}>{trip.productName || '-'}</td>
                            </tr>
                            <tr>
                                <th>예약번호</th>
                                <td className="pc-highlight">{doc.reservationNumber || '-'}</td>
                                <th>예약대표자</th>
                                <td>{customer.name || '-'} 님</td>
                            </tr>
                            <tr>
                                <th>목적지</th>
                                <td>{trip.destination || '-'}</td>
                                <th>여행 기간</th>
                                <td>{trip.duration || '-'}</td>
                            </tr>
                            <tr>
                                <th>출발일</th>
                                <td className="pc-highlight-green">{formatPrintDate(trip.departureDate)}</td>
                                <th>귀국일</th>
                                <td>{formatPrintDate(trip.returnDate)}</td>
                            </tr>
                            <tr>
                                <th>예약 인원</th>
                                <td colSpan={3}>
                                    성인 {trip.adultCount || 0}명 / 소아 {trip.childCount || 0}명 / 유아 {trip.infantCount || 0}명 (총 {totalTravelers}명)
                                </td>
                            </tr>
                            {trip.travelers && trip.travelers.length > 0 && (
                                <tr>
                                    <th>여행자 명단</th>
                                    <td colSpan={3}>
                                        {trip.travelers.map((t, i) =>
                                            `${i + 1}. ${t.name}(${t.type === 'adult' ? '성인' : t.type === 'child' ? '소아' : '유아'})`
                                        ).join(', ')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* ─── 3. 항공 스케줄 ─── */}
                {(flight.airline || flight.departureTime) && (
                    <div className="pc-section">
                        <h3 className="pc-section-title">
                            <span className="pc-section-icon">✈️</span>
                            항공 스케줄
                        </h3>
                        <table className="pc-flight-table">
                            <thead>
                                <tr>
                                    <th style={{width:'14%', textAlign:'center'}}>구분</th>
                                    <th style={{width:'22%', textAlign:'center'}}>항공사 / 편명</th>
                                    <th style={{width:'26%', textAlign:'center'}}>출발</th>
                                    <th style={{width:'26%', textAlign:'center'}}>도착</th>
                                    <th style={{width:'12%', textAlign:'center'}}>비고</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flight.departureTime && (
                                    <tr>
                                        <td className="pc-departure-label">출발편</td>
                                        <td style={{textAlign:'center', fontWeight:600}}>
                                            {flight.airline} / {flight.departureFlightNumber}
                                        </td>
                                        <td style={{textAlign:'center'}}>
                                            {flight.departureAirport} {flight.departureTime}
                                        </td>
                                        <td style={{textAlign:'center'}}>
                                            {flight.arrivalAirport || trip.destination} {flight.arrivalTime}
                                        </td>
                                        <td style={{textAlign:'center', color:'#64748b'}}>
                                            {flight.departureSegments && flight.departureSegments.length > 1 ? '경유' : '직항'}
                                        </td>
                                    </tr>
                                )}
                                {flight.returnDepartureTime && (
                                    <tr>
                                        <td className="pc-return-label">귀국편</td>
                                        <td style={{textAlign:'center', fontWeight:600}}>
                                            {flight.airline} / {flight.returnFlightNumber}
                                        </td>
                                        <td style={{textAlign:'center'}}>
                                            {flight.returnDepartureAirport || trip.destination} {flight.returnDepartureTime}
                                        </td>
                                        <td style={{textAlign:'center'}}>
                                            {flight.departureAirport} {flight.returnArrivalTime}
                                        </td>
                                        <td style={{textAlign:'center', color:'#64748b'}}>
                                            {flight.returnSegments && flight.returnSegments.length > 1 ? '경유' : '직항'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* 경유 안내 */}
                        {((flight.departureSegments && flight.departureSegments.length > 1) ||
                          (flight.returnSegments && flight.returnSegments.length > 1)) && (
                            <div className="pc-flight-note">
                                <strong>💡 경유 안내:</strong> 본 여정은 경유 노선입니다. 수하물 자동 연계 여부는 공항 카운터에서 수속 시 최종 확인해 주시기 바라며, 경유지 환승 표지판(Transfer)을 따라 이동해 주세요.
                            </div>
                        )}
                    </div>
                )}

                {/* ─── 4. 숙박 정보 ─── */}
                {hotels && hotels.length > 0 && (
                    <div className="pc-section">
                        <h3 className="pc-section-title">
                            <span className="pc-section-icon">🏨</span>
                            숙박 정보
                        </h3>
                        <table className="pc-hotel-table">
                            <thead>
                                <tr>
                                    <th style={{width:'10%', textAlign:'center'}}>구분</th>
                                    <th style={{width:'45%'}}>호텔명 / 주소</th>
                                    <th style={{width:'28%', textAlign:'center'}}>투숙 기간</th>
                                    <th style={{width:'17%', textAlign:'center'}}>편의시설</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hotels.map((h, i) => (
                                    <tr key={i}>
                                        <td style={{textAlign:'center', fontWeight:700, color:'#475569'}}>호텔 {i + 1}</td>
                                        <td>
                                            <div className="pc-hotel-name">{h.name || '-'}</div>
                                            {h.englishName && <div className="pc-hotel-sub">{h.englishName}</div>}
                                            {h.address && <div className="pc-hotel-sub">{h.address}</div>}
                                        </td>
                                        <td style={{textAlign:'center'}}>
                                            {h.checkIn ? h.checkIn.slice(5) : '-'} ~ {h.checkOut ? h.checkOut.slice(5) : '-'}
                                        </td>
                                        <td style={{textAlign:'center', fontSize:'0.7rem', color:'#94a3b8'}}>
                                            {h.amenities && h.amenities.length > 0 ? h.amenities.slice(0, 3).join(', ') : '기본제공'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ─── 5. 미팅 및 수속 안내 ─── */}
                {meetingInfo && meetingInfo.length > 0 && (
                    <div className="pc-section">
                        <h3 className="pc-section-title">
                            <span className="pc-section-icon">🤝</span>
                            공항 미팅 및 카운터 안내
                        </h3>
                        {meetingInfo.map((m, i) => (
                            <div key={i} className="pc-meeting-card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                {m.imageUrl && (
                                    <img 
                                        src={m.imageUrl} 
                                        alt={m.type || '미팅안내'} 
                                        style={{ width: '260px', height: '160px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} 
                                    />
                                )}
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {m.time && (
                                            <div style={{ fontSize: '0.74rem', lineHeight: 1.4, display: 'flex', alignItems: 'center' }}>
                                                <strong style={{ color: '#475569', display: 'inline-block', width: '70px', flexShrink: 0 }}>• 미팅시간:</strong>
                                                <span style={{ fontWeight: 700, color: '#4f46e5' }}>{m.time}</span>
                                            </div>
                                        )}
                                        {m.location && (
                                            <div style={{ fontSize: '0.74rem', lineHeight: 1.45, display: 'flex', alignItems: 'flex-start' }}>
                                                <strong style={{ color: '#475569', display: 'inline-block', width: '70px', flexShrink: 0 }}>• 미팅장소:</strong>
                                                <span style={{ fontWeight: 700, color: '#0f172a', flex: 1, wordBreak: 'keep-all' }}>{m.location}</span>
                                            </div>
                                        )}
                                        {m.description && (
                                            <div style={{ fontSize: '0.72rem', lineHeight: 1.45, display: 'flex', alignItems: 'flex-start', marginTop: '4px', borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                                                <strong style={{ color: '#475569', display: 'inline-block', width: '70px', flexShrink: 0 }}>• 상세설명:</strong>
                                                <span style={{ color: '#64748b', flex: 1, wordBreak: 'keep-all' }} dangerouslySetInnerHTML={{ __html: cleanupHtml(m.description) }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}



                {/* ─── 6. 상세 여정표 ─── */}
                {itinerary && itinerary.length > 0 && (
                    <div className="pc-section">
                        <h3 className="pc-section-title">
                            <span className="pc-section-icon">📅</span>
                            상세 여정표
                        </h3>
                        <div className="pc-itinerary">
                            {itinerary.map((day, idx) => {
                                const hasActivities = day.activities && Array.isArray(day.activities) && day.activities.length > 0;
                                const hasTimeline = day.timeline && Array.isArray(day.timeline) && day.timeline.length > 0;
                                const extraTransport = getExtraTransportation(day);

                                return (
                                    <div key={idx} className="pc-day-card">
                                        {/* 일차별 헤더 */}
                                        <div className="pc-day-header">
                                            <div className="pc-day-header-left">
                                                <span className="pc-day-num">{String(day.day).includes('일') ? day.day : `${day.day}일차`}</span>
                                                {day.date && <span className="pc-day-date">{formatPrintDate(day.date)}</span>}
                                            </div>
                                            {day.title && <div className="pc-day-title">{day.title}</div>}
                                        </div>

                                        {/* 일정 본문 */}
                                        <div className="pc-day-body">
                                            
                                            {/* HTML 콘텐츠 랜더링 */}
                                            {hasTimeline ? (
                                                <div className="pc-timeline">
                                                    {day.timeline!.map((item: any, i: number) => (
                                                        <div key={i} className="pc-timeline-item">
                                                            <div className="pc-timeline-title">
                                                                <span className="pc-timeline-marker">{item.type === 'location' ? '📍' : '•'}</span>
                                                                <span dangerouslySetInnerHTML={{ __html: cleanupHtml(item.title) }} />
                                                                {item.subtitle && <span className="pc-timeline-subtitle">(<span dangerouslySetInnerHTML={{ __html: cleanupHtml(item.subtitle) }} />)</span>}
                                                            </div>
                                                            {item.description && (
                                                                <div className="pc-timeline-desc" dangerouslySetInnerHTML={{ __html: cleanupHtml(item.description) }} />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : hasActivities ? (
                                                <div className="pc-timeline">
                                                    {day.activities!.flatMap((act: string) => act.split('\n')).map((line: string, ai: number) => {
                                                        let cleanText = line.trim();
                                                        if (!cleanText) return null;
                                                        
                                                        let processedText = cleanupHtml(cleanText);
                                                        const hasImage = processedText.toLowerCase().includes('<img');
                                                        
                                                        if (!hasImage) {
                                                            processedText = processedText.replace(/(이동|구경|감상|산책|관람|방문|체크인|진행|제공|이용|탑승|출발|도착|해산|귀환|관광|쇼핑|체험|시식|식사|숙박|휴식)합니다\.?$/, '$1');
                                                        }
                                                        
                                                        return (
                                                            <div key={ai} className="pc-timeline-item" style={{ borderBottom: 'none', padding: '4px 0' }}>
                                                                <div className="pc-timeline-desc" style={{ margin: 0, display: 'flex', gap: '8px' }}>
                                                                    <span style={{ marginTop: '2px', flexShrink: 0 }}>{hasImage ? '🖼️' : '•'}</span>
                                                                    <div style={{ flex: 1, wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: processedText }} />
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            ) : (day.description || day.content) ? (
                                                <div className="pc-day-desc" dangerouslySetInnerHTML={{ __html: cleanupHtml(day.description || day.content || '') }} />
                                            ) : (
                                                <p className="pc-empty-day">자유 일정 또는 전일 휴식 일정입니다.</p>
                                            )}

                                            {/* 하단 통합 정보 박스 (숙소/식사/교통) */}
                                            <div className="pc-day-footer-box">
                                                {/* 호텔 */}
                                                {(day.hotel || day.hotelDetails?.name) && (
                                                    <div className="pc-summary-row">
                                                        <span className="pc-summary-label">🏨 예정호텔</span>
                                                        <span className="pc-summary-val">{day.hotel || day.hotelDetails?.name}</span>
                                                    </div>
                                                )}
                                                {/* 식사 */}
                                                {day.meals && (
                                                    <div className="pc-summary-row">
                                                        <span className="pc-summary-label">🍽️ 식사</span>
                                                        <div className="pc-meal-inline">
                                                            <span className="pc-meal">조식 : {day.meals.breakfast && day.meals.breakfast !== '불포함' ? day.meals.breakfast : '자유식/불포함'}</span>
                                                            <span className="pc-meal-div">|</span>
                                                            <span className="pc-meal">중식 : {day.meals.lunch && day.meals.lunch !== '불포함' ? day.meals.lunch : '자유식/불포함'}</span>
                                                            <span className="pc-meal-div">|</span>
                                                            <span className="pc-meal">석식 : {day.meals.dinner && day.meals.dinner !== '불포함' ? day.meals.dinner : '자유식/불포함'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* 교통 */}
                                                {extraTransport && (
                                                    <div className="pc-summary-row">
                                                        <span className="pc-summary-label">🚌 이동수단</span>
                                                        <span className="pc-summary-val">{extraTransport}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 일별 유의사항 */}
                                            {day.dailyNotices && day.dailyNotices.length > 0 && (
                                                <div className="pc-day-notices">
                                                    {day.dailyNotices.map((note: string, ni: number) => (
                                                        <div key={ni} className="pc-day-notice-item">
                                                            <strong>안내</strong> {note}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─── 7. 안내사항 및 포함/불포함 ─── */}
                {noticesList.length > 0 && (
                    <div className="pc-section">
                        <h3 className="pc-section-title">
                            <span className="pc-section-icon">📢</span>
                            안내사항
                        </h3>
                        <div className="pc-guide-box" style={{ background: '#fff', marginBottom: '20px' }}>
                            <ul className="pc-list">
                                {noticesList.map((notice, i) => (
                                    <li key={i}>{notice}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="pc-dual-grid">
                    <div className="pc-inc-card">
                        <h4 className="pc-inc-title">🟢 포함 사항</h4>
                        {doc.inclusions && doc.inclusions.length > 0 ? (
                            <ul className="pc-list pc-list-green">
                                {doc.inclusions.map((inc, i) => (
                                    <li key={i}>{inc}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="pc-empty-text">일정표 상세 내용을 참조해 주세요.</p>
                        )}
                    </div>

                    <div className="pc-exc-card">
                        <h4 className="pc-exc-title">🔴 불포함 사항</h4>
                        {doc.exclusions && doc.exclusions.length > 0 ? (
                            <ul className="pc-list pc-list-red">
                                {doc.exclusions.map((exc, i) => (
                                    <li key={i}>{exc}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="pc-empty-text">일정표 상세 내용을 참조해 주세요.</p>
                        )}
                    </div>
                </div>

                {/* ─── 8. 여행 준비물 (체크리스트) ─── */}
                {checklistItems.length > 0 && (
                    <div className="pc-section">
                        <h3 className="pc-section-title">
                            <span className="pc-section-icon">🎒</span>
                            여행 준비물
                        </h3>
                        <div className="pc-guide-box" style={{ background: '#fff' }}>
                            <ul className="pc-checklist-grid">
                                {checklistItems.map((item, i) => (
                                    <li key={i} className="pc-check-item">
                                        <div className="pc-check-box"></div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {/* ─── 9. 여행지 종합 가이드 및 중요 안내사항 ─── */}
                {(secondaryResearch.baggage || secondaryResearch.weather || secondaryResearch.currency || secondaryResearch.roaming || secondaryResearch.customs || (secondaryResearch.landmarks && secondaryResearch.landmarks.length > 0)) && (
                    <div className="pc-section">
                        <h3 className="pc-section-title">
                            <span className="pc-section-icon">💡</span>
                            여행지 종합 가이드 및 중요 안내사항
                        </h3>
                        <div className="pc-guide-blocks">
                            {/* 1. 입국 규정 및 비자/세관 */}
                            {secondaryResearch.customs && (
                                <div className="pc-guide-block">
                                    <h4 className="pc-block-title">
                                        <div className="pc-block-icon pc-icon-blue">🛂</div>
                                        국가별 입국 & 비자/세관 가이드
                                    </h4>
                                    {secondaryResearch.customs.majorAlert?.title && (
                                        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '10px', borderRadius: '8px', marginBottom: '10px', fontSize: '0.72rem' }}>
                                            <div style={{ color: '#dc2626', fontWeight: 800 }}>🚨 {secondaryResearch.customs.majorAlert.title}</div>
                                            <div style={{ color: '#7f1d1d', marginTop: '4px', lineHeight: 1.4 }}>{secondaryResearch.customs.majorAlert.content}</div>
                                            {secondaryResearch.customs.majorAlert.penalty && (
                                                <div style={{ color: '#b91c1c', fontWeight: 700, marginTop: '4px', fontSize: '0.68rem' }}>⚠️ 규정 위반시: {secondaryResearch.customs.majorAlert.penalty}</div>
                                            )}
                                        </div>
                                    )}
                                    {secondaryResearch.customs.links && secondaryResearch.customs.links.length > 0 && (
                                        <div style={{ marginTop: '12px', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                                            <h5 style={{ margin: '0 0 8px 0', fontSize: '0.74rem', fontWeight: 800, color: '#334155' }}>🔗 입국/비자 온라인 사이트 (모바일 QR 스캔)</h5>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {secondaryResearch.customs.links.map((link: any, idx: number) => {
                                                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(link.url)}`;
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px', gap: '12px' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                                                                    {link.label}
                                                                </div>
                                                                <div style={{ fontSize: '0.68rem', color: '#475569', lineHeight: 1.4, marginBottom: link.howTo ? '4px' : 0 }}>
                                                                    {link.description}
                                                                </div>
                                                                {link.howTo && (
                                                                    <div style={{ fontSize: '0.65rem', color: '#0284c7', fontWeight: 600 }}>
                                                                        💡 {link.howTo}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px' }}>
                                                                <img 
                                                                    src={qrUrl} 
                                                                    alt={`${link.label} QR`} 
                                                                    style={{ width: '64px', height: '64px', display: 'block' }} 
                                                                />
                                                                <span style={{ fontSize: '0.55rem', color: '#94a3b8', marginTop: '4px', fontWeight: 700 }}>스캔하기</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    <ul className="pc-guide-list" style={{ marginBottom: '10px' }}>
                                        {secondaryResearch.customs.dutyFree && <li><strong>면세 한도:</strong> {secondaryResearch.customs.dutyFree}</li>}
                                        {secondaryResearch.customs.passportNote && <li><strong>여권 유의사항:</strong> {secondaryResearch.customs.passportNote}</li>}
                                        {secondaryResearch.customs.minorEntry && <li><strong>미성년 자녀 입국 규정:</strong> {secondaryResearch.customs.minorEntry}</li>}
                                    </ul>

                                </div>
                            )}

                            {/* 2. 날씨 & 복장 및 일별 기온 예보 */}
                            {secondaryResearch.weather && (
                                <div className="pc-guide-block">
                                    <h4 className="pc-block-title">
                                        <div className="pc-block-icon pc-icon-orange">☀️</div>
                                        현지 기후 및 복장 가이드
                                    </h4>
                                    <p className="pc-guide-text">{secondaryResearch.weather.summary || '출발 전 일기예보를 최종 참조해 주세요.'}</p>
                                    {secondaryResearch.weather.clothingTips && secondaryResearch.weather.clothingTips.length > 0 && (
                                        <ul className="pc-guide-list" style={{ marginBottom: '10px' }}>
                                            {secondaryResearch.weather.clothingTips.map((tip: any, idx) => (
                                                <li key={idx}>
                                                    {typeof tip === 'object' && tip !== null ? (
                                                        <>
                                                            {tip.title && <strong>[{tip.title}] </strong>}
                                                            {tip.content}
                                                        </>
                                                    ) : (
                                                        tip
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    
                                    {secondaryResearch.weather.forecast && secondaryResearch.weather.forecast.length > 0 && (
                                        <div style={{ marginTop: '16px', borderTop: '1px dashed #e2e8f0', paddingTop: '16px' }}>
                                            <h5 style={{ margin: '0 0 6px 0', fontSize: '0.74rem' }}>📅 현지 주간 일별 기온 예보</h5>
                                            <div className="pc-forecast-grid">
                                                {secondaryResearch.weather.forecast.map((day: any, i: number) => {
                                                    let displayDate = day.date;
                                                    try {
                                                        if (trip.departureDate) {
                                                            const d = new Date(trip.departureDate);
                                                            d.setDate(d.getDate() + i);
                                                            const month = d.getMonth() + 1;
                                                            const date = d.getDate();
                                                            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
                                                            displayDate = `${month}/${date}(${dayNames[d.getDay()]})`;
                                                        }
                                                    } catch {}
                                                    
                                                    // 날씨 설명에서 "정보 없음" 또는 불필요한 텍스트 필터링
                                                    const desc = day.description && day.description !== '정보 없음' ? day.description : '-';
                                                    const maxT = (day.tempMax || day.temp_max || '').replace(/[^0-9.-]/g, '');
                                                    const minT = (day.tempMin || day.temp_min || '').replace(/[^0-9.-]/g, '');

                                                    return (
                                                        <div key={i} className="pc-forecast-card">
                                                            <div className="pc-forecast-date">{displayDate}</div>
                                                            <div className="pc-forecast-icon">
                                                                {desc.includes('비') || desc.includes('rain') ? '🌧️' : 
                                                                 desc.includes('구름') || desc.includes('흐림') || desc.includes('cloud') ? '☁️' : 
                                                                 desc.includes('눈') || desc.includes('snow') ? '❄️' : 
                                                                 desc === '-' ? '🌤️' : '☀️'}
                                                            </div>
                                                            <div className="pc-forecast-temp">
                                                                <span className="pc-temp-max">{maxT || '-'}°</span>
                                                                <span style={{color: '#94a3b8', fontWeight: 400}}>/</span>
                                                                <span className="pc-temp-min">{minT || '-'}°</span>
                                                            </div>
                                                            <div className="pc-forecast-desc">{desc}</div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 3. 주요 관광지 명소 */}
                            {secondaryResearch.landmarks && secondaryResearch.landmarks.length > 0 && (
                                <div className="pc-guide-block" style={{ gridColumn: 'span 2' }}>
                                    <h4 className="pc-block-title">
                                        <div className="pc-block-icon pc-icon-green">🗺️</div>
                                        주요 관광 명소 가이드
                                    </h4>
                                    <div className="pc-landmarks-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {secondaryResearch.landmarks.map((lm: any, idx: number) => (
                                            <div key={idx} className="pc-landmark-item" style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #f1f5f9', display: 'flex', gap: '12px', alignItems: 'flex-start', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                                                {lm.imageUrl && (
                                                    <img 
                                                        src={lm.imageUrl} 
                                                        alt={lm.name} 
                                                        style={{ width: '120px', height: '80px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} 
                                                    />
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <span className="pc-landmark-name" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: '4px' }}>📍 {lm.name} {lm.nameLocal && <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>({lm.nameLocal})</span>}</span>
                                                    <p className="pc-landmark-desc" style={{ fontSize: '0.7rem', color: '#475569', margin: 0, lineHeight: 1.4, wordBreak: 'keep-all' }}>{lm.description}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 4. 항공 수하물 기준 */}
                            {secondaryResearch.baggage && (
                                <div className="pc-guide-block">
                                    <h4 className="pc-block-title">
                                        <div className="pc-block-icon pc-icon-purple">🧳</div>
                                        항공 수하물 규격 기준
                                    </h4>
                                    <ul className="pc-guide-list">
                                        <li><strong>무료 위탁 수하물:</strong> {secondaryResearch.baggage.checkedWeight || '항공사 표준 규격'}</li>
                                        {secondaryResearch.baggage.checkedNote && <li style={{ color: '#64748b', fontSize: '0.7rem' }}>{secondaryResearch.baggage.checkedNote}</li>}
                                        <li><strong>기내 휴대 수하물:</strong> {secondaryResearch.baggage.carryonWeight || '항공사 표준 규격'}</li>
                                        {secondaryResearch.baggage.carryonNote && <li style={{ color: '#64748b', fontSize: '0.7rem' }}>{secondaryResearch.baggage.carryonNote}</li>}
                                    </ul>
                                </div>
                            )}

                            {/* 5. 환전 및 통화 팁 */}
                            {secondaryResearch.currency && (
                                <div className="pc-guide-block">
                                    <h4 className="pc-block-title">
                                        <div className="pc-block-icon pc-icon-red">💰</div>
                                        현지 통화 및 환전/팁 정보
                                    </h4>
                                    <p className="pc-guide-text" style={{ marginBottom: '12px' }}>
                                        <strong>현지 통화 단위:</strong> {secondaryResearch.currency.localCurrency || '현지통화'}{secondaryResearch.currency.currencySymbol ? ` (${secondaryResearch.currency.currencySymbol})` : ''}
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {secondaryResearch.currency.calculationTip && (
                                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '10px 12px' }}>
                                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0369a1', marginBottom: '4px' }}>🔢 간편 계산법</div>
                                                <div style={{ fontSize: '0.7rem', color: '#075985', lineHeight: 1.45 }}>{secondaryResearch.currency.calculationTip}</div>
                                            </div>
                                        )}
                                        {secondaryResearch.currency.exchangeTip && (
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>💵 환전 팁</div>
                                                <div style={{ fontSize: '0.7rem', color: '#475569', lineHeight: 1.45, whiteSpace: 'pre-line' }}>{secondaryResearch.currency.exchangeTip}</div>
                                            </div>
                                        )}
                                        {secondaryResearch.currency.tipCulture && (
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>🛎️ 현지 팁 문화</div>
                                                <div style={{ fontSize: '0.7rem', color: '#475569', lineHeight: 1.45, whiteSpace: 'pre-line' }}>{secondaryResearch.currency.tipCulture}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 6. 로밍 및 인터넷 */}
                            {secondaryResearch.roaming && (
                                <div className="pc-guide-block">
                                    <h4 className="pc-block-title">
                                        <div className="pc-block-icon pc-icon-blue">📞</div>
                                        로밍 및 인터넷 이용 가이드
                                    </h4>
                                    <p className="pc-guide-text" style={{ marginBottom: '12px' }}>
                                        {secondaryResearch.roaming.description || '주요 관광지와 호텔 내에서 데이터 통신 사용이 원활합니다.'}
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {secondaryResearch.roaming.simEsim && (
                                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '10px 12px' }}>
                                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>💡 추천 이용 방법 (유심/eSIM)</div>
                                                <div style={{ fontSize: '0.7rem', color: '#166534', lineHeight: 1.45 }}>{secondaryResearch.roaming.simEsim}</div>
                                            </div>
                                        )}
                                        {secondaryResearch.roaming.carriers && (
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>📶 현지 통신사 파트너</div>
                                                <div style={{ fontSize: '0.7rem', color: '#475569', lineHeight: 1.45 }}>{secondaryResearch.roaming.carriers}</div>
                                            </div>
                                        )}
                                        {secondaryResearch.roaming.roamingTip && (
                                            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', padding: '10px 12px' }}>
                                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>✨ 로밍 이용 꿀팁</div>
                                                <div style={{ fontSize: '0.7rem', color: '#92400e', lineHeight: 1.45, whiteSpace: 'pre-line' }}>{secondaryResearch.roaming.roamingTip}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ─── 10. 푸터 ─── */}
                <div className="pc-footer">
                    <div className="pc-footer-left">
                        <p className="pc-footer-brand">CLUBMODE TRAVEL (클럽모드 투어)</p>
                        <p className="pc-footer-info">고객센터: 1544-XXXX / 담당: 모두투어 대리점</p>
                        <p className="pc-footer-disclaimer">※ 본 확정서는 항공 좌석 및 호텔 예약 상태에 따라 최종 변동될 수 있습니다.</p>
                    </div>
                    <div className="pc-footer-right">
                        <p className="pc-footer-logo">CLUBMODE</p>
                        <p className="pc-footer-tagline">즐거운 여행이 되도록 클럽모드가 함께하겠습니다. 🌟</p>
                    </div>
                </div>

            </div>
        </div>
    );
}

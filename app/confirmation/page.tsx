'use client';

import { useState, useEffect, useRef } from 'react';
import type { ConsultationData, DetailedProductInfo, TravelerInfo, DocumentFile, SecondaryResearch, MeetingInfo } from '@/types';

// AI 응답에서 객체/배열이 올 수 있으므로 안전하게 문자열로 변환
function safeStr(val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) {
        return val.map((item: any) => {
            if (typeof item === 'string') return item;
            if (typeof item === 'object' && item !== null) {
                // {name, description, reason} 같은 구조 → 한 줄로 요약
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

export default function ConfirmationPage() {
    // 고객 검색
    const [customerQuery, setCustomerQuery] = useState('');
    const [customerResults, setCustomerResults] = useState<ConsultationData[]>([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // 상품 URL 분석
    const [productUrl, setProductUrl] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<DetailedProductInfo | null>(null);
    const [analysisError, setAnalysisError] = useState('');
    const [analysisStep, setAnalysisStep] = useState('');

    // 폼 데이터
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [productName, setProductName] = useState('');
    const [destination, setDestination] = useState('');
    const [departureDate, setDepartureDate] = useState('');
    const [returnDate, setReturnDate] = useState('');
    const [duration, setDuration] = useState('');
    const [adultCount, setAdultCount] = useState(1);
    const [childCount, setChildCount] = useState(0);
    const [infantCount, setInfantCount] = useState(0);
    const [travelers, setTravelers] = useState<TravelerInfo[]>([{ name: '', type: 'adult' }]);

    // 항공
    const [airline, setAirline] = useState('');
    const [departureAirport, setDepartureAirport] = useState('');
    const [departureTime, setDepartureTime] = useState('');
    const [arrivalTime, setArrivalTime] = useState('');
    const [returnDepartureTime, setReturnDepartureTime] = useState('');
    const [returnArrivalTime, setReturnArrivalTime] = useState('');

    // 숙박
    const [hotelName, setHotelName] = useState('');
    const [hotelAddress, setHotelAddress] = useState('');
    const [checkIn, setCheckIn] = useState('');
    const [checkOut, setCheckOut] = useState('');
    const [hotelImages, setHotelImages] = useState('');
    const [hotelAmenities, setHotelAmenities] = useState('');

    // 안내
    const [inclusions, setInclusions] = useState('');
    const [exclusions, setExclusions] = useState('');
    const [notices, setNotices] = useState('');
    const [checklist, setChecklist] = useState('여권 (유효기간 6개월 이상)\n환전 (현지 화폐)\n여행자 보험');
    const [cancellationPolicy, setCancellationPolicy] = useState('');
    const [itinerary, setItinerary] = useState<any[]>([]); // 일정표 상태 추가
    const [meetingInfo, setMeetingInfo] = useState<MeetingInfo[]>([]); // 미팅 및 수속 정보

    // 파일 업로드
    const [files, setFiles] = useState<DocumentFile[]>([]);

    // 2차 조사
    const [secondaryResearch, setSecondaryResearch] = useState<SecondaryResearch | null>(null);
    const [researchLoading, setResearchLoading] = useState(false);
    const [researchError, setResearchError] = useState('');
    const [customGuideInputs, setCustomGuideInputs] = useState<string[]>([]);

    // 생성 결과
    const [generating, setGenerating] = useState(false);
    const [generatedId, setGeneratedId] = useState('');
    const [showShareModal, setShowShareModal] = useState(false);

    // 고객 검색 외부 클릭 감지
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowCustomerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // 고객 검색
    const searchCustomers = async (query: string) => {
        setCustomerQuery(query);
        if (query.length < 1) {
            setCustomerResults([]);
            setShowCustomerDropdown(false);
            return;
        }
        try {
            const res = await fetch(`/api/confirmation?action=search-customers&q=${encodeURIComponent(query)}`);
            const json = await res.json();
            if (json.success) {
                setCustomerResults(json.data);
                setShowCustomerDropdown(json.data.length > 0);
            }
        } catch (err) {
            console.error('Customer search error:', err);
        }
    };

    // 고객 선택
    const selectCustomer = (c: ConsultationData) => {
        setCustomerName(c.customer.name);
        setCustomerPhone(c.customer.phone);
        if (c.trip.destination) setDestination(c.trip.destination);
        if (c.trip.product_name) setProductName(c.trip.product_name);
        if (c.trip.departure_date) setDepartureDate(c.trip.departure_date);
        if (c.trip.return_date) setReturnDate(c.trip.return_date);
        if (c.trip.duration) setDuration(c.trip.duration);
        if (c.trip.url) setProductUrl(c.trip.url);
        setShowCustomerDropdown(false);
        setCustomerQuery('');
    };

    // URL 분석 — 수집+분석을 한 번에 처리하는 통합 Edge API 사용
    const analyzeUrl = async () => {
        if (!productUrl) return;
        setAnalyzing(true);
        setAnalysisError('');
        setAnalysisStep('분석 중... (약 15-20초)');
        setAnalysisResult(null);

        try {
            const res = await fetch('/api/crawl-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: productUrl }),
            });

            const textResponse = await res.text();
            let json;
            try {
                json = JSON.parse(textResponse);
            } catch (e) {
                console.error("Non-JSON response (Confirmation):", textResponse.substring(0, 200));
                if (textResponse.includes("An error occurred") || textResponse.includes("504") || textResponse.includes("<html")) {
                    throw new Error("서버 응답 시간(30초)을 초과했습니다. 화면에 보이지 않는 방대한 데이터를 처리 중입니다. 다시 시도해주세요.");
                }
                throw new Error("서버 오류가 발생했습니다. (JSON 파싱 실패)");
            }

            if (json.success && json.data) {
                const raw = json.data;
                setAnalysisResult(raw);
                setAnalysisStep('');

                // ---- 기본 정보 ----
                if (raw.title) setProductName(raw.title);
                if (raw.destination) setDestination(raw.destination);
                if (raw.departureDate) setDepartureDate(raw.departureDate);
                if (raw.returnDate) setReturnDate(raw.returnDate);
                if (raw.duration) setDuration(raw.duration);

                // ---- 항공 상세 ----
                if (raw.airline) setAirline(raw.airline);
                if (raw.departureAirport) setDepartureAirport(raw.departureAirport);
                if (raw.departureTime) setDepartureTime(raw.departureTime);
                if (raw.arrivalTime) setArrivalTime(raw.arrivalTime);
                if (raw.returnDepartureTime) setReturnDepartureTime(raw.returnDepartureTime);
                if (raw.returnArrivalTime) setReturnArrivalTime(raw.returnArrivalTime);

                if (raw.hotel?.name) {
                    const enName = raw.hotel.englishName ? ` (${raw.hotel.englishName})` : '';
                    setHotelName(raw.hotel.name + enName);
                }
                if (raw.hotel?.address) setHotelAddress(raw.hotel.address);
                if (raw.hotel?.images?.length) setHotelImages(raw.hotel.images.join('\n'));
                if (raw.hotel?.amenities?.length) setHotelAmenities(raw.hotel.amenities.join('\n'));

                if (typeof raw.hotel === 'string' && raw.hotel) setHotelName(raw.hotel);
                if (raw.hotelAddress && !raw.hotel?.address) setHotelAddress(raw.hotelAddress);

                if (raw.departureDate) setCheckIn(raw.departureDate);
                if (raw.returnDate) setCheckOut(raw.returnDate);

                if (raw.inclusions?.length) setInclusions(raw.inclusions.join('\n'));
                if (raw.exclusions?.length) setExclusions(raw.exclusions.join('\n'));
                if (raw.cancellationPolicy) setCancellationPolicy(raw.cancellationPolicy);
                if (raw.checklist?.length) setChecklist(raw.checklist.join('\n'));
                if (raw.itinerary?.length) setItinerary(raw.itinerary);
                if (raw.meetingInfo?.length) setMeetingInfo(raw.meetingInfo);

                const noticesParts: string[] = [];
                if (raw.keyPoints?.length) {
                    noticesParts.push('핵심 포인트:\n' + raw.keyPoints.map((k: string) => `• ${k}`).join('\n'));
                }
                if (raw.specialOffers?.length) {
                    noticesParts.push('특전/혜택:\n' + raw.specialOffers.map((s: string) => `• ${s}`).join('\n'));
                }
                if (raw.features?.length) {
                    noticesParts.push('상품 특징:\n' + raw.features.map((f: string) => `• ${f}`).join('\n'));
                }
                if (raw.notices?.length) {
                    if (Array.isArray(raw.notices)) {
                        noticesParts.push('⚠️ 유의사항:\n' + raw.notices.map((n: string) => `• ${n}`).join('\n'));
                    } else {
                        noticesParts.push('⚠️ 유의사항:\n' + raw.notices);
                    }
                }
                if (noticesParts.length > 0) {
                    setNotices(noticesParts.join('\n\n'));
                }
            } else {
                setAnalysisError(json.error || '분석에 실패했습니다.');
            }
        } catch (err: any) {
            setAnalysisError(err.message);
        } finally {
            setAnalyzing(false);
            setAnalysisStep('');
        }
    };

    // 여행자 추가/삭제/수정
    const addTraveler = () => setTravelers(prev => [...prev, { name: '', type: 'adult' }]);
    const removeTraveler = (i: number) => setTravelers(prev => prev.filter((_, idx) => idx !== i));
    const updateTraveler = (i: number, field: keyof TravelerInfo, value: string) => {
        setTravelers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
    };

    // 미팅/수속 정보 관리
    const addMeetingInfo = () => setMeetingInfo(prev => [...prev, { type: '미팅장소', location: '', time: '', description: '', imageUrl: '' }]);
    const removeMeetingInfo = (i: number) => setMeetingInfo(prev => prev.filter((_, idx) => idx !== i));
    const updateMeetingInfo = (i: number, field: keyof MeetingInfo, value: string) => {
        setMeetingInfo(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
    };

    // 파일 핸들러 (로컬 blob URL 사용 — 프로토타입용)
    const handleFileUpload = (type: DocumentFile['type'], label: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const blobUrl = URL.createObjectURL(file);
        const newFile: DocumentFile = {
            id: `file-${Date.now()}`,
            name: file.name,
            type,
            label,
            url: blobUrl,
            uploadedAt: new Date().toISOString(),
        };
        setFiles(prev => {
            const filtered = prev.filter(f => f.type !== type);
            return [...filtered, newFile];
        });
    };

    const getFileByType = (type: DocumentFile['type']) => files.find(f => f.type === type);

    // 2차 조사 실행
    const runSecondaryResearch = async () => {
        if (!destination) {
            alert('목적지를 먼저 입력해 주세요.');
            return;
        }
        setResearchLoading(true);
        setResearchError('');
        try {
            const res = await fetch('/api/confirmation/secondary-research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destination,
                    airline,
                    airport: departureAirport,
                    customGuides: customGuideInputs.filter(g => g.trim()),
                }),
            });
            const json = await res.json();
            if (json.success) {
                setSecondaryResearch(json.data);
            } else {
                setResearchError(json.error || '2차 조사에 실패했습니다.');
            }
        } catch (err: any) {
            setResearchError(err.message);
        } finally {
            setResearchLoading(false);
        }
    };

    // 커스텀 가이드 관리
    const addCustomGuide = () => setCustomGuideInputs(prev => [...prev, '']);
    const removeCustomGuide = (i: number) => setCustomGuideInputs(prev => prev.filter((_, idx) => idx !== i));
    const updateCustomGuide = (i: number, val: string) => setCustomGuideInputs(prev => prev.map((g, idx) => idx === i ? val : g));

    // 2차 조사(AI) 데이터 수정 핸들러
    const updateSRField = (section: string, field: string, value: string) => {
        setSecondaryResearch((prev: any) => {
            if (!prev) return prev;
            return { ...prev, [section]: { ...prev[section], [field]: value } };
        });
    };
    const updateSRLandmark = (index: number, field: string, value: string) => {
        setSecondaryResearch((prev: any) => {
            if (!prev || !prev.landmarks) return prev;
            const newLandmarks = [...prev.landmarks];
            newLandmarks[index] = { ...newLandmarks[index], [field]: value };
            return { ...prev, landmarks: newLandmarks };
        });
    };
    const updateSRBaggageArray = (index: number, value: string) => {
        setSecondaryResearch((prev: any) => {
            if (!prev || !prev.baggage || !prev.baggage.additionalNotes) return prev;
            const newArr = [...prev.baggage.additionalNotes];
            newArr[index] = value;
            return { ...prev, baggage: { ...prev.baggage, additionalNotes: newArr } };
        });
    };

    // 확정서 생성
    const generateConfirmation = async () => {
        if (!customerName) {
            alert('고객 성함을 입력해 주세요.');
            return;
        }
        setGenerating(true);
        try {
            const body = {
                status: '예약확정',
                customer: { name: customerName, phone: customerPhone },
                trip: {
                    productName, productUrl, destination,
                    departureDate, returnDate, duration,
                    travelers, adultCount, childCount, infantCount,
                },
                flight: {
                    airline, departureAirport,
                    departureTime, arrivalTime,
                    returnDepartureTime, returnArrivalTime,
                },
                hotel: {
                    name: hotelName, address: hotelAddress,
                    checkIn, checkOut,
                    images: hotelImages.split('\n').map(s => s.trim()).filter(Boolean),
                    amenities: hotelAmenities.split('\n').map(s => s.trim()).filter(Boolean),
                },
                itinerary: itinerary, // 상태 값 사용
                meetingInfo,
                inclusions: inclusions.split('\n').map(s => s.trim()).filter(Boolean),
                exclusions: exclusions.split('\n').map(s => s.trim()).filter(Boolean),
                notices,
                checklist,
                cancellationPolicy,
                files,
                productData: analysisResult,
                secondaryResearch: secondaryResearch || undefined,
            };

            const res = await fetch('/api/confirmation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (json.success) {
                setGeneratedId(json.data.id);
                setShowShareModal(true);
            } else {
                alert('생성 실패: ' + json.error);
            }
        } catch (err: any) {
            alert('오류: ' + err.message);
        } finally {
            setGenerating(false);
        }
    };

    const shareUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/confirmation/${generatedId}`
        : '';

    const copyShareLink = () => {
        navigator.clipboard.writeText(shareUrl);
        alert('링크가 복사되었습니다!');
    };

    return (
        <div className="confirm-admin">
            <h1>📄 모바일 확정서 제작</h1>
            <p className="page-subtitle">고객에게 전달할 모바일 여행 확정서를 생성합니다.</p>

            {/* ① 고객 검색 */}
            <div className="confirm-section">
                <div className="confirm-section-title">
                    <span className="section-icon">👤</span> 고객 정보
                </div>
                <div className="confirm-grid">
                    <div className="confirm-field full-width" ref={searchRef}>
                        <label>고객 검색 (구글 시트에서 찾기)</label>
                        <div className="customer-search-wrapper">
                            <input
                                type="text"
                                placeholder="이름 또는 연락처로 검색..."
                                value={customerQuery}
                                onChange={e => searchCustomers(e.target.value)}
                            />
                            {showCustomerDropdown && (
                                <div className="customer-search-results">
                                    {customerResults.map((c, i) => (
                                        <div key={i} className="customer-search-item" onClick={() => selectCustomer(c)}>
                                            <div>
                                                <div className="csi-name">{c.customer.name}</div>
                                                <div className="csi-dest">{c.trip.destination} · {c.trip.departure_date}</div>
                                            </div>
                                            <div className="csi-phone">{c.customer.phone}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="confirm-field">
                        <label>고객 성함</label>
                        <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="홍길동" />
                    </div>
                    <div className="confirm-field">
                        <label>연락처</label>
                        <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="010-1234-5678" />
                    </div>
                </div>
            </div>

            {/* ② 상품 URL 분석 */}
            <div className="confirm-section">
                <div className="confirm-section-title">
                    <span className="section-icon">🔍</span> 상품 분석
                </div>
                <div className="analyze-url-row">
                    <div className="confirm-field">
                        <label>상품 URL</label>
                        <input value={productUrl} onChange={e => setProductUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <button className="btn-analyze" onClick={analyzeUrl} disabled={analyzing || !productUrl}>
                        {analyzing ? '분석 중...' : '🔍 분석'}
                    </button>
                </div>
                {analyzing && (
                    <div className="analysis-status">
                        <div className="spinner-small"></div> {analysisStep || 'URL을 분석하고 있습니다...'}
                    </div>
                )}
                {analysisError && (
                    <div className="analysis-status error" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <div>⚠️ {analysisError}</div>
                        <a
                            href="/api/debug/diagnostic"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.8rem', color: '#ef4444', textDecoration: 'underline' }}
                        >
                            환경 진단 도구 실행하기
                        </a>
                    </div>
                )}
                {analysisResult && (
                    <div className="analysis-status">✅ 분석 완료! 아래 폼에 자동으로 입력되었습니다.</div>
                )}
            </div>

            {/* ③ 예약 정보 */}
            <div className="confirm-section">
                <div className="confirm-section-title">
                    <span className="section-icon">✈️</span> 예약 정보
                </div>
                <div className="confirm-grid">
                    <div className="confirm-field full-width">
                        <label>여행 상품명</label>
                        <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="상품명 입력" />
                    </div>
                    <div className="confirm-field">
                        <label>목적지</label>
                        <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="베트남 다낭" />
                    </div>
                    <div className="confirm-field">
                        <label>여행 기간</label>
                        <input value={duration} onChange={e => setDuration(e.target.value)} placeholder="3박 5일" />
                    </div>
                    <div className="confirm-field">
                        <label>출발일</label>
                        <input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} />
                    </div>
                    <div className="confirm-field">
                        <label>귀국일</label>
                        <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} />
                    </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>인원</label>
                    <div className="count-row" style={{ marginTop: '8px' }}>
                        <div className="count-item">
                            <label>성인</label>
                            <input type="number" min={0} value={adultCount} onChange={e => setAdultCount(Number(e.target.value))} />
                        </div>
                        <div className="count-item">
                            <label>소아</label>
                            <input type="number" min={0} value={childCount} onChange={e => setChildCount(Number(e.target.value))} />
                        </div>
                        <div className="count-item">
                            <label>유아</label>
                            <input type="number" min={0} value={infantCount} onChange={e => setInfantCount(Number(e.target.value))} />
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '8px', display: 'block' }}>여행자 명단</label>
                    <div className="travelers-list">
                        {travelers.map((t, i) => (
                            <div key={i} className="traveler-row">
                                <input
                                    value={t.name}
                                    onChange={e => updateTraveler(i, 'name', e.target.value)}
                                    placeholder={`여행자 ${i + 1} 성함`}
                                />
                                <select value={t.type} onChange={e => updateTraveler(i, 'type', e.target.value)}>
                                    <option value="adult">성인</option>
                                    <option value="child">소아</option>
                                    <option value="infant">유아</option>
                                </select>
                                {travelers.length > 1 && (
                                    <button onClick={() => removeTraveler(i)}>✕</button>
                                )}
                            </div>
                        ))}
                        <button className="btn-add-traveler" onClick={addTraveler}>+ 여행자 추가</button>
                    </div>
                </div>
            </div>

            {/* ④ 항공/숙박 */}
            <div className="confirm-section">
                <div className="confirm-section-title">
                    <span className="section-icon">🏨</span> 항공 · 숙박
                </div>
                <div className="confirm-grid">
                    <div className="confirm-field">
                        <label>항공사</label>
                        <input value={airline} onChange={e => setAirline(e.target.value)} placeholder="대한항공" />
                    </div>
                    <div className="confirm-field">
                        <label>출발 공항</label>
                        <input value={departureAirport} onChange={e => setDepartureAirport(e.target.value)} placeholder="인천" />
                    </div>
                    <div className="confirm-field">
                        <label>가는편 출발</label>
                        <input value={departureTime} onChange={e => setDepartureTime(e.target.value)} placeholder="09:00" />
                    </div>
                    <div className="confirm-field">
                        <label>가는편 도착</label>
                        <input value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} placeholder="12:30" />
                    </div>
                    <div className="confirm-field">
                        <label>오는편 출발</label>
                        <input value={returnDepartureTime} onChange={e => setReturnDepartureTime(e.target.value)} placeholder="14:00" />
                    </div>
                    <div className="confirm-field">
                        <label>오는편 도착</label>
                        <input value={returnArrivalTime} onChange={e => setReturnArrivalTime(e.target.value)} placeholder="21:00" />
                    </div>
                </div>
                <div className="confirm-grid" style={{ marginTop: '16px' }}>
                    <div className="confirm-field">
                        <label>호텔명</label>
                        <input value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="호텔명" />
                    </div>
                    <div className="confirm-field">
                        <label>호텔 주소</label>
                        <input value={hotelAddress} onChange={e => setHotelAddress(e.target.value)} placeholder="주소" />
                    </div>
                    <div className="confirm-field">
                        <label>체크인</label>
                        <input type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
                    </div>
                    <div className="confirm-field">
                        <label>체크아웃</label>
                        <input type="date" value={checkOut} onChange={e => setCheckOut(e.target.value)} />
                    </div>
                </div>
                <div className="confirm-grid" style={{ marginTop: '16px' }}>
                    <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                        <label>호텔 이미지 URL (엔터로 구분)</label>
                        <textarea
                            value={hotelImages}
                            onChange={e => setHotelImages(e.target.value)}
                            rows={3}
                            placeholder="https://...&#10;https://..."
                        />
                    </div>
                    <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                        <label>시설 및 서비스 (엔터로 구분)</label>
                        <textarea
                            value={hotelAmenities}
                            onChange={e => setHotelAmenities(e.target.value)}
                            rows={3}
                            placeholder="수영장&#10;와이파이&#10;조식 제공"
                        />
                    </div>
                </div>
            </div>

            {/* 미팅 및 수속 정보 */}
            <div className="confirm-section">
                <div className="confirm-section-title">
                    <span className="section-icon">🤝</span> 미팅 및 수속 정보
                </div>
                {meetingInfo.map((m, i) => (
                    <div key={i} className="confirm-grid" style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div className="confirm-field">
                            <label>타입</label>
                            <select value={m.type} onChange={e => updateMeetingInfo(i, 'type', e.target.value as '미팅장소' | '수속카운터')} className="admin-select" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem', outline: 'none', background: 'var(--bg-primary)', color: 'inherit' }}>
                                <option value="미팅장소">미팅장소</option>
                                <option value="수속카운터">수속카운터</option>
                            </select>
                        </div>
                        <div className="confirm-field">
                            <label>시간</label>
                            <input value={m.time} onChange={e => updateMeetingInfo(i, 'time', e.target.value)} placeholder="08:00" />
                        </div>
                        <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                            <label>장소/카운터명</label>
                            <input value={m.location} onChange={e => updateMeetingInfo(i, 'location', e.target.value)} placeholder="인천공항 제1여객터미널 3층 A카운터" />
                        </div>
                        <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                            <label>상세 설명</label>
                            <textarea value={m.description} onChange={e => updateMeetingInfo(i, 'description', e.target.value)} rows={2} placeholder="여권을 지참하고 담당자(김호기: 010-1234-5678)를 찾아주세요." />
                        </div>
                        <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                            <label>관련 이미지 URL (선택, 모바일 뷰어 렌더링용)</label>
                            <input value={m.imageUrl || ''} onChange={e => updateMeetingInfo(i, 'imageUrl', e.target.value)} placeholder="https://..." />
                        </div>
                        <button onClick={() => removeMeetingInfo(i)} style={{ gridColumn: '1 / -1', padding: '10px', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s' }}>삭제</button>
                    </div>
                ))}
                <button onClick={addMeetingInfo} style={{ width: '100%', padding: '14px', background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem', transition: 'all 0.2s' }}>+ 미팅 및 수속 정보 추가</button>
            </div>

            {/* ⑤ 서류 업로드 */}
            <div className="confirm-section">
                <div className="confirm-section-title">
                    <span className="section-icon">📎</span> 전자 서류 업로드
                </div>
                <div className="file-upload-grid">
                    {[
                        { type: 'boarding_pass' as const, label: '보딩패스 / e-티켓', icon: '🎫' },
                        { type: 'visa' as const, label: '비자(VISA) 확인서', icon: '📋' },
                        { type: 'insurance' as const, label: '여행자 보험 증서', icon: '🛡️' },
                        { type: 'other' as const, label: '기타 서류', icon: '📄' },
                    ].map(slot => {
                        const uploaded = getFileByType(slot.type);
                        return (
                            <div key={slot.type} className={`file-upload-slot ${uploaded ? 'uploaded' : ''}`}>
                                <div className="slot-icon">{slot.icon}</div>
                                <div className="slot-label">{slot.label}</div>
                                {uploaded && <div className="slot-filename">{uploaded.name}</div>}
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => handleFileUpload(slot.type, slot.label, e)}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ⑥ 안내사항 */}
            <div className="confirm-section">
                <div className="confirm-section-title">
                    <span className="section-icon">📢</span> 안내 · 주의사항
                </div>
                <div className="confirm-grid">
                    <div className="confirm-field">
                        <label>포함사항 (줄바꿈으로 구분)</label>
                        <textarea value={inclusions} onChange={e => setInclusions(e.target.value)} placeholder="왕복 항공권&#10;호텔 숙박&#10;전 일정 식사" />
                    </div>
                    <div className="confirm-field">
                        <label>불포함사항 (줄바꿈으로 구분)</label>
                        <textarea value={exclusions} onChange={e => setExclusions(e.target.value)} placeholder="여행자 보험&#10;현지 팁&#10;개인 경비" />
                    </div>
                    <div className="confirm-field">
                        <label>준비물 체크리스트 (줄바꿈으로 구분)</label>
                        <textarea value={checklist} onChange={e => setChecklist(e.target.value)} />
                    </div>
                    <div className="confirm-field">
                        <label>취소/환불 규정</label>
                        <textarea value={cancellationPolicy} onChange={e => setCancellationPolicy(e.target.value)} placeholder="출발 30일 전: 전액 환불&#10;출발 7일 전: 50% 환불" />
                    </div>
                    <div className="confirm-field full-width">
                        <label>추가 안내사항</label>
                        <textarea value={notices} onChange={e => setNotices(e.target.value)} placeholder="기타 참고사항을 입력하세요..." />
                    </div>
                </div>
            </div>

            {/* ⑦ 상세 일정 미리보기/수정 */}
            <div className="confirm-section">
                <div className="confirm-section-title">
                    <span className="section-icon">🗓️</span> 상세 일정 미리보기
                </div>
                <div className="itinerary-preview-header">
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        URL 분석 결과 추출된 {itinerary.length}일간의 일정입니다.
                        {!itinerary.length && " URL 분석을 먼저 진행해 주세요."}
                    </p>
                </div>

                <div className="itinerary-preview-list" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {itinerary.map((day, idx) => (
                        <div key={idx} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#6366f1' }}>{day.day || `${idx + 1}일차`}</span>
                                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{day.date}</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>{day.title}</div>
                            <div style={{ fontSize: '0.82rem', color: '#475569', whiteSpace: 'pre-wrap' }}>
                                {Array.isArray(day.activities) ? day.activities.join(' · ') : day.activities}
                            </div>
                            {(day.meals || day.hotel) && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '10px' }}>
                                    {day.meals && <span>🍴 {day.meals.breakfast || '-'}/{day.meals.lunch || '-'}/{day.meals.dinner || '-'}</span>}
                                    {day.hotel && <span>🏨 {day.hotel}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                    {itinerary.length > 0 && (
                        <button
                            className="btn-secondary"
                            style={{ padding: '8px', fontSize: '0.8rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
                            onClick={() => {
                                const ok = confirm('현재 일정을 직접 편집(JSON)하시겠습니까?');
                                if (ok) {
                                    const raw = prompt('일정 데이터를 JSON 형식으로 수정하세요:', JSON.stringify(itinerary));
                                    if (raw) {
                                        try { setItinerary(JSON.parse(raw)); } catch (e) { alert('잘못된 JSON 형식입니다.'); }
                                    }
                                }
                            }}
                        >
                            ✏️ 일정 데이터 직접 수정(JSON)
                        </button>
                    )}
                </div>
            </div>

            {/* ⑧ 2차 조사 시스템 */}
            <div className="confirm-section">
                <div className="confirm-section-title">
                    <span className="section-icon">🔬</span> 2차 조사 (여행 준비 가이드)
                </div>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 12px' }}>
                    분석된 여행지·항공사 정보를 바탕으로 AI가 환전, 로밍, 세관, 관광지 등의 가이드를 자동 생성합니다.
                </p>

                {/* 커스텀 가이드 입력 */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '6px' }}>📝 추가 가이드 요청 (선택)</label>
                    {customGuideInputs.map((g, i) => (
                        <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'stretch' }}>
                            <input
                                value={g}
                                onChange={e => updateCustomGuide(i, e.target.value)}
                                placeholder="예: 빈펄 나트랑 얼굴 인식 등록법"
                                style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', outline: 'none' }}
                            />
                            <button onClick={() => removeCustomGuide(i)} style={{ padding: '0 14px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                        </div>
                    ))}
                    <button onClick={addCustomGuide} style={{ padding: '8px 16px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#475569', marginTop: '2px' }}>+ 가이드 주제 추가</button>
                </div>

                <button
                    className="btn-analyze"
                    onClick={runSecondaryResearch}
                    disabled={researchLoading || !destination}
                    style={{
                        width: '100%',
                        padding: '16px',
                        fontSize: '1rem',
                        fontWeight: 700,
                        marginBottom: '16px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1
                    }}
                >
                    {researchLoading ? 'AI 조사 중... (약 10~15초)' : '2차 조사 시작'}
                </button>

                {researchError && <div className="analysis-status error" style={{ marginBottom: '12px' }}>⚠️ {researchError}</div>}
                {secondaryResearch && <div className="analysis-status" style={{ marginBottom: '12px' }}>✅ 2차 조사 완료!</div>}

                {/* 항상 보이는 필드 카드들 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* 환전 */}
                    {secondaryResearch && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontSize: '1rem' }}>💱 환전 및 결제 {secondaryResearch.currency?.localCurrency ? `(${safeStr(secondaryResearch.currency.localCurrency)})` : ''}</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>간편 계산법</label>
                                    <textarea rows={2} value={secondaryResearch.currency?.calculationTip || ''} onChange={e => updateSRField('currency', 'calculationTip', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>환전 팁</label>
                                    <textarea rows={2} value={secondaryResearch.currency?.exchangeTip || ''} onChange={e => updateSRField('currency', 'exchangeTip', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>팁 문화</label>
                                    <textarea rows={2} value={secondaryResearch.currency?.tipCulture || ''} onChange={e => updateSRField('currency', 'tipCulture', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 로밍 */}
                    {secondaryResearch && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontSize: '1rem' }}>📱 로밍·통신</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>통신사 안내문</label>
                                    <textarea rows={2} value={secondaryResearch.roaming?.carriers || ''} onChange={e => updateSRField('roaming', 'carriers', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>유심/eSIM 추천</label>
                                    <textarea rows={2} value={secondaryResearch.roaming?.simEsim || ''} onChange={e => updateSRField('roaming', 'simEsim', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 세관 */}
                    {secondaryResearch && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontSize: '1rem' }}>🛃 입국·세관</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>주요 경고 제목</label>
                                    <input value={secondaryResearch.customs?.warningTitle || ''} onChange={e => updateSRField('customs', 'warningTitle', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>미성년자 안내</label>
                                    <textarea rows={2} value={secondaryResearch.customs?.minorEntry || ''} onChange={e => updateSRField('customs', 'minorEntry', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>면세 한도</label>
                                    <textarea rows={2} value={secondaryResearch.customs?.dutyFree || ''} onChange={e => updateSRField('customs', 'dutyFree', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>여권 유의사항</label>
                                    <textarea rows={2} value={secondaryResearch.customs?.passportNote || ''} onChange={e => updateSRField('customs', 'passportNote', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 관광지 */}
                    {secondaryResearch && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontSize: '1rem' }}>🏛️ 관광지 ({secondaryResearch.landmarks?.length || 0}개)</div>
                            {secondaryResearch.landmarks?.length ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {secondaryResearch.landmarks.map((lm: any, i: number) => (
                                        <div key={i} style={{ padding: '16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                                <div className="confirm-field" style={{ marginBottom: 0 }}>
                                                    <label style={{ color: 'var(--text-secondary)' }}>관광지명</label>
                                                    <input value={lm.name || ''} onChange={e => updateSRLandmark(i, 'name', e.target.value)} />
                                                </div>
                                                <div className="confirm-field" style={{ marginBottom: 0 }}>
                                                    <label style={{ color: 'var(--text-secondary)' }}>현지어/영어명</label>
                                                    <input value={lm.nameLocal || ''} onChange={e => updateSRLandmark(i, 'nameLocal', e.target.value)} />
                                                </div>
                                            </div>
                                            <div className="confirm-field" style={{ marginBottom: '8px' }}>
                                                <label style={{ color: 'var(--text-secondary)' }}>1~2줄 핵심 소개</label>
                                                <textarea rows={2} value={lm.description || ''} onChange={e => updateSRLandmark(i, 'description', e.target.value)} />
                                            </div>
                                            <div className="confirm-field">
                                                <label style={{ color: 'var(--text-secondary)' }}>관광지 사진 URL</label>
                                                <input value={lm.imageUrl || ''} placeholder="https://..." onChange={e => updateSRLandmark(i, 'imageUrl', e.target.value)} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>조사 후 자동 입력</span>
                            )}
                        </div>
                    )}

                    {/* 수하물 */}
                    {secondaryResearch && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontSize: '1rem' }}>🧳 수하물 규정</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 2fr', gap: '8px' }}>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>위탁수하물 무게</label>
                                        <input value={secondaryResearch.baggage?.checkedWeight || ''} onChange={e => updateSRField('baggage', 'checkedWeight', e.target.value)} />
                                    </div>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>위탁 추가 노트</label>
                                        <input value={secondaryResearch.baggage?.checkedNote || ''} onChange={e => updateSRField('baggage', 'checkedNote', e.target.value)} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 2fr', gap: '8px' }}>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>기내수하물 무게</label>
                                        <input value={secondaryResearch.baggage?.carryonWeight || ''} onChange={e => updateSRField('baggage', 'carryonWeight', e.target.value)} />
                                    </div>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>기내 추가 노트</label>
                                        <input value={secondaryResearch.baggage?.carryonNote || ''} onChange={e => updateSRField('baggage', 'carryonNote', e.target.value)} />
                                    </div>
                                </div>
                                {secondaryResearch.baggage?.additionalNotes?.map((n: string, i: number) => (
                                    <div key={i} className="confirm-field">
                                        <label style={{ color: 'var(--text-secondary)' }}>주의사항 {i + 1}</label>
                                        <input value={n} onChange={e => updateSRBaggageArray(i, e.target.value)} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 커스텀 가이드 */}
                    {secondaryResearch?.customGuides && secondaryResearch.customGuides.length > 0 && (
                        <>
                            {secondaryResearch.customGuides.map((guide, i) => (
                                <div key={i} style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                                    <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontSize: '1rem' }}>{safeStr(guide.icon)} {safeStr(guide.topic)} ({guide.sections?.length || 0}개 섹션)</div>
                                    {guide.sections?.map((sec, si) => (
                                        <div key={si} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                            • <strong>{safeStr(sec.title)}</strong> [{sec.type}]
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* 하단 버튼 */}
            <div className="confirm-actions">
                <button className="btn-generate" onClick={generateConfirmation} disabled={generating || !customerName}>
                    {generating ? '생성 중...' : '📄 확정서 생성'}
                </button>
            </div>

            {/* 공유 모달 */}
            {showShareModal && (
                <div className="share-modal-overlay" onClick={() => setShowShareModal(false)}>
                    <div className="share-modal" onClick={e => e.stopPropagation()}>
                        <h3>✅ 확정서가 생성되었습니다!</h3>
                        <p>아래 링크를 고객에게 전달하세요.</p>
                        <div className="share-link-box">
                            <input value={shareUrl} readOnly />
                            <button onClick={copyShareLink}>복사</button>
                        </div>
                        <button className="btn-close-modal" onClick={() => setShowShareModal(false)}>닫기</button>
                    </div>
                </div>
            )}
        </div>
    );
}

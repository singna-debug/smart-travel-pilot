'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import CustomerSearchBox from '@/components/CustomerSearchBox';
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

function formatToHtmlDate(dateStr: string): string {
    if (!dateStr) return '';
    
    // 이미 YYYY-MM-DD 형식이면 그대로 반환
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // 점(.)이나 다른 구분자를 사용하는 경우 처리 (예: 2026.04.18)
    const dotMatch = dateStr.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (dotMatch) {
        const y = dotMatch[1];
        const m = dotMatch[2].padStart(2, '0');
        const d = dotMatch[3].padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    const mdMatch = dateStr.match(/(\d+)\s*월\s*(\d+)\s*일/);
    if (mdMatch) {
        const now = new Date();
        const targetYear = now.getFullYear();
        const targetMonth = String(mdMatch[1]).padStart(2, '0');
        const targetDay = String(mdMatch[2]).padStart(2, '0');
        return `${targetYear}-${targetMonth}-${targetDay}`;
    }

    const cleanedDate = dateStr.replace(/[^0-9]/g, '');
    if (cleanedDate.length === 8) {
        const y = cleanedDate.substring(0, 4);
        const m = cleanedDate.substring(4, 6);
        const d = cleanedDate.substring(6, 8);
        return `${y}-${m}-${d}`;
    }

    // fallback: Date 객체로 시도
    try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
    } catch (e) {}

    return dateStr;
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
    const [visitorId, setVisitorId] = useState('');
    const [reservationNumber, setReservationNumber] = useState('');

    // 항공
    const [airline, setAirline] = useState('');
    const [departureFlightNumber, setDepartureFlightNumber] = useState('');
    const [returnFlightNumber, setReturnFlightNumber] = useState('');
    const [departureAirport, setDepartureAirport] = useState('');
    const [departureTime, setDepartureTime] = useState('');
    const [arrivalTime, setArrivalTime] = useState('');
    const [departureDuration, setDepartureDuration] = useState('');
    const [returnDepartureTime, setReturnDepartureTime] = useState('');
    const [returnArrivalTime, setReturnArrivalTime] = useState('');
    const [returnDuration, setReturnDuration] = useState('');

    // 숙박 (다중 지원)
    const [hotels, setHotels] = useState<any[]>([{
        name: '', address: '', checkIn: '', checkOut: '', images: [], amenities: []
    }]);

    // 안내
    const [inclusions, setInclusions] = useState('');
    const [exclusions, setExclusions] = useState('');
    const [notices, setNotices] = useState('');
    const [checklist, setChecklist] = useState('여권 (유효기간 6개월 이상)\n항공권\n\n바람막이 또는 가디건\n수영복, 아쿠아슈즈\n\n220V 사용가능\n보조배터리(반드시 기내 휴대)\n멀티 어댑터\n\n상비약(감기약, 소화제, 지사제, 밴드)\n자외선 차단제\n개인 세면도구\n중요한 약은 반드시 기내로\n(혈압, 당뇨약 등)');
    const [cancellationPolicy, setCancellationPolicy] = useState('');
    const [itinerary, setItinerary] = useState<any[]>([]); // 일정표 상태 추가
    const [meetingInfo, setMeetingInfo] = useState<MeetingInfo[]>([]); // 미팅 및 수속 정보

    // 파일 업로드
    const [files, setFiles] = useState<DocumentFile[]>([]);
    const [uploading, setUploading] = useState<string | null>(null); // 업로드 중인 파일 타입

    // 2차 조사
    const [secondaryResearch, setSecondaryResearch] = useState<SecondaryResearch | null>(null);
    const [researchLoading, setResearchLoading] = useState(false);
    const [researchError, setResearchError] = useState('');
    const [customGuideInputs, setCustomGuideInputs] = useState<string[]>([]);

    // 생성 결과
    const [generating, setGenerating] = useState(false);
    const [generatedId, setGeneratedId] = useState('');
    const [showShareModal, setShowShareModal] = useState(false);
    const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});

    const toggleDay = (dayIndex: number) => {
        setExpandedDays(prev => ({
            ...prev,
            [dayIndex]: !prev[dayIndex]
        }));
    };

    // 여행자 명단 변경 시 인원수 자동 계산
    useEffect(() => {
        let adults = 0;
        let children = 0;
        let infants = 0;
        travelers.forEach(t => {
            if (t.type === 'adult') adults++;
            else if (t.type === 'child') children++;
            else if (t.type === 'infant') infants++;
        });
        setAdultCount(adults);
        setChildCount(children);
        setInfantCount(infants);
    }, [travelers]);

    // 고객 검색 외부 클릭 감지 (이제 필요 없음 - CustomerSearchBox 내부에서 처리)

    // 고객 선택
    const selectCustomer = (c: ConsultationData) => {
        setCustomerName(c.customer.name);
        setCustomerPhone(c.customer.phone);
        const vId = c.visitorId || c.visitor_id || '';
        setVisitorId(vId);
        if (c.trip.destination) setDestination(c.trip.destination);
        if (c.trip.product_name) setProductName(c.trip.product_name);
        if (c.trip.departure_date) setDepartureDate(formatToHtmlDate(c.trip.departure_date));
        if (c.trip.return_date) setReturnDate(formatToHtmlDate(c.trip.return_date));
        if (c.trip.duration) setDuration(c.trip.duration);
        if (c.trip.url) setProductUrl(c.trip.url);
        if (c.trip.travelers_count) setAdultCount(Number(c.trip.travelers_count));
        // 예약번호 자동 로드 (있는 경우)
        if ((c as any).reservation_number) setReservationNumber((c as any).reservation_number);
        else if ((c as any).reservationNumber) setReservationNumber((c as any).reservationNumber);
        else setReservationNumber(''); // 초기화
    };

    // URL 분석 — 수집+분석을 한 번에 처리하는 통합 Edge API 사용
    const analyzeUrl = async () => {
        if (!productUrl) return;
        setAnalyzing(true);
        setAnalysisError('');
        setAnalysisStep('분석 중... (약 15-20초)');
        setAnalysisResult(null);

        try {
            const isLocal = process.env.NODE_ENV === 'development';
            const apiUrl = '/api/analyze-url';

            // [핵심] 초고속 28초 설계를 위한 병렬 트리거: NativeData나 URL에서 목적지가 추출되면 즉시 2차 조사 시작
            // (분석 API를 기다리지 않고 스크래퍼 실행 중 병렬로 보냄)
            const destHint = productUrl.includes('modetour.com') ? '분석 중...' : ''; 
            // 실제 구현에서는 analyze-url 내부의 Native API 결과를 먼저 받아올 수 없으므로, 
            // 2차 조사는 분석 결과가 나오자마자(t=15~20s) 실행되어도 이미 25~30s 타겟에 들어옴.
            // 하지만 더 빨라지기 위해 analyze-url에서 'destination'만 먼저 주는 partial response를 고려할 수 있음.
            // 여기서는 일단 AI 호출 최적화에 집중.

            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: productUrl, mode: 'confirmation' }),
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
                // 지원: 최근 업데이트된 { raw, formatted, recommendation } 구조 또는 기존 객체 구조
                const raw = json.data.raw ? json.data.raw : json.data;
                setAnalysisResult(raw);
                setAnalysisStep('');

                // [사용자 요청] 자동 2차 조사 비활성화
                /*
                if (raw.destination) {
                    console.log("[Auto-Research] Analysis complete. Triggering secondary research...");
                    runSecondaryResearchDirectly(raw.destination, raw.airline || '');
                }
                */

                // ---- 데이터 셋팅 로그 (디버깅) ----
                console.log("[DEBUG] Confirmation API Raw Data:", raw);

                // ---- 기본 정보 (보수적 파싱) ----
                if (raw.title) setProductName(raw.title);
                if (raw.destination) setDestination(raw.destination);
                if (raw.duration) setDuration(raw.duration);
                
                // 날짜 로직 (에러 발생 시 중단 방지)
                try {
                    if (raw.departureDate) setDepartureDate(formatToHtmlDate(raw.departureDate));
                    if (raw.returnDate) setReturnDate(formatToHtmlDate(raw.returnDate));
                } catch (e) {
                    console.error("Date formatting error:", e);
                    if (raw.departureDate) setDepartureDate(raw.departureDate); // 원본이라도 셋팅
                }

                // ---- 항공 상세 (강제 매핑) ----
                setAirline(raw.airline || '');
                setDepartureAirport(raw.departureAirport || '');
                setDepartureFlightNumber(raw.departureFlightNumber || raw.flightCode || '');
                setReturnFlightNumber(raw.returnFlightNumber || '');
                
                setDepartureTime(raw.departureTime || '');
                setArrivalTime(raw.arrivalTime || '');
                setReturnDepartureTime(raw.returnDepartureTime || '');
                setReturnArrivalTime(raw.returnArrivalTime || '');
                
                // ---- 호텔 상세 (유연한 객체 처리) ----
                const finalHotels: any[] = [];
                const sourceHotels = Array.isArray(raw.hotels) ? raw.hotels : (raw.hotel ? [raw.hotel] : []);
                
                sourceHotels.forEach((h: any) => {
                    const hotelObj = typeof h === 'string' ? { name: h } : h;
                    if (hotelObj && (hotelObj.name || hotelObj.hotelName)) {
                        finalHotels.push({
                            name: hotelObj.name || hotelObj.hotelName || '',
                            englishName: hotelObj.englishName || '',
                            address: hotelObj.address || '',
                            checkIn: hotelObj.checkIn || formatToHtmlDate(raw.departureDate || ''),
                            checkOut: hotelObj.checkOut || formatToHtmlDate(raw.returnDate || ''),
                            images: Array.isArray(hotelObj.images) ? hotelObj.images : [],
                            amenities: Array.isArray(hotelObj.amenities) ? hotelObj.amenities : []
                        });
                    }
                });

                if (finalHotels.length > 0) {
                    setHotels(finalHotels);
                }

                // ---- 일정 및 미팅 (누락 차단) ----
                if (raw.itinerary && Array.isArray(raw.itinerary)) {
                    console.log(`[DEBUG] Setting itinerary: ${raw.itinerary.length} days`);
                    setItinerary(raw.itinerary);
                }
                
                if (raw.meetingInfo && Array.isArray(raw.meetingInfo)) {
                    setMeetingInfo(raw.meetingInfo);
                } else if (raw.notices && Array.isArray(raw.notices)) {
                    const mInfo = (Array.isArray(raw.notices) ? raw.notices : [raw.notices])
                        .filter((n: any) => typeof n === 'string' && (n.includes('미팅') || n.includes('집합')))
                        .map((n: string) => ({ type: '미팅장소' as const, title: '미팅 안내', location: n, description: n }));
                    if (mInfo.length > 0) setMeetingInfo(mInfo);
                }

                // ---- 기타 사항 (문자열 강제 전환) ----
                if (raw.inclusions) setInclusions(Array.isArray(raw.inclusions) ? raw.inclusions.join('\n') : String(raw.inclusions));
                if (raw.exclusions) setExclusions(Array.isArray(raw.exclusions) ? raw.exclusions.join('\n') : String(raw.exclusions));
                if (raw.cancellationPolicy) setCancellationPolicy(String(raw.cancellationPolicy));
                if (raw.checklist) {
                    const newChecklist = Array.isArray(raw.checklist) ? raw.checklist.join('\n') : String(raw.checklist);
                    // 기존 체크리스트가 더 길면 유지하고, AI가 준 내용이 5줄 이상으로 풍부할 때만 교체 시도
                    if (newChecklist.split('\n').filter(Boolean).length > 5) {
                        setChecklist(newChecklist);
                    }
                }

                // ---- 유의사항 통합 ----
                const noticesParts: string[] = [];
                if (raw.keyPoints?.length) noticesParts.push('핵심 포인트:\n' + raw.keyPoints.map((k: string) => `• ${k}`).join('\n'));
                if (raw.specialOffers?.length) noticesParts.push('특전/혜택:\n' + raw.specialOffers.map((s: string) => `• ${s}`).join('\n'));
                if (raw.features?.length) noticesParts.push('상품 특징:\n' + raw.features.map((f: string) => `• ${f}`).join('\n'));
                
                if (noticesParts.length > 0) {
                    setNotices(noticesParts.join('\n\n'));
                } else if (raw.notices) {
                    setNotices(Array.isArray(raw.notices) ? raw.notices.join('\n') : String(raw.notices));
                }

                /* [사용자 요청] 2차 조사(날씨/세관 등) 자동 실행 비활성화 - 수동 실행만 허용
                if (raw.destination) {
                    console.log("[Auto-Research] Analysis complete. Triggering secondary research...");
                    setTimeout(() => runSecondaryResearchDirectly(raw.destination, raw.airline || ''), 500);
                }
                */
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

    // 2차 조사를 비동기적으로 바로 호출하기 위한 헬퍼 (기존 runSecondaryResearch의 로직 재활용)
    const runSecondaryResearchDirectly = async (targetDest: string, targetAirline: string) => {
        if (!targetDest) return;
        setResearchLoading(true);
        setResearchError('');
        try {
            const monthMatch = departureDate.match(/-(\d{2})-/);
            const travelMonth = monthMatch ? `${parseInt(monthMatch[1])}월` : '';

            const res = await fetch('/api/confirmation/secondary-research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destination: targetDest,
                    airline: targetAirline,
                    customGuides: customGuideInputs.filter(g => g.trim()),
                    travelMonth,
                    itinerary, // 일정 정보 추가
                }),
            });
            const json = await res.json();
            if (json.success) {
                setSecondaryResearch(json.data);
            }
        } catch (err: any) {
            console.error('[Auto-Research] Failed:', err.message);
        } finally {
            setResearchLoading(false);
        }
    };

    // 여행자 추가/삭제/수정
    const addTraveler = () => setTravelers(prev => [...prev, { name: '', type: 'adult' }]);
    const removeTraveler = (i: number) => setTravelers(prev => prev.filter((_, idx) => idx !== i));
    const updateTraveler = (i: number, field: keyof TravelerInfo, value: string) => {
        setTravelers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
    };

    // 호텔 관리
    const addHotel = () => setHotels(prev => [...prev, { name: '', address: '', checkIn: departureDate, checkOut: returnDate, images: [], amenities: [] }]);
    const removeHotel = (i: number) => setHotels(prev => prev.filter((_, idx) => idx !== i));
    const updateHotel = (i: number, field: string, value: any) => {
        setHotels(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: value } : h));
    };

    // 미팅/수속 정보 관리
    const addMeetingInfo = () => setMeetingInfo(prev => [...prev, { type: '미팅장소', location: '', time: '', description: '', imageUrl: '' }]);
    const removeMeetingInfo = (i: number) => setMeetingInfo(prev => prev.filter((_, idx) => idx !== i));
    const updateMeetingInfo = (i: number, field: keyof MeetingInfo, value: string) => {
        setMeetingInfo(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
    };

    // 파일 핸들러 (Supabase Storage 사용)
    const handleFileUpload = async (type: DocumentFile['type'], label: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !supabase) return;

        setUploading(type);
        try {
            // 파일명 중복 방지를 위한 타임스탬프 조합
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;
            const filePath = `confirmations/${fileName}`;

            // Supabase Storage 업로드
            const { data, error } = await supabase.storage
                .from('confirmations')
                .upload(filePath, file);

            if (error) {
                if (error.message.includes('bucket not found')) {
                    alert('Supabase Storage에 "confirmations" 버킷이 없습니다. 버킷을 먼저 생성해 주세요.');
                } else {
                    alert(`업로드 실패: ${error.message}`);
                }
                return;
            }

            // 공용 URL 가져오기
            const { data: { publicUrl } } = supabase.storage
                .from('confirmations')
                .getPublicUrl(filePath);

            const newFile: DocumentFile = {
                id: `file-${Date.now()}`,
                name: file.name,
                type,
                label,
                url: publicUrl,
                uploadedAt: new Date().toISOString(),
            };

            setFiles(prev => {
                const filtered = prev.filter(f => f.type !== type);
                return [...filtered, newFile];
            });
        } catch (err: any) {
            alert(`오류 발생: ${err.message}`);
        } finally {
            setUploading(null);
        }
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
            const monthMatch = departureDate.match(/-(\d{2})-/);
            const travelMonth = monthMatch ? `${parseInt(monthMatch[1])}월` : '';

            const res = await fetch('/api/confirmation/secondary-research', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    destination,
                    airline,
                    airport: departureAirport,
                    customGuides: customGuideInputs.filter(g => g.trim()),
                    travelMonth,
                    baggageNote: (analysisResult as any)?.baggageNote || '',
                    itinerary, // 일정 정보 추가
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
    const updateSRWeatherForecast = (index: number, field: string, value: string) => {
        setSecondaryResearch((prev: any) => {
            if (!prev || !prev.weather || !prev.weather.forecast) return prev;
            const newForecast = [...prev.weather.forecast];
            newForecast[index] = { ...newForecast[index], [field]: value };
            return { ...prev, weather: { ...prev.weather, forecast: newForecast } };
        });
    };

    const updateSRWeatherClothing = (index: number, field: string, value: string) => {
        setSecondaryResearch((prev: any) => {
            if (!prev || !prev.weather || !prev.weather.clothingTips) return prev;
            const newTips = [...prev.weather.clothingTips];
            newTips[index] = { ...newTips[index], [field]: value };
            return { ...prev, weather: { ...prev.weather, clothingTips: newTips } };
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

    const updateSRCustomsLink = (index: number, field: string, value: string) => {
        setSecondaryResearch((prev: any) => {
            if (!prev || !prev.customs || !prev.customs.links) return prev;
            const newLinks = [...prev.customs.links];
            newLinks[index] = { ...newLinks[index], [field]: value };
            return { ...prev, customs: { ...prev.customs, links: newLinks } };
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
                visitorId: visitorId,
                reservationNumber: reservationNumber.trim(),
                customer: { name: customerName, phone: customerPhone, visitorId: visitorId },
                trip: {
                    productName, productUrl, destination,
                    departureDate, returnDate, duration,
                    travelers, adultCount, childCount, infantCount,
                },
                flight: {
                    airline, departureAirport,
                    departureFlightNumber, departureTime, arrivalTime, departureDuration,
                    returnFlightNumber, returnDepartureTime, returnArrivalTime, returnDuration,
                },
                hotels: hotels.map(h => ({
                    ...h,
                    images: Array.isArray(h.images) ? h.images : (typeof h.images === 'string' ? h.images.split('\n').filter(Boolean) : []),
                    amenities: Array.isArray(h.amenities) ? h.amenities : (typeof h.amenities === 'string' ? h.amenities.split('\n').filter(Boolean) : []),
                })),
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

    // 생성 전에도 예약번호가 있으면 미리 링크 예측 표시
    const currentId = generatedId || (reservationNumber.trim() && reservationNumber !== '미정' && reservationNumber.trim() !== '' ? reservationNumber.trim() : 'AUTO_GENERATE');
    const shareUrl = (typeof window !== 'undefined' && currentId !== 'AUTO_GENERATE')
        ? `${window.location.origin}/confirmation/${currentId}`
        : (typeof window !== 'undefined' ? `${window.location.origin}/confirmation/(저장 시 자동생성)` : '');

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
                    <div className="confirm-field full-width">
                        <CustomerSearchBox onSelect={selectCustomer} />
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
                        <label>가는편 편명</label>
                        <input value={departureFlightNumber} onChange={e => setDepartureFlightNumber(e.target.value)} placeholder="정보 없음" />
                    </div>
                    <div className="confirm-field">
                        <label>오는편 편명</label>
                        <input value={returnFlightNumber} onChange={e => setReturnFlightNumber(e.target.value)} placeholder="KE124" />
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
                {hotels.map((h, i) => (
                    <div key={i} className="hotel-edit-card" style={{ marginBottom: '24px', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <h4 style={{ margin: 0 }}>숙박 {i + 1}</h4>
                            {hotels.length > 1 && <button onClick={() => removeHotel(i)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>✕ 삭제</button>}
                        </div>
                        <div className="confirm-grid">
                            <div className="confirm-field">
                                <label>호텔명 (한글)</label>
                                <input value={h.name || ''} onChange={e => updateHotel(i, 'name', e.target.value)} placeholder="신주쿠 프린스 호텔" />
                            </div>
                            <div className="confirm-field">
                                <label>호텔명 (영문)</label>
                                <input value={h.englishName || ''} onChange={e => updateHotel(i, 'englishName', e.target.value)} placeholder="Shinjuku Prince Hotel" />
                            </div>
                            <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                                <label>주소</label>
                                <input value={h.address || ''} onChange={e => updateHotel(i, 'address', e.target.value)} placeholder="1-30-1 Kabukicho, Shinjuku, Tokyo" />
                            </div>
                            <div className="confirm-field">
                                <label>체크인</label>
                                <input type="date" value={h.checkIn || ''} onChange={e => updateHotel(i, 'checkIn', e.target.value)} />
                            </div>
                            <div className="confirm-field">
                                <label>체크아웃</label>
                                <input type="date" value={h.checkOut || ''} onChange={e => updateHotel(i, 'checkOut', e.target.value)} />
                            </div>
                        </div>
                        <div className="confirm-grid" style={{ marginTop: '12px' }}>
                            <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                                <label>호텔 이미지 URL (엔터로 구분)</label>
                                <textarea
                                    value={Array.isArray(h.images) ? h.images.join('\n') : h.images}
                                    onChange={e => updateHotel(i, 'images', e.target.value.split('\n'))}
                                    rows={2}
                                    placeholder="https://..."
                                />
                            </div>
                            <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                                <label>시설 및 서비스 (엔터로 구분)</label>
                                <textarea
                                    value={Array.isArray(h.amenities) ? h.amenities.join('\n') : h.amenities}
                                    onChange={e => updateHotel(i, 'amenities', e.target.value.split('\n'))}
                                    rows={2}
                                    placeholder="수영장, 와이파이..."
                                />
                            </div>
                        </div>
                    </div>
                ))}
                <button onClick={addHotel} className="btn-add-hotel" style={{ width: '100%', padding: '10px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, color: '#fff' }}>+ 호텔 추가</button>
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
                            <select value={m.type || '미팅장소'} onChange={e => updateMeetingInfo(i, 'type', e.target.value as '미팅장소' | '수속카운터')} className="admin-select" style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem', outline: 'none', background: 'var(--bg-primary)', color: 'inherit' }}>
                                <option value="미팅장소">미팅장소</option>
                                <option value="수속카운터">수속카운터</option>
                            </select>
                        </div>
                        <div className="confirm-field">
                            <label>시간</label>
                            <input value={m.time || ''} onChange={e => updateMeetingInfo(i, 'time', e.target.value)} placeholder="08:00" />
                        </div>
                        <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                            <label>장소/카운터명</label>
                            <input value={m.location || ''} onChange={e => updateMeetingInfo(i, 'location', e.target.value)} placeholder="인천공항 제1여객터미널 3층 A카운터" />
                        </div>
                        <div className="confirm-field" style={{ gridColumn: '1 / -1' }}>
                            <label>상세 설명</label>
                            <textarea value={m.description || ''} onChange={e => updateMeetingInfo(i, 'description', e.target.value)} rows={2} placeholder="여권을 지참하고 담당자(김호기: 010-1234-5678)를 찾아주세요." />
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
                        const isUploading = uploading === slot.type;
                        return (
                            <div key={slot.type} className={`file-upload-slot ${uploaded ? 'uploaded' : ''} ${isUploading ? 'uploading' : ''}`}>
                                <div className="slot-icon">{isUploading ? '⌛' : slot.icon}</div>
                                <div className="slot-label">{isUploading ? '업로드 중...' : slot.label}</div>
                                {uploaded && !isUploading && <div className="slot-filename">{uploaded.name}</div>}
                                <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={e => handleFileUpload(slot.type, slot.label, e)}
                                    disabled={isUploading}
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

                <div className="itinerary-preview-list" style={{ marginTop: '12px' }}>
                    {itinerary.map((day: any, i: number) => (
                        <div key={i} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px', background: '#fff' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b', marginBottom: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
                                {day.day || `Day ${i + 1}`} - {day.title}
                            </div>
                            
                            {/* 활동 내용 (신규 Timeline 구조) */}
                            {day.timeline && Array.isArray(day.timeline) && day.timeline.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '12px 0' }}>
                                    {day.timeline.map((item: any, idx: number) => (
                                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                                            <div style={{ marginTop: '2px', color: item.type === 'location' ? '#10b981' : '#94a3b8' }}>
                                                {item.type === 'location' ? '📍' : '•'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                                                    {item.title} {item.type === 'location' && '›'}
                                                </div>
                                                {item.subtitle && <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{item.subtitle}</div>}
                                                {item.description && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>{item.description}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : day.activities && Array.isArray(day.activities) && (
                                <ul style={{ paddingLeft: '20px', margin: '8px 0', fontSize: '0.85rem', color: '#475569', lineHeight: '1.5' }}>
                                    {day.activities.map((act: string, idx: number) => (
                                        <li key={idx} dangerouslySetInnerHTML={{ __html: act }} />
                                    ))}
                                </ul>
                            )}

                            {/* 부가 정보 (교통, 호텔, 식사) */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px', fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                                {day.transport && 
                                 (!['항공사', '항공편', 'null', ''].includes(day.transport.airline || '') || !['비행편명', 'null', '', '없음'].includes(day.transport.flightNo || '')) && (
                                    <div>🛫 <strong>비행편:</strong> {day.transport.airline !== 'null' ? day.transport.airline : ''} {day.transport.flightNo !== 'null' ? day.transport.flightNo : ''} ({day.transport.departureCity !== 'null' ? day.transport.departureCity : ''} {day.transport.departureTime !== 'null' ? day.transport.departureTime : ''} 출발 ➔ {day.transport.arrivalCity !== 'null' ? day.transport.arrivalCity : ''} {day.transport.arrivalTime !== 'null' ? day.transport.arrivalTime : ''} 도착)</div>
                                )}
                                {day.transportation && typeof day.transportation === 'string' && <div>🚡 <strong>교통:</strong> {day.transportation}</div>}
                                {day.hotel && <div>🏨 <strong>예정호텔:</strong> {day.hotel}</div>}
                                {day.meals && (
                                    <div>🍽️ <strong>식사:</strong> 조식({day.meals.breakfast || '-'}) / 중식({day.meals.lunch || '-'}) / 석식({day.meals.dinner || '-'})</div>
                                )}
                            </div>
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
                    {researchLoading ? 'AI 조사 중... (약 10~15초)' : '2차 조사하기'}
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
                                    <label style={{ color: 'var(--text-secondary)' }}>유하/eSIM 추천</label>
                                    <textarea rows={2} value={secondaryResearch.roaming?.simEsim || ''} onChange={e => updateSRField('roaming', 'simEsim', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>통신 꿀팁</label>
                                    <textarea rows={2} value={secondaryResearch.roaming?.roamingTip || ''} onChange={e => updateSRField('roaming', 'roamingTip', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 날씨 및 복장 */}
                    {secondaryResearch && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🌡️ 날씨 및 복장 가이드
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {/* 날씨 요약 */}
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>현지 날씨 요약</label>
                                    <textarea 
                                        rows={2} 
                                        value={secondaryResearch.weather?.summary || ''} 
                                        onChange={e => updateSRField('weather', 'summary', e.target.value)}
                                        placeholder="현지 기후에 대한 전반적인 요약을 입력하세요."
                                    />
                                </div>

                                {/* 일별 예보 (그리드) */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '8px', display: 'block' }}>📅 일별 기온 및 예보</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                        {secondaryResearch.weather?.forecast?.map((day: any, idx: number) => {
                                            // 날짜 계산 로직
                                            let displayDate = "";
                                            try {
                                                if (departureDate) {
                                                    const startDate = new Date(departureDate.replace(/\./g, '-'));
                                                    if (!isNaN(startDate.getTime())) {
                                                        const targetDate = new Date(startDate);
                                                        targetDate.setDate(startDate.getDate() + idx);
                                                        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                                                        const dd = String(targetDate.getDate()).padStart(2, '0');
                                                        const week = ['일', '월', '화', '수', '목', '금', '토'][targetDate.getDay()];
                                                        displayDate = `${mm}.${dd} (${week})`;
                                                    }
                                                }
                                            } catch(e) {}

                                            // 날씨 아이콘 매칭 로직
                                            const getWeatherIcon = (desc: string) => {
                                                if (!desc) return "☀️";
                                                const d = desc.toLowerCase();
                                                if (d.includes("비") || d.includes("샤워") || d.includes("rain") || d.includes("shower")) return "🌧️";
                                                if (d.includes("눈") || d.includes("snow")) return "❄️";
                                                if (d.includes("흐림") || d.includes("구름") || d.includes("cloud") || d.includes("overcast")) return "☁️";
                                                if (d.includes("낙뢰") || d.includes("번개") || d.includes("thunder") || d.includes("storm")) return "⚡";
                                                if (d.includes("안개") || d.includes("mist") || d.includes("fog")) return "🌫️";
                                                return "☀️";
                                            };

                                            return (
                                                <div key={idx} style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{day.date}</div>
                                                            {displayDate && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{displayDate}</div>}
                                                        </div>
                                                        <div style={{ fontSize: '1.2rem' }}>{getWeatherIcon(day.description)}</div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>최저</label>
                                                            <input 
                                                                value={day.tempMin} 
                                                                onChange={e => updateSRWeatherForecast(idx, 'tempMin', e.target.value)}
                                                                style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                                                            />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <label style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>최고</label>
                                                            <input 
                                                                value={day.tempMax} 
                                                                onChange={e => updateSRWeatherForecast(idx, 'tempMax', e.target.value)}
                                                                style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <input 
                                                        value={day.description} 
                                                        onChange={e => updateSRWeatherForecast(idx, 'description', e.target.value)}
                                                        placeholder="날씨 상태"
                                                        style={{ width: '100%', fontSize: '0.8rem', padding: '4px 8px' }}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 추천 복장 팁 */}
                                <div>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginBottom: '8px', display: 'block' }}>👕 항목별 복장 추천</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        {secondaryResearch.weather?.clothingTips?.map((tip: any, idx: number) => (
                                            <div key={idx} style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                                                <label style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 600 }}>{tip.title}</label>
                                                <textarea 
                                                    rows={2} 
                                                    value={tip.content} 
                                                    onChange={e => updateSRWeatherClothing(idx, 'content', e.target.value)}
                                                    style={{ width: '100%', fontSize: '0.8rem', padding: '6px 8px', marginTop: '4px', background: 'transparent', border: 'none', resize: 'none', color: '#fff' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 짐싸기 요약 */}
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>🎒 최종 짐싸기 요약</label>
                                    <input 
                                        value={secondaryResearch.weather?.packingSummary || ''} 
                                        onChange={e => updateSRField('weather', 'packingSummary', e.target.value)}
                                        placeholder="전체적인 복장 요약을 입력하세요."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 세관 및 입국 */}
                    {secondaryResearch && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '18px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff', marginBottom: '12px', fontSize: '1rem' }}>🛃 입국·세관 · 공식 링크</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>주요 경고 제목</label>
                                    <input value={secondaryResearch.customs?.warningTitle || ''} onChange={e => updateSRField('customs', 'warningTitle', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>핵심 경고 제목 (레퍼런스형)</label>
                                    <input value={secondaryResearch.customs?.majorAlert?.title || ''} onChange={e => {
                                        setSecondaryResearch((prev: any) => ({
                                            ...prev,
                                            customs: { ...prev.customs, majorAlert: { ...prev.customs.majorAlert, title: e.target.value } }
                                        }));
                                    }} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>핵심 경고 벌금/내용</label>
                                    <input value={secondaryResearch.customs?.majorAlert?.penalty || ''} onChange={e => {
                                        setSecondaryResearch((prev: any) => ({
                                            ...prev,
                                            customs: { ...prev.customs, majorAlert: { ...prev.customs.majorAlert, penalty: e.target.value } }
                                        }));
                                    }} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>미성년자 안내 (간략)</label>
                                    <textarea rows={2} value={secondaryResearch.customs?.minorEntry || ''} onChange={e => updateSRField('customs', 'minorEntry', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>미성년자 상세 서류/공증 가이드</label>
                                    <textarea rows={3} value={secondaryResearch.customs?.minorDetail || ''} onChange={e => updateSRField('customs', 'minorDetail', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>면세 한도</label>
                                    <textarea rows={2} value={secondaryResearch.customs?.dutyFree || ''} onChange={e => updateSRField('customs', 'dutyFree', e.target.value)} />
                                </div>
                                <div className="confirm-field">
                                    <label style={{ color: 'var(--text-secondary)' }}>여권 유의사항</label>
                                    <textarea rows={2} value={secondaryResearch.customs?.passportNote || ''} onChange={e => updateSRField('customs', 'passportNote', e.target.value)} />
                                </div>

                                {/* 입국 절차 상세 */}
                                <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '8px' }}>📝 입국 절차 (단계별)</div>
                                    <div className="confirm-field">
                                        <label style={{ color: 'var(--text-secondary)' }}>절차 제목</label>
                                        <input value={secondaryResearch.customs?.arrivalProcedure?.title || ''} onChange={e => {
                                            setSecondaryResearch((prev: any) => ({
                                                ...prev,
                                                customs: { ...prev.customs, arrivalProcedure: { ...prev.customs.arrivalProcedure, title: e.target.value } }
                                            }));
                                        }} />
                                    </div>
                                    {secondaryResearch.customs?.arrivalProcedure?.steps?.map((step: any, idx: number) => (
                                        <div key={idx} style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: 'minmax(120px, 1fr) 2fr', 
                                            gap: '12px', 
                                            marginBottom: '10px', 
                                            background: 'var(--bg-tertiary)', 
                                            padding: '12px', 
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)' 
                                        }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>단계명</label>
                                                <input value={step.step} placeholder="단계명" style={{ width: '100%', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '6px 10px', color: '#fff' }} onChange={e => {
                                                    const newSteps = [...(secondaryResearch.customs?.arrivalProcedure?.steps || [])];
                                                    newSteps[idx] = { ...newSteps[idx], step: e.target.value };
                                                    setSecondaryResearch((prev: any) => ({
                                                        ...prev,
                                                        customs: { ...prev.customs, arrivalProcedure: { ...(prev.customs?.arrivalProcedure || {}), steps: newSteps } }
                                                    }));
                                                }} />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>상세 가이드</label>
                                                <textarea rows={2} value={step.description} placeholder="상세 내용" style={{ width: '100%', fontSize: '0.8rem', padding: '8px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: '#fff', resize: 'vertical' }} onChange={e => {
                                                    const newSteps = [...(secondaryResearch.customs?.arrivalProcedure?.steps || [])];
                                                    newSteps[idx] = { ...newSteps[idx], description: e.target.value };
                                                    setSecondaryResearch((prev: any) => ({
                                                        ...prev,
                                                        customs: { ...prev.customs, arrivalProcedure: { ...(prev.customs?.arrivalProcedure || {}), steps: newSteps } }
                                                    }));
                                                }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* 링크 관리 */}
                                <div style={{ marginTop: '8px' }}>
                                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '8px', display: 'block' }}>공식 링크 (비자, 신고서 등)</label>
                                    {secondaryResearch.customs?.links?.map((link: any, idx: number) => (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '8px' }}>
                                            <input value={link.label} onChange={e => updateSRCustomsLink(idx, 'label', e.target.value)} placeholder="링크명" style={{ fontSize: '0.8rem' }} />
                                            <input value={link.url} onChange={e => updateSRCustomsLink(idx, 'url', e.target.value)} placeholder="URL" style={{ fontSize: '0.8rem' }} />
                                        </div>
                                    ))}
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
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '8px' }}>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>위탁수하물 무게</label>
                                        <input value={(secondaryResearch as any).baggage?.checkedWeight || ''} onChange={e => updateSRField('baggage', 'checkedWeight', e.target.value)} />
                                    </div>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>위탁 크기/규격</label>
                                        <input value={(secondaryResearch as any).baggage?.checkedSize || ''} placeholder="가로, 세로, 높이 합 203cm 이내" onChange={e => updateSRField('baggage', 'checkedSize', e.target.value)} />
                                    </div>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>위탁 추가 노트</label>
                                        <input value={(secondaryResearch as any).baggage?.checkedNote || ''} onChange={e => updateSRField('baggage', 'checkedNote', e.target.value)} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '8px' }}>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>기내수하물 무게</label>
                                        <input value={(secondaryResearch as any).baggage?.carryonWeight || ''} onChange={e => updateSRField('baggage', 'carryonWeight', e.target.value)} />
                                    </div>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>기내 크기/규격</label>
                                        <input value={(secondaryResearch as any).baggage?.carryonSize || ''} placeholder="(각 변 최대 55cm x 40cm x 20cm) 합 115cm 이내" onChange={e => updateSRField('baggage', 'carryonSize', e.target.value)} />
                                    </div>
                                    <div className="confirm-field" style={{ marginBottom: 0 }}>
                                        <label style={{ color: 'var(--text-secondary)' }}>기내 추가 노트</label>
                                        <input value={(secondaryResearch as any).baggage?.carryonNote || ''} onChange={e => updateSRField('baggage', 'carryonNote', e.target.value)} />
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

// Force Vercel Redeploy - Timestamp: 2026-02-23T12:55:00+09:00

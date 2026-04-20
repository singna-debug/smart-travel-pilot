'use client';

import { useState, useRef, useEffect } from 'react';
import type { AnalysisResult, SingleResult, ConsultationData } from '@/types';
import CustomerSearchBox from './CustomerSearchBox';

// Declare google on window for TypeScript
declare global {
    interface Window {
        google: any;
    }
}


function formatToHtmlDate(dateStr: string): string {
    if (!dateStr) return '';
    const cleanedDate = dateStr.replace(/[^0-9]/g, '');
    let targetYear, targetMonth, targetDay;

    const mdMatch = dateStr.match(/(\d+)\s*월\s*(\d+)\s*일/);
    if (mdMatch) {
        const now = new Date();
        targetYear = now.getFullYear();
        targetMonth = parseInt(mdMatch[1]) - 1;
        targetDay = parseInt(mdMatch[2]);
    } else if (cleanedDate.length >= 8) {
        targetYear = parseInt(cleanedDate.substring(0, 4));
        targetMonth = parseInt(cleanedDate.substring(4, 6)) - 1;
        targetDay = parseInt(cleanedDate.substring(6, 8));
    } else {
        return dateStr; // fallback for unparseable dates
    }

    const d = new Date(targetYear, targetMonth, targetDay);
    if (isNaN(d.getTime())) return dateStr;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default function UrlAnalyzer() {
    const [mode, setMode] = useState<'single' | 'compare'>('single');
    const [singleUrl, setSingleUrl] = useState('');
    const [multiUrls, setMultiUrls] = useState(['', '']);
    const [loading, setLoading] = useState(false);
    const [singleResult, setSingleResult] = useState<SingleResult | null>(null);
    const [compareResult, setCompareResult] = useState<{
        products: AnalysisResult[];
        comparison: string;
    } | null>(null);
    const [error, setError] = useState('');
    const [analysisStep, setAnalysisStep] = useState('');

    // 고객 정보 및 구글 연동 관련 상태
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [destination, setDestination] = useState('');
    const [departureDate, setDepartureDate] = useState('');
    const [duration, setDuration] = useState('');
    const [returnDate, setReturnDate] = useState('');
    const [status, setStatus] = useState('상담중');
    const [interestedProduct, setInterestedProduct] = useState('');
    const [confirmedProduct, setConfirmedProduct] = useState('');
    const [confirmedDate, setConfirmedDate] = useState('');
    const [recurringCustomer, setRecurringCustomer] = useState('신규고객');
    const [inquirySource, setInquirySource] = useState('');
    const [travelersCount, setTravelersCount] = useState('');
    const [memo, setMemo] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // 귀국일 자동 계산 로직
    useEffect(() => {
        if (departureDate && duration) {
            try {
                // 노이즈 제거 ([CONTENT], undefined 등)
                const cleanDuration = duration.replace(/\[CONTENT\]|\[CONTENT BODY\]|====|METADATA|undefined|NULL/gi, '').trim();
                if (!cleanDuration) return;

                const isHyphenated = departureDate.includes('-');
                let cleanedDate = departureDate.replace(/[^0-9]/g, '');

                let targetYear: number;
                let targetMonth: number;
                let targetDay: number;

                // "2월 3일" 처럼 월/일이 명시된 경우 추출
                const mdMatch = departureDate.match(/(\d+)\s*월\s*(\d+)\s*일/);
                if (mdMatch) {
                    const now = new Date();
                    targetYear = now.getFullYear();
                    targetMonth = parseInt(mdMatch[1]) - 1;
                    targetDay = parseInt(mdMatch[2]);
                } else if (cleanedDate.length >= 8) {
                    targetYear = parseInt(cleanedDate.substring(0, 4));
                    targetMonth = parseInt(cleanedDate.substring(4, 6)) - 1;
                    targetDay = parseInt(cleanedDate.substring(6, 8));
                } else if (cleanedDate.length >= 2 && cleanedDate.length < 8) {
                    const now = new Date();
                    targetYear = now.getFullYear();
                    if (cleanedDate.length === 2) { // 2일? -> 현재월
                        targetMonth = now.getMonth();
                        targetDay = parseInt(cleanedDate);
                    } else if (cleanedDate.length === 3 || cleanedDate.length === 4) { // 203 or 0203
                        const val = cleanedDate.padStart(4, '0');
                        targetMonth = parseInt(val.substring(0, 2)) - 1;
                        targetDay = parseInt(val.substring(2, 4));
                    } else {
                        return;
                    }
                } else {
                    return;
                }

                const date = new Date(targetYear, targetMonth, targetDay);
                if (isNaN(date.getTime())) return;

                // "2박 3일", "3일", "3D", "3DAYS" 등에서 마지막 숫자 추출 (일수)
                const daysMatch = cleanDuration.match(/(\d+)\s*일/) || cleanDuration.match(/(\d+)\s*D/i);
                let totalDays = 0;

                if (daysMatch) {
                    totalDays = parseInt(daysMatch[1]);
                } else {
                    // "3박" 같은 패턴 처리 (보통 박+1 = 일)
                    const nightMatch = cleanDuration.match(/(\d+)\s*박/);
                    if (nightMatch) totalDays = parseInt(nightMatch[1]) + 1;
                    else {
                        // 단순 숫자만 있는 경우 (3 -> 3일로 간주)
                        const justNumMatch = cleanDuration.match(/^(\d+)$/);
                        if (justNumMatch) totalDays = parseInt(justNumMatch[1]);
                    }
                }

                if (totalDays > 0) {
                    // 3일 일정이면 출발일(1일차) + 2일
                    date.setDate(date.getDate() + (totalDays - 1));

                    const rYear = date.getFullYear();
                    const rMonth = String(date.getMonth() + 1).padStart(2, '0');
                    const rDay = String(date.getDate()).padStart(2, '0');

                    // HTML5 <input type="date">는 반드시 YYYY-MM-DD 형식을 요구함
                    setReturnDate(`${rYear}-${rMonth}-${rDay}`);
                }
            } catch (e) {
                console.error('Return date calculation error:', e);
            }
        }
    }, [departureDate, duration]);
    
    // 예약확정 상품 URL 입력 시 자동 분석 (Booking 모드: 목적지, 날짜 등 핵심 정보만 추출)
    useEffect(() => {
        const analyzeConfirmedProduct = async () => {
            // URL이 유효하고, 아직 주요 정보가 입력되지 않았거나 URL만 새로 입력된 경우 자동 분석 시도
            if (confirmedProduct && confirmedProduct.startsWith('http') && confirmedProduct.length > 15) {
                // 중복 요청 방지를 위한 간단한 체크 (이전 URL과 다르거나 주요 필드가 비어있을 때)
                if (!destination || !departureDate || destination === '미정') {
                    console.log('[UrlAnalyzer] 예약 상품 자동 분석 시작 (Booking Mode)');
                    setAnalysisStep('예약 정보 추출 중...');
                    try {
                        const res = await fetch('/api/crawl-analyze', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url: confirmedProduct, mode: 'booking' })
                        });
                        const data = await res.json();
                        if (data.success && data.data) {
                            const p = data.data;
                            if (p.destination && (!destination || destination === '미정')) setDestination(p.destination);
                            if (p.departureDate) setDepartureDate(formatToHtmlDate(p.departureDate));
                            if (p.returnDate) setReturnDate(formatToHtmlDate(p.returnDate));
                            if (p.duration && (!duration || duration === '미정')) setDuration(p.duration);
                            if (p.title && (!interestedProduct || interestedProduct === '미정')) setInterestedProduct(p.title);
                            console.log('[UrlAnalyzer] 예약 정보 추출 성공');
                        }
                    } catch (e) {
                        console.error('Booking analysis error:', e);
                    } finally {
                        setAnalysisStep('');
                    }
                }
            }
        };

        const timer = setTimeout(analyzeConfirmedProduct, 1000); // 디바운싱
        return () => clearTimeout(timer);
    }, [confirmedProduct]);

    // 구글 연동 관련 상태
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [googleError, setGoogleError] = useState('');
    const tokenClient = useRef<any>(null);

    // 구글 GIS 토큰 클라이언트 초기화
    useEffect(() => {
        // 전역 스크립트 'google' 객체 로드 대기
        const initGoogleClient = () => {
            if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                try {
                    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
                    if (!clientId) {
                        console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID가 설정되지 않아 구글 연락처 연동을 사용할 수 없습니다.');
                        return;
                    }

                    tokenClient.current = window.google.accounts.oauth2.initTokenClient({
                        client_id: clientId,
                        scope: 'https://www.googleapis.com/auth/contacts.readonly',
                        callback: async (tokenResponse: any) => {
                            if (tokenResponse && tokenResponse.access_token) {
                                await fetchGoogleContacts(tokenResponse.access_token);
                            }
                        },
                    });
                } catch (err) {
                    console.error('구글 클라이언트 초기화 오류:', err);
                }
            } else {
                // 스크립트가 아직 로드되지 않았으면 약간 지연 후 다시 시도
                setTimeout(initGoogleClient, 500);
            }
        };

        initGoogleClient();
    }, []);

    const handleGoogleContactsClick = () => {
        if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
            alert('구글 클라이언트 ID(NEXT_PUBLIC_GOOGLE_CLIENT_ID)가 환경 변수에 설정되어 있지 않습니다.');
            return;
        }

        if (!tokenClient.current) {
            alert('구글 인증 클라이언트가 아직 준비되지 않았습니다. 잠시 후 시도해주세요.');
            return;
        }

        setGoogleError('');
        setIsGoogleLoading(true);
        // Popup opens here, callback handles the token
        tokenClient.current.requestAccessToken();
    };

    const fetchGoogleContacts = async (accessToken: string) => {
        try {
            const response = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses&pageSize=1000', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error('연락처를 블러오지 못했습니다.');
            }

            const data = await response.json();
            const connections = data.connections || [];

            if (connections.length === 0) {
                alert('연락처가 없습니다.');
                setIsGoogleLoading(false);
                return;
            }

            // 연락처 선택 UI 띄우기 (간소화를 위해 간단한 브라우저 자체 프롬프트/커스텀 팝업 대체재로 첫번째 또는 검색 사용 가능하지만,
            // 여기서는 자체 구현된 선택창을 만들거나 단순히 목록을 console에 찍고 사용자에게 가장 자주 쓰는 형태를 제공합니다.)
            // 이 구현에서는 최신 연락처 10개를 alert/prompt로 선택하게 하거나, 단순히 최상단 1개만 임시로 가져오는 로직을 넣고 
            // 실전에서는 모달 UI를 권장합니다.

            // 이름과 전화번호가 모두 있는 연락처 필터링
            const validContacts = connections.filter((person: any) =>
                person.names && person.names.length > 0 &&
                person.phoneNumbers && person.phoneNumbers.length > 0
            ).map((person: any) => ({
                name: person.names[0].displayName,
                phone: person.phoneNumbers[0].canonicalForm || person.phoneNumbers[0].value
            }));

            if (validContacts.length === 0) {
                alert('이름과 전화번호가 모두 등록된 연락처가 없습니다.');
                setIsGoogleLoading(false);
                return;
            }

            // 간단한 이름 검색 입력 받기 (간이 UI)
            const searchName = window.prompt(`총 ${validContacts.length}개의 연락처를 불러왔습니다. 검색할 이름을 입력하세요 (취소 시 맨 위 연락처 자동 입력):`);

            let selectedContact = validContacts[0];

            if (searchName) {
                const found = validContacts.find((c: any) => c.name.includes(searchName));
                if (found) {
                    selectedContact = found;
                } else {
                    alert('일치하는 이름을 찾을 수 없어 첫 번째 연락처를 입력합니다.');
                }
            }

            setCustomerName(selectedContact.name);
            setCustomerPhone(selectedContact.phone);

        } catch (err: any) {
            console.error('Google API Error:', err);
            setGoogleError('연락처를 불러오는 중 오류가 발생했습니다.');
            alert('구글 연락처 불러오기 실패: ' + err.message);
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleCustomerSelect = (c: ConsultationData) => {
        setCustomerName(c.customer.name);
        setCustomerPhone(c.customer.phone);
        if (c.trip.destination) setDestination(c.trip.destination);
        if (c.trip.departure_date) setDepartureDate(formatToHtmlDate(c.trip.departure_date));
        if (c.trip.duration) setDuration(c.trip.duration);
        if (c.trip.return_date) setReturnDate(formatToHtmlDate(c.trip.return_date));
        if (c.trip.product_name) setInterestedProduct(c.trip.product_name);
        if (c.trip.url) setSingleUrl(c.trip.url);
        if (c.trip.travelers_count) setTravelersCount(String(c.trip.travelers_count));
        setRecurringCustomer('재방문');
        if (c.automation.inquirySource) setInquirySource(c.automation.inquirySource);
        if (c.summary) setMemo(c.summary);
    };



    const analyzeSingle = async () => {
        if (!singleUrl.trim()) {
            setError('URL을 입력해주세요.');
            return;
        }

        setLoading(true);
        setError('');
        setAnalysisStep('분석 중...');
        setSingleResult(null);

        try {
            const apiUrl = '/api/analyze-url';

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: singleUrl, mode: 'normal' }),
            });

            let data;
            const textResponse = await response.text();
            try {
                data = JSON.parse(textResponse);
            } catch (e) {
                console.error("Non-JSON response:", textResponse.substring(0, 200));
                if (textResponse.includes("An error occurred") || textResponse.includes("504") || textResponse.includes("<html")) {
                    throw new Error("서버 응답 시간(30초)을 초과했습니다. 화면에 보이지 않는 많은 데이터를 처리 중입니다. 다시 시도해주세요.");
                }
                throw new Error("서버 오류가 발생했습니다. (JSON 파싱 실패)");
            }

            if (data.success) {
                setSingleResult(data.data);

                const info = data.data.raw;
                if (!destination) setDestination(info.destination || '');
                if (!departureDate && info.departureDate) setDepartureDate(formatToHtmlDate(info.departureDate));
                if (!duration) setDuration(info.duration || '');
                if (!interestedProduct) setInterestedProduct(info.title || '');

                if (customerName.trim() || customerPhone.trim()) {
                    setTimeout(() => saveAutomatically(data.data, false), 500);
                }
            } else {
                setError(data.error || '분석에 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.message || '분석 중 오류가 발생했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
            setAnalysisStep('');
        }
    };

    const analyzeMultiple = async () => {
        const validUrls = multiUrls.filter(url => url.trim());
        if (validUrls.length < 2) {
            setError('비교하려면 2개 이상의 URL이 필요합니다.');
            return;
        }

        setLoading(true);
        setError('');
        setAnalysisStep('비교 분석 중...');
        setCompareResult(null);

        try {
            const response = await fetch('/api/analyze-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: validUrls }),
            });
            const textResponse = await response.text();
            let data;
            try {
                data = JSON.parse(textResponse);
            } catch (e) {
                console.error("Non-JSON response:", textResponse.substring(0, 200));
                if (textResponse.includes("An error occurred") || textResponse.includes("504") || textResponse.includes("<html")) {
                    throw new Error("서버 응답 시간(30초)을 초과했습니다. 다시 시도해주세요.");
                }
                throw new Error("서버 오류가 발생했습니다. (JSON 파싱 실패)");
            }

            if (data.success) {
                setCompareResult(data.data);

                if (customerName.trim() || customerPhone.trim()) {
                    setTimeout(() => saveAutomatically(data.data, true), 500);
                }
            } else {
                setError(data.error || '비교 분석에 실패했습니다.');
            }
        } catch (err: any) {
            setError(err.message || '비교 분석 중 오류가 발생했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
            setAnalysisStep('');
        }
    };


    const addUrlField = () => {
        if (multiUrls.length < 5) {
            setMultiUrls([...multiUrls, '']);
        }
    };

    const updateMultiUrl = (index: number, value: string) => {
        const newUrls = [...multiUrls];
        newUrls[index] = value;
        setMultiUrls(newUrls);
    };

    const removeUrlField = (index: number) => {
        if (multiUrls.length > 2) {
            setMultiUrls(multiUrls.filter((_, i) => i !== index));
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert('클립보드에 복사되었습니다.');
    };

    const handleGreetingCopy = (content: string) => {
        // 중복 인사말 방지: content에 이미 "안녕하세요"가 포함되어 있는지 확인
        const hasGreeting = content.includes('안녕하세요') || content.includes('님!');
        const greeting = hasGreeting ? '' : `안녕하세요. 모두투어 김호기 팀장입니다.\n${customerName || '고객'}님 문의주신 ${destination || '요청하신'} 일정표입니다.\n\n`;
        const footer = `\n\n※ 추가로 궁금하신 점이나, 더 비교하고 싶으신 상품이 있으시면 편하게 말씀해주세요.\n감사합니다. 김호기 드림\n\n📞 상담 및 문의\n* 담당자: (주)클럽모두투어 김호기\n* 직통전화: 02-951-9004\n* 휴대폰: 010-9307-9004`;

        // 만약 content 내부에 이미 "예약 전 확인사항" 또는 "※" 문구가 있다면 중복 방지를 위해 제거
        let cleanedContent = content;
        if (content.includes("예약 전 확인사항")) {
            cleanedContent = content.split("※")[0].trim();
        } else if (content.includes("※")) {
            cleanedContent = content.split("※")[0].trim();
        }

        // 링크 포맷 수정: 서버에서 이미 [원문 일정표 열기]\n(URL) 형식을 제공하므로 그대로 사용
        const linkFixedContent = cleanedContent;

        const fullText = greeting + linkFixedContent + footer;
        copyToClipboard(fullText);
    };

    // 자동 저장 함수 (상태 업데이트 후 바로 호출하기 위해 데이터 인자를 받음)
    const saveAutomatically = async (analysisData: any, isComparison: boolean) => {
        setIsSaving(true);
        try {
            await fetch('/api/save-consultation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName,
                    customerPhone,
                    destination,
                    departureDate,
                    duration,
                    returnDate,
                    status,
                    confirmedProduct,
                    confirmedDate,
                    recurringCustomer,
                    inquirySource,
                    travelersCount: travelersCount === '' ? null : Number(travelersCount),
                    source: '수동상담',
                    memo,
                    analysisData,
                    isComparison: isComparison,
                    // 비교 분석 시 상품명과 URL을 명시적으로 전달
                    interestedProduct: isComparison && analysisData?.products 
                        ? analysisData.products.map((p: any) => p.raw.title).join(', ')
                        : interestedProduct,
                    productUrl: isComparison 
                        ? multiUrls.filter(u => u.trim()).join(', ')
                        : singleUrl,
                }),
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Auto-save error:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveToSheets = async () => {
        // 고객명이 있어야 저장되도록 변경
        if (!customerName.trim()) {
            alert('고객 성함을 입력해주세요. (이름이 있어야 시트에 저장됩니다.)');
            return;
        }

        const analysisResult = mode === 'single' ? singleResult : compareResult;
        if (!analysisResult) {
            alert('분석 결과가 없습니다.');
            return;
        }

        await saveAutomatically(analysisResult, mode === 'compare');
    };

    // Customer Info Form Component
    const renderCustomerForm = () => (
        <div className="customer-info-section" style={{
            marginBottom: '32px',
            background: 'var(--bg-card)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)'
        }}>
            <div className="analyzer-header-mobile">
                <div>
                    <h4 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📋 고객 상담 정보 등록
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '6px 0 0 0' }}>입력한 정보는 분석 결과와 함께 구글 시트에 자동 저장됩니다.</p>
                </div>
                <div className="analyzer-header-buttons" style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={handleGoogleContactsClick}
                        disabled={isGoogleLoading}
                        className="action-button"
                        style={{
                            background: 'rgba(0, 212, 170, 0.1)',
                            color: 'var(--accent-primary)',
                            border: '1px solid rgba(0, 212, 170, 0.3)',
                            padding: '10px 20px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '600'
                        }}
                    >
                        <svg style={{ width: '18px', height: '18px', fill: 'currentColor' }} viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>
                        {isGoogleLoading ? '불러오는 중...' : '구글 연락처 연동'}
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                const resp = await fetch('/api/sheet-info');
                                const data = await resp.json();
                                if (data.success && data.url) {
                                    window.open(data.url, '_blank');
                                } else {
                                    window.open(`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_SHEET_ID}/edit`, '_blank');
                                }
                            } catch (e) {
                                window.open(`https://docs.google.com/spreadsheets/d/${process.env.NEXT_PUBLIC_SHEET_ID}/edit`, '_blank');
                            }
                        }}
                        className="action-button"
                        style={{
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            padding: '10px 20px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: '600',
                            textDecoration: 'none',
                            fontSize: '0.9rem',
                            cursor: 'pointer'
                        }}
                    >
                        <svg style={{ width: '18px', height: '18px', fill: 'currentColor' }} viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V7h4v2zm5 8h-4v-2h4v2zm0-4h-4v-2h4v2zm0-4h-4V7h4v2z" /></svg>
                        구글 시트 보기
                    </button>
                </div>
            </div>

            <CustomerSearchBox onSelect={handleCustomerSelect} />

            {/* Row 1: 고객명, 연락처, 여행지 */}
            <div className="analyzer-form-grid-3">
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>고객명 *</label>
                    <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="홍길동"
                        className="analyzer-input"
                        style={{ width: '100%' }}
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>연락처</label>
                    <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="01012345678"
                        className="analyzer-input"
                        style={{ width: '100%' }}
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>총인원</label>
                    <input
                        type="number"
                        value={travelersCount}
                        onChange={(e) => setTravelersCount(e.target.value)}
                        placeholder="예: 2"
                        min="1"
                        className="analyzer-input"
                        style={{ width: '100%' }}
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>여행지</label>
                    <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="오사카"
                        className="analyzer-input"
                        style={{ width: '100%' }}
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>재방문 여부</label>
                    <select
                        value={recurringCustomer}
                        onChange={(e) => setRecurringCustomer(e.target.value)}
                        className="analyzer-input"
                        style={{ width: '100%', appearance: 'none', cursor: 'pointer' }}
                    >
                        <option value="신규고객">신규고객</option>
                        <option value="재방문">재방문</option>
                    </select>
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>유입 경로</label>
                    <select
                        value={inquirySource}
                        onChange={(e) => setInquirySource(e.target.value)}
                        className="analyzer-input"
                        style={{ width: '100%', appearance: 'none', cursor: 'pointer' }}
                    >
                        <option value="">-- 선택 --</option>
                        <option value="네이버 블로그">네이버 블로그</option>
                        <option value="카카오톡 채널">카카오톡 채널</option>
                        <option value="인스타그램 및 페이스북">인스타그램 및 페이스북</option>
                        <option value="당근마켓">당근마켓</option>
                        <option value="닷컴">닷컴</option>
                        <option value="지인소개">지인소개</option>
                        <option value="기존고객">기존고객</option>
                        <option value="전화문의">전화문의</option>
                        <option value="매장방문">매장방문</option>
                        <option value="기타">기타</option>
                    </select>
                </div>
            </div>

            {/* Row 2: 출발일, 기간, 귀국일, 상담 상태 */}
            <div className="analyzer-form-grid-4">
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>출발일</label>
                    <input
                        type="text"
                        value={departureDate}
                        onChange={(e) => setDepartureDate(e.target.value)}
                        placeholder="20250209"
                        className="analyzer-input"
                        style={{ width: '100%' }}
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>기간</label>
                    <input
                        type="text"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="3박5일"
                        className="analyzer-input"
                        style={{ width: '100%' }}
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>귀국일 (자동계산)</label>
                    <input
                        type="text"
                        value={returnDate}
                        onChange={(e) => setReturnDate(e.target.value)}
                        placeholder="자동 계산됨"
                        className="analyzer-input"
                        style={{ width: '100%', color: '#ffffff', fontWeight: 'bold' }}
                    />
                </div>
                <div className="form-group">
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>상담 상태</label>
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="analyzer-input"
                        style={{ width: '100%', appearance: 'none', cursor: 'pointer' }}
                    >
                        <option value="상담중">상담중</option>
                        <option value="예약확정">예약확정</option>
                        <option value="선금완료">선금완료</option>
                        <option value="잔금완료">잔금완료</option>
                        <option value="여행완료">여행완료</option>
                        <option value="취소/보류">취소/보류</option>
                        <option value="상담완료">상담완료</option>
                    </select>
                </div>
            </div>

            {/* Row 2-1: 예약확정 시 추가 정보 (확정상품, 예약확정일) */}
            {(['예약확정', '선금완료', '잔금완료', '여행완료'].includes(status)) && (
                <div className="analyzer-form-grid-2" style={{ marginTop: '16px' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>✨ 확정상품 URL (날짜 자동분석)</label>
                        <input
                            type="url"
                            value={confirmedProduct}
                            onChange={(e) => setConfirmedProduct(e.target.value)}
                            placeholder="확정된 상품의 URL을 입력하세요"
                            className="analyzer-input"
                            style={{ width: '100%', borderColor: 'var(--accent-primary)' }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>📅 예약확정일</label>
                        <input
                            type="date"
                            value={confirmedDate}
                            onChange={(e) => setConfirmedDate(e.target.value)}
                            className="analyzer-input"
                            style={{ width: '100%', borderColor: 'var(--accent-primary)' }}
                        />
                    </div>
                </div>
            )}

            {/* Row 3: 관심 상품명 */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>관심 상품명</label>
                <input
                    type="text"
                    value={interestedProduct}
                    onChange={(e) => setInterestedProduct(e.target.value)}
                    placeholder="상품명을 입력하거나 분석 시 자동 입력됩니다."
                    className="analyzer-input"
                    style={{ width: '100%' }}
                />
            </div>


            {/* Row 5: 상담 내용 요약 */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>상담 내용 요약</label>
                <textarea
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    placeholder="고객 요청사항, 특이사항 등"
                    className="analyzer-input"
                    style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                />
            </div>

            {isSaving && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontSize: '0.9rem', marginBottom: '8px' }}>
                    <div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                    분석 완료 시 시트에 자동 저장됩니다...
                </div>
            )}
            {saveSuccess && (
                <div style={{ color: '#10b981', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    ✅ 구글 시트 저장 완료!
                </div>
            )}
        </div>
    );


    return (
        <div className="url-analyzer">
            {/* 모드 선택 탭 */}
            <div className="analyzer-tabs">
                <button
                    className={`tab-button ${mode === 'single' ? 'active' : ''}`}
                    onClick={() => setMode('single')}
                >
                    🔍 단일 분석
                </button>
                <button
                    className={`tab-button ${mode === 'compare' ? 'active' : ''}`}
                    onClick={() => setMode('compare')}
                >
                    ⚖️ 비교 분석
                </button>
            </div>

            {/* 고객 정보 입력 폼 - 분석 전에 입력 가능하도록 상단에 배치 */}
            {renderCustomerForm()}

            {/* 단일 분석 모드 */}
            {mode === 'single' && (
                <div className="analyzer-input-section">
                    <h3 className="section-title">📦 여행 상품 URL 분석</h3>
                    <p className="section-desc">상품 URL을 입력하면 가격, 포함사항, 일정 등을 자동으로 추출하고 상담 멘트를 생성합니다.</p>
                    <div className="analyzer-input-wrapper" style={{ flexWrap: 'wrap' }}>
                        <input
                            type="url"
                            value={singleUrl}
                            onChange={(e) => setSingleUrl(e.target.value)}
                            placeholder="https://example.com/travel-product..."
                            className="analyzer-input"
                            disabled={loading}
                        />
                        <button
                            onClick={analyzeSingle}
                            disabled={loading || !singleUrl.trim()}
                            className="analyzer-button"
                        >
                            {loading ? (analysisStep ? analysisStep.split(':')[0] + '...' : '분석 중...') : '분석'}
                        </button>
                    </div>
                    {loading && analysisStep && (
                        <div style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="spinner-small" style={{ width: '14px', height: '14px' }}></div>
                            {analysisStep}
                        </div>
                    )}
                    {error && (
                        <div className="analyzer-error" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <div>⚠️ {error}</div>
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
                </div>
            )}

            {/* 비교 분석 모드 */}
            {mode === 'compare' && (
                <div className="analyzer-input-section">
                    <h3 className="section-title">⚖️ 상품 비교 분석</h3>
                    <p className="section-desc">여러 상품을 비교하여 가성비, 구성 등을 분석합니다. (최대 5개)</p>
                    <div className="multi-url-inputs">
                        {multiUrls.map((url, index) => (
                            <div key={index} className="multi-url-row">
                                <span className="url-number">{index + 1}</span>
                                <input
                                    type="url"
                                    value={url}
                                    onChange={(e) => updateMultiUrl(index, e.target.value)}
                                    placeholder={`상품 URL ${index + 1}...`}
                                    className="analyzer-input"
                                    disabled={loading}
                                />
                                {multiUrls.length > 2 && (
                                    <button
                                        className="remove-url-btn"
                                        onClick={() => removeUrlField(index)}
                                        disabled={loading}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="multi-url-actions">
                        {multiUrls.length < 5 && (
                            <button className="add-url-btn" onClick={addUrlField} disabled={loading}>
                                + URL 추가
                            </button>
                        )}
                        <button
                            onClick={analyzeMultiple}
                            disabled={loading || multiUrls.filter(u => u.trim()).length < 2}
                            className="analyzer-button"
                        >
                            {loading ? '분석 중...' : '비교 분석'}
                        </button>
                    </div>
                    {error && (
                        <div className="analyzer-error" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <div>⚠️ {error}</div>
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
                </div>
            )}

            {/* 단일 분석 결과 */}
            {singleResult && mode === 'single' && (
                <div className="analyzer-result">
                    <div className="result-card info-card">
                        <div className="result-header">
                            <h4>📄 상품 요약</h4>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => copyToClipboard(singleResult.formatted)} className="action-button">
                                    📋 복사
                                </button>
                                <button onClick={() => handleGreetingCopy(singleResult.formatted)} className="action-button" style={{ background: 'rgba(0, 212, 170, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0, 212, 170, 0.3)' }}>
                                    ✨ 멘트형 복사
                                </button>
                            </div>
                        </div>
                        <h3 className="product-title-text" style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '20px', color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                            {singleResult.raw.index || 1}. {singleResult.raw.title}
                        </h3>

                        <div className="product-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                                <span className="info-label" style={{ color: '#cbd5e1', fontSize: '0.9rem', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>📅 출발일</span>
                                <span className="info-value" style={{ color: '#ffffff', fontWeight: '600' }}>{singleResult.raw.departureDate || '날짜 미정'}</span>
                            </div>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                                <span className="info-label" style={{ color: '#cbd5e1', fontSize: '0.9rem', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>✈️ 출발공항</span>
                                <span className="info-value" style={{ color: '#ffffff', fontWeight: '600' }}>
                                    {singleResult.raw.departureAirport}
                                    {singleResult.raw.airline && <span style={{ fontSize: '0.9rem', color: '#cbd5e1', display: 'block', marginTop: '4px' }}>({singleResult.raw.airline})</span>}
                                </span>
                            </div>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                                <span className="info-label" style={{ color: '#cbd5e1', fontSize: '0.9rem', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>🌏 지역</span>
                                <span className="info-value" style={{ color: '#ffffff', fontWeight: '600' }}>{singleResult.raw.destination}</span>
                            </div>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                                <span className="info-label" style={{ color: '#cbd5e1', fontSize: '0.9rem', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>⏳ 기간</span>
                                <span className="info-value" style={{ color: '#ffffff', fontWeight: '600' }}>{singleResult.raw.duration || '기간 미정'}</span>
                            </div>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px', gridColumn: 'span 2' }}>
                                <span className="info-label" style={{ color: '#cbd5e1', fontSize: '0.9rem', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>💰 가격</span>
                                <span className="info-value price" style={{ color: '#38bdf8', fontWeight: '800', fontSize: '1.2rem' }}>
                                    {singleResult.raw.price ? (
                                        (() => {
                                            const p = String(singleResult.raw.price);
                                            const digits = p.replace(/[^0-9]/g, '');
                                            const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                                            return formatted + '원';
                                        })()
                                    ) : '가격 정보 없음'}
                                </span>
                            </div>
                        </div>

                        {(Array.isArray(singleResult.raw.keyPoints) && singleResult.raw.keyPoints.length > 0) && (
                            <div className="product-section" style={{ marginBottom: '16px', background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                                <h5 style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>💡 상품 포인트</h5>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {singleResult.raw.keyPoints.slice(0, 5).map((item: any, i: number) => (
                                        <li key={i} style={{ marginBottom: '8px', paddingLeft: '14px', borderLeft: '2px solid #38bdf8', color: '#cbd5e1', fontSize: '0.95rem' }}>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {(Array.isArray(singleResult.raw.features) && singleResult.raw.features.length > 0) && (
                            <div className="product-section" style={{ marginBottom: '16px' }}>
                                <h5 style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: '600', marginBottom: '8px' }}>✨ 특징</h5>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {singleResult.raw.features.map((item: any, i: number) => (
                                        <span key={i} style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '20px', fontSize: '0.9rem' }}>
                                            {item}
                                        </span>
                                    ))}
                                    {singleResult.raw.hasNoOption && (
                                        <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '20px', fontSize: '0.9rem' }}>
                                            노옵션
                                        </span>
                                    )}
                                    {singleResult.raw.hasFreeSchedule && (
                                        <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '20px', fontSize: '0.9rem' }}>
                                            자유일정포함
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 해시태그 섹션 제거 */}

                        <div style={{ marginTop: '20px' }}>
                            <a href={singleResult.raw.url} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'inline-block', background: '#334155', color: 'white', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: '500', transition: 'background 0.2s' }}>
                                🔗 원문 일정표 열기
                            </a>
                        </div>

                        {/* Customer Form 제거 (상단으로 이동) */}
                    </div>
                </div>
            )}

            {/* 비교 분석 결과 */}
            {compareResult && mode === 'compare' && (
                <div className="analyzer-result">
                    {/* 비교 요약 */}
                    <div className="result-card comparison-card">
                        <div className="result-header">
                            <h4>📊 비교 분석 결과</h4>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => copyToClipboard(compareResult.comparison)} className="action-button">
                                    📋 복사
                                </button>
                                <button onClick={() => handleGreetingCopy(compareResult.comparison)} className="action-button" style={{ background: 'rgba(0, 212, 170, 0.1)', color: 'var(--accent-primary)', border: '1px solid rgba(0, 212, 170, 0.3)' }}>
                                    ✨ 멘트형 복사
                                </button>
                            </div>
                        </div>
                        <div className="comparison-content">
                            {String(compareResult.comparison).split('\n').map((line, i) => {
                                if (line.startsWith('####')) {
                                    return <h5 key={i} style={{ color: '#38bdf8', marginTop: '20px', marginBottom: '10px' }}>{line.replace(/^#+\s*/, '')}</h5>;
                                }
                                if (line.startsWith('###')) {
                                    return <h4 key={i} style={{ color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '8px', marginTop: '24px' }}>{line.replace(/^#+\s*/, '')}</h4>;
                                }
                                if (line.startsWith('##')) {
                                    return <h3 key={i} style={{ color: '#f8fafc', marginTop: '16px' }}>{line.replace(/^#+\s*/, '')}</h3>;
                                }
                                if (line.startsWith('**') && line.endsWith('**')) {
                                    return <strong key={i} style={{ color: '#e2e8f0', display: 'block', margin: '10px 0' }}>{line.replace(/\*\*/g, '')}</strong>;
                                }
                                if (line.startsWith('|')) {
                                    return <div key={i} style={{ fontFamily: 'monospace', whiteSpace: 'pre', fontSize: '0.9rem', color: '#94a3b8', background: '#0f172a', padding: '2px 8px' }}>{line}</div>;
                                }
                                if (line.startsWith('•') || line.startsWith('-')) {
                                    return <p key={i} className="bullet" style={{ color: '#cbd5e1', marginLeft: '16px', marginBottom: '4px' }}>{line}</p>;
                                }
                                if (line.startsWith('---') || line.includes('----------')) {
                                    return <div key={i} style={{ borderBottom: '1px dashed #334155', margin: '20px 0', height: '1px' }} aria-hidden="true" />;
                                }
                                return <p key={i} style={{ color: '#cbd5e1', margin: '6px 0', minHeight: '1.2em', lineHeight: '1.6' }}>{line}</p>;
                            })}
                        </div>
                    </div>

                    {/* Customer Form 제거 (상단으로 이동) */}
                </div>
            )}
        </div>
    );
}

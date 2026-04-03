'use client';

import { useState, useEffect } from 'react';
import GoogleContactsPicker from './GoogleContactsPicker';
import CustomerSearchBox from './CustomerSearchBox';
import { ConsultationData } from '@/types';

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
        return dateStr;
    }

    const d = new Date(targetYear, targetMonth, targetDay);
    if (isNaN(d.getTime())) return dateStr;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

interface ConsultationForm {
    customerName: string;
    customerPhone: string;
    travelersCount: string;
    destination: string;
    productName: string;
    productUrl: string;
    departureDate: string;
    duration: string;
    returnDate: string;
    notes: string;
    source: string;
    status: string;
    confirmedProduct: string;
    confirmedDate: string;
    recurringCustomer: string;
    inquirySource: string;
}

export default function ManualConsultationForm() {
    const [form, setForm] = useState<ConsultationForm>({
        customerName: '',
        customerPhone: '',
        travelersCount: '',
        destination: '',
        productName: '',
        productUrl: '',
        departureDate: '',
        duration: '',
        returnDate: '',
        notes: '',
        source: '수동상담',
        status: '상담중',
        confirmedProduct: '',
        confirmedDate: '',
        recurringCustomer: '신규고객',
        inquirySource: '',
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    // 귀국일 자동 계산 로직 (UrlAnalyzer.tsx에서 복사)
    useEffect(() => {
        if (form.departureDate && form.duration) {
            try {
                const cleanDuration = form.duration.replace(/\[CONTENT\]|\[CONTENT BODY\]|====|METADATA|undefined|NULL/gi, '').trim();
                if (!cleanDuration) return;

                let cleanedDate = form.departureDate.replace(/[^0-9]/g, '');
                let targetYear: number;
                let targetMonth: number;
                let targetDay: number;

                const mdMatch = form.departureDate.match(/(\d+)\s*월\s*(\d+)\s*일/);
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
                    if (cleanedDate.length === 2) {
                        targetMonth = now.getMonth();
                        targetDay = parseInt(cleanedDate);
                    } else if (cleanedDate.length === 3 || cleanedDate.length === 4) {
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

                const daysMatch = cleanDuration.match(/(\d+)\s*일/) || cleanDuration.match(/(\d+)\s*D/i);
                let totalDays = 0;

                if (daysMatch) {
                    totalDays = parseInt(daysMatch[1]);
                } else {
                    const nightMatch = cleanDuration.match(/(\d+)\s*박/);
                    if (nightMatch) totalDays = parseInt(nightMatch[1]) + 1;
                    else {
                        const justNumMatch = cleanDuration.match(/^(\d+)$/);
                        if (justNumMatch) totalDays = parseInt(justNumMatch[1]);
                    }
                }

                if (totalDays > 0) {
                    date.setDate(date.getDate() + (totalDays - 1));
                    const rYear = date.getFullYear();
                    const rMonth = String(date.getMonth() + 1).padStart(2, '0');
                    const rDay = String(date.getDate()).padStart(2, '0');
                    setForm(prev => ({ ...prev, returnDate: `${rYear}-${rMonth}-${rDay}` }));
                }
            } catch (e) {
                console.error('Return date calculation error:', e);
            }
        }
    }, [form.departureDate, form.duration]);

    // 예약확정 상품 URL 입력 시 자동 분석 (Booking 모드)
    useEffect(() => {
        const analyzeConfirmedProduct = async () => {
            const url = form.confirmedProduct;
            if (url && url.startsWith('http') && url.length > 15) {
                // 주요 정보가 비어있거나 '미정'인 경우 자동 분석 시도
                if (!form.destination || form.destination === '미정' || !form.departureDate) {
                    try {
                        const res = await fetch('/api/analyze-url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url, mode: 'booking' })
                        });
                        const data = await res.json();
                        if (data.success && data.data) {
                            const p = data.data;
                            setForm(prev => ({
                                ...prev,
                                destination: (p.destination && (!prev.destination || prev.destination === '미정')) ? p.destination : prev.destination,
                                departureDate: p.departureDate ? formatToHtmlDate(p.departureDate) : prev.departureDate,
                                duration: (p.duration && (!prev.duration || prev.duration === '미정')) ? p.duration : prev.duration,
                                productName: (p.title && (!prev.productName || prev.productName === '미정')) ? p.title : prev.productName,
                                returnDate: p.returnDate ? formatToHtmlDate(p.returnDate) : prev.returnDate
                            }));
                        }
                    } catch (e) {
                        console.error('Booking analysis error:', e);
                    }
                }
            }
        };

        const timer = setTimeout(analyzeConfirmedProduct, 1000);
        return () => clearTimeout(timer);
    }, [form.confirmedProduct]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.customerName || !form.customerPhone) {
            setError('고객명과 연락처는 필수입니다.');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const response = await fetch('/api/save-consultation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    customerName: form.customerName,
                    customerPhone: form.customerPhone,
                    travelersCount: form.travelersCount === '' ? null : Number(form.travelersCount),
                    destination: form.destination,
                    departureDate: form.departureDate,
                    duration: form.duration,
                    returnDate: form.returnDate,
                    interestedProduct: form.productName,
                    productUrl: form.productUrl,
                    memo: form.notes,
                    status: form.status,
                    confirmedProduct: form.confirmedProduct,
                    confirmedDate: form.confirmedDate,
                    recurringCustomer: form.recurringCustomer,
                    inquirySource: form.inquirySource,
                    source: '수동상담',
                    isComparison: false,
                    analysisData: { raw: { url: form.productUrl, title: form.productName } }
                }),
            });

            const result = await response.json();

            if (result.success) {
                setSuccess(true);
                setForm({
                    customerName: '',
                    customerPhone: '',
                    travelersCount: '',
                    destination: '',
                    productName: '',
                    productUrl: '',
                    departureDate: '',
                    duration: '',
                    returnDate: '',
                    notes: '',
                    source: '수동상담',
                    status: '상담중',
                    confirmedProduct: '',
                    confirmedDate: '',
                    recurringCustomer: '신규고객',
                    inquirySource: '',
                });

                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError(result.error || '등록에 실패했습니다.');
            }
        } catch (err) {
            setError('등록 중 오류가 발생했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateForm = (field: keyof ConsultationForm, value: string) => {
        setForm({ ...form, [field]: value });
        setError('');
    };

    const handleSelectContact = (name: string, phone: string) => {
        setForm(prev => ({ ...prev, customerName: name, customerPhone: phone }));
    };

    const handleCustomerSelect = (c: ConsultationData) => {
        setForm(prev => ({
            ...prev,
            customerName: c.customer.name,
            customerPhone: c.customer.phone,
            destination: c.trip.destination || prev.destination,
            productName: c.trip.product_name || prev.productName,
            productUrl: c.trip.url || prev.productUrl,
            departureDate: c.trip.departure_date ? formatToHtmlDate(c.trip.departure_date) : prev.departureDate,
            duration: c.trip.duration || prev.duration,
            returnDate: c.trip.return_date ? formatToHtmlDate(c.trip.return_date) : prev.returnDate,
            travelersCount: c.trip.travelers_count ? String(c.trip.travelers_count) : prev.travelersCount,
            recurringCustomer: '재방문',
            inquirySource: c.automation.inquirySource || prev.inquirySource,
        }));
    };

    return (
        <div className="manual-consultation-form" style={{
            background: 'var(--bg-card)',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-lg)'
        }}>
            <div className="analyzer-header-mobile" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '1.2rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        📝 수동 상담 등록
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '6px 0 0 0' }}>전화, 방문 등 카카오톡 외 상담을 등록합니다.</p>
                </div>
                <div className="analyzer-header-buttons" style={{ display: 'flex', gap: '10px' }}>
                    <GoogleContactsPicker onSelectContact={handleSelectContact} />
                    <button
                        type="button"
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

            <form onSubmit={handleSubmit}>

                {/* Row 1: 고객명, 연락처, 총인원, 여행지, 재방문 여부, 유입 경로 */}
                <div className="analyzer-form-grid-3">
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>고객명 *</label>
                        <input
                            type="text"
                            value={form.customerName}
                            onChange={(e) => updateForm('customerName', e.target.value)}
                            placeholder="홍길동"
                            className="analyzer-input"
                            style={{ width: '100%' }}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>연락처 *</label>
                        <input
                            type="tel"
                            value={form.customerPhone}
                            onChange={(e) => updateForm('customerPhone', e.target.value)}
                            placeholder="01012345678"
                            className="analyzer-input"
                            style={{ width: '100%' }}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>총인원</label>
                        <input
                            type="number"
                            value={form.travelersCount}
                            onChange={(e) => updateForm('travelersCount', e.target.value)}
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
                            value={form.destination}
                            onChange={(e) => updateForm('destination', e.target.value)}
                            placeholder="오사카"
                            className="analyzer-input"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>재방문 여부</label>
                        <select
                            value={form.recurringCustomer}
                            onChange={(e) => updateForm('recurringCustomer', e.target.value)}
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
                            value={form.inquirySource}
                            onChange={(e) => updateForm('inquirySource', e.target.value)}
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
                            value={form.departureDate}
                            onChange={(e) => updateForm('departureDate', e.target.value)}
                            placeholder="20250209"
                            className="analyzer-input"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>기간</label>
                        <input
                            type="text"
                            value={form.duration}
                            onChange={(e) => updateForm('duration', e.target.value)}
                            placeholder="3박5일"
                            className="analyzer-input"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>귀국일 (자동계산)</label>
                        <input
                            type="text"
                            value={form.returnDate}
                            readOnly
                            placeholder="자동 계산됨"
                            className="analyzer-input"
                            style={{ width: '100%', color: '#ffffff', fontWeight: 'bold' }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>상담 상태</label>
                        <select
                            value={form.status}
                            onChange={(e) => updateForm('status', e.target.value)}
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

                {/* Row 2-1: 예약확정 시 추가 정보 */}
                {['예약확정', '선금완료', '잔금완료', '여행완료'].includes(form.status) && (
                    <div className="analyzer-form-grid-2" style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label style={{ display: 'block', color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>✨ 확정상품 URL (날짜 자동분석)</label>
                            <input
                                type="url"
                                value={form.confirmedProduct}
                                onChange={(e) => updateForm('confirmedProduct', e.target.value)}
                                placeholder="확정된 상품의 URL을 입력하세요"
                                className="analyzer-input"
                                style={{ width: '100%', borderColor: 'var(--accent-primary)' }}
                            />
                        </div>
                        <div className="form-group">
                            <label style={{ display: 'block', color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>📅 예약확정일</label>
                            <input
                                type="date"
                                value={form.confirmedDate}
                                onChange={(e) => updateForm('confirmedDate', e.target.value)}
                                className="analyzer-input"
                                style={{ width: '100%', borderColor: 'var(--accent-primary)' }}
                            />
                        </div>
                    </div>
                )}

                {/* Row 3: 상품명 및 상품 URL */}
                <div className="analyzer-form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>관심 상품명</label>
                        <input
                            type="text"
                            value={form.productName}
                            onChange={(e) => updateForm('productName', e.target.value)}
                            placeholder="상품명을 입력하세요"
                            className="analyzer-input"
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>상품 URL</label>
                        <input
                            type="url"
                            value={form.productUrl}
                            onChange={(e) => updateForm('productUrl', e.target.value)}
                            placeholder="https://..."
                            className="analyzer-input"
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>

                {/* Row 4: 상담 내용 요약 */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600', marginBottom: '8px' }}>상담 내용 요약</label>
                    <textarea
                        value={form.notes}
                        onChange={(e) => updateForm('notes', e.target.value)}
                        placeholder="고객 요청사항, 특이사항 등"
                        className="analyzer-input"
                        style={{ width: '100%', minHeight: '100px', resize: 'vertical' }}
                    />
                </div>

                {error && <div className="analyzer-error" style={{ marginBottom: '16px' }}>⚠️ {error}</div>}
                {success && <div style={{ color: '#10b981', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>✅ 구글 시트 저장 완료!</div>}

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="submit"
                        disabled={loading}
                        className="analyzer-button"
                        style={{ padding: '12px 32px' }}
                    >
                        {loading ? '등록 중...' : '상담 등록'}
                    </button>
                </div>
            </form>
        </div>
    );
}

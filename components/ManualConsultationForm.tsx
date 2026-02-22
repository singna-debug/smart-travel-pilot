'use client';

import { useState } from 'react';

interface ConsultationForm {
    customerName: string;
    customerPhone: string;
    destination: string;
    productName: string;
    productUrl: string;
    departureDate: string;
    notes: string;
    source: string;
}

export default function ManualConsultationForm() {
    const [form, setForm] = useState<ConsultationForm>({
        customerName: '',
        customerPhone: '',
        destination: '',
        productName: '',
        productUrl: '',
        departureDate: '',
        notes: '',
        source: '전화',
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

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
                    destination: form.destination,
                    departureDate: form.departureDate,
                    interestedProduct: form.productName,
                    productUrl: form.productUrl, // Backend might need adjustment to handle this directly
                    memo: form.notes,
                    status: '상담중',
                    isComparison: false,
                    analysisData: { raw: { url: form.productUrl, title: form.productName } } // Dummy for compatibility
                }),
            });

            const result = await response.json();

            if (result.success) {
                setSuccess(true);
                // 폼 초기화
                setForm({
                    customerName: '',
                    customerPhone: '',
                    destination: '',
                    productName: '',
                    productUrl: '',
                    departureDate: '',
                    notes: '',
                    source: '전화',
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

    return (
        <div className="manual-consultation-form">
            <h3 className="section-title">📝 수동 상담 등록</h3>
            <p className="section-desc">전화, 방문 등 카카오톡 외 상담을 등록합니다.</p>

            <form onSubmit={handleSubmit}>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label">상담 채널 *</label>
                        <select
                            value={form.source}
                            onChange={(e) => updateForm('source', e.target.value)}
                            className="form-select"
                        >
                            <option value="전화">📞 전화</option>
                            <option value="방문">🏢 방문</option>
                            <option value="이메일">📧 이메일</option>
                            <option value="문자">💬 문자</option>
                            <option value="기타">📌 기타</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">고객명 *</label>
                        <input
                            type="text"
                            value={form.customerName}
                            onChange={(e) => updateForm('customerName', e.target.value)}
                            placeholder="홍길동"
                            className="form-input"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">연락처 *</label>
                        <input
                            type="tel"
                            value={form.customerPhone}
                            onChange={(e) => updateForm('customerPhone', e.target.value)}
                            placeholder="010-1234-5678"
                            className="form-input"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">목적지</label>
                        <input
                            type="text"
                            value={form.destination}
                            onChange={(e) => updateForm('destination', e.target.value)}
                            placeholder="오사카"
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">출발일</label>
                        <input
                            type="date"
                            value={form.departureDate}
                            onChange={(e) => updateForm('departureDate', e.target.value)}
                            className="form-input"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">상품명</label>
                        <input
                            type="text"
                            value={form.productName}
                            onChange={(e) => updateForm('productName', e.target.value)}
                            placeholder="오사카 3박4일 패키지"
                            className="form-input"
                        />
                    </div>

                    <div className="form-group full-width">
                        <label className="form-label">상품 URL</label>
                        <input
                            type="url"
                            value={form.productUrl}
                            onChange={(e) => updateForm('productUrl', e.target.value)}
                            placeholder="https://..."
                            className="form-input"
                        />
                    </div>

                    <div className="form-group full-width">
                        <label className="form-label">상담 메모</label>
                        <textarea
                            value={form.notes}
                            onChange={(e) => updateForm('notes', e.target.value)}
                            placeholder="상담 내용을 메모하세요..."
                            className="form-textarea"
                            rows={4}
                        />
                    </div>
                </div>

                {error && <div className="form-error">{error}</div>}
                {success && <div className="form-success">✅ 상담이 등록되었습니다!</div>}

                <div className="form-actions">
                    <button
                        type="submit"
                        disabled={loading}
                        className="submit-button"
                    >
                        {loading ? '등록 중...' : '상담 등록'}
                    </button>
                </div>
            </form>
        </div>
    );
}

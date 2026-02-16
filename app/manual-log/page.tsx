'use client';

import { useState } from 'react';

export default function ManualLogPage() {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        destination: '',
        departureDate: '',
        duration: '',
        returnDate: '',
        productName: '',
        status: '상담중',
        summary: ''
    });

    const [productUrls, setProductUrls] = useState<string[]>(['']); // 여러 URL 관리
    const [isSaving, setIsSaving] = useState(false);

    // 유틸리티: 날짜 포맷팅 (YYYYMMDD -> YYYY-MM-DD)
    const formatDateInput = (val: string) => {
        const num = val.replace(/[^0-9]/g, '');
        if (num.length === 8) {
            return `${num.slice(0, 4)}-${num.slice(4, 6)}-${num.slice(6, 8)}`;
        }
        return val;
    };

    // 유틸리티: 전화번호 포맷팅 (01012345678 -> 010-1234-5678)
    const formatPhoneNumber = (val: string) => {
        const num = val.replace(/[^0-9]/g, '');
        if (num.length < 4) return num;
        if (num.length < 7) return `${num.slice(0, 3)}-${num.slice(3)}`;
        if (num.length < 11) return `${num.slice(0, 3)}-${num.slice(3, 6)}-${num.slice(6)}`;
        return `${num.slice(0, 3)}-${num.slice(3, 7)}-${num.slice(7, 11)}`;
    };

    // 날짜 자동 계산
    const calculateDates = (dep: string, dur: string) => {
        if (!dep || !dur) return '';
        try {
            let dateStr = dep;
            if (dep.match(/^\d{8}$/)) {
                dateStr = `${dep.slice(0, 4)}-${dep.slice(4, 6)}-${dep.slice(6, 8)}`;
            }
            const dateMatch = dateStr.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
            if (!dateMatch) return '';
            const daysMatch = dur.match(/(\d+)일/);
            if (!daysMatch) return '';
            const start = new Date(dateStr);
            const days = parseInt(daysMatch[1]);
            const end = new Date(start);
            end.setDate(start.getDate() + (days - 1));
            return end.toISOString().split('T')[0];
        } catch {
            return '';
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        let { name, value } = e.target;

        if (name === 'phone') {
            value = formatPhoneNumber(value);
        }
        if (name === 'departureDate') {
            if (value.length === 8 && /^\d{8}$/.test(value)) {
                value = formatDateInput(value);
            }
        }

        const newFormData = { ...formData, [name]: value };

        if (name === 'departureDate' || name === 'duration') {
            const ret = calculateDates(newFormData.departureDate, newFormData.duration);
            if (ret) newFormData.returnDate = ret;
        }

        setFormData(newFormData);
    };

    // URL 관련 핸들러
    const handleUrlChange = (index: number, value: string) => {
        const newUrls = [...productUrls];
        newUrls[index] = value;
        setProductUrls(newUrls);
    };

    const addUrlField = () => {
        setProductUrls([...productUrls, '']);
    };

    const removeUrlField = (index: number) => {
        if (productUrls.length > 1) {
            const newUrls = productUrls.filter((_, i) => i !== index);
            setProductUrls(newUrls);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // URL들을 줄바꿈으로 연결
            const combinedUrls = productUrls.filter(url => url.trim()).join('\n');

            const res = await fetch('/api/manual-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    productUrl: combinedUrls
                }),
            });
            const result = await res.json();

            if (result.success) {
                alert('✅ 상담 내역이 저장되었습니다! (DB + 구글시트)');
                setFormData({
                    name: '', phone: '', destination: '', departureDate: '', duration: '', returnDate: '', productName: '', status: '상담중', summary: ''
                });
                setProductUrls(['']);
            } else {
                alert('❌ 저장 실패: ' + result.error);
            }
        } catch (error) {
            console.error(error);
            alert('❌ 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="manual-log-page">
            <h1 className="page-title">📝 수동 상담 등록</h1>
            <p className="page-subtitle">전화/방문 상담 내역을 시트에 기록합니다.</p>

            <form onSubmit={handleSubmit} className="log-form">
                <div className="form-row">
                    <div className="form-group">
                        <label>고객명 *</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="홍길동" />
                    </div>
                    <div className="form-group">
                        <label>연락처</label>
                        <input type="text" name="phone" value={formData.phone} onChange={handleChange} placeholder="01012345678" />
                    </div>
                    <div className="form-group">
                        <label>여행지</label>
                        <input type="text" name="destination" value={formData.destination} onChange={handleChange} placeholder="오사카" />
                    </div>
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>출발일</label>
                        <input type="text" name="departureDate" value={formData.departureDate} onChange={handleChange} placeholder="20250209" />
                    </div>
                    <div className="form-group">
                        <label>기간</label>
                        <input type="text" name="duration" value={formData.duration} onChange={handleChange} placeholder="3박5일" />
                    </div>
                    <div className="form-group">
                        <label>귀국일 (자동)</label>
                        <input type="text" name="returnDate" value={formData.returnDate} readOnly className="readonly-input" />
                    </div>
                    <div className="form-group">
                        <label>상담 상태</label>
                        <select name="status" value={formData.status} onChange={handleChange}>
                            <option value="상담중">상담중</option>
                            <option value="견적제공">견적제공</option>
                            <option value="예약확정">예약확정</option>
                            <option value="결제완료">결제완료</option>
                            <option value="취소/보류">취소/보류</option>
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label>관심 상품명</label>
                    <input type="text" name="productName" value={formData.productName} onChange={handleChange} placeholder="오사카 자유여행 3박5일 패키지" />
                </div>

                <div className="form-group">
                    <label>상품 URL</label>
                    {productUrls.map((url, index) => (
                        <div key={index} className="url-row">
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => handleUrlChange(index, e.target.value)}
                                placeholder="https://mode-tour.co.kr/..."
                            />
                            {productUrls.length > 1 && (
                                <button type="button" className="url-remove-btn" onClick={() => removeUrlField(index)}>✕</button>
                            )}
                            {index === productUrls.length - 1 && (
                                <button type="button" className="url-add-btn" onClick={addUrlField}>+</button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="form-group">
                    <label>상담 내용 요약</label>
                    <textarea name="summary" value={formData.summary} onChange={handleChange} rows={3} placeholder="고객 요청사항, 특이사항 등" />
                </div>

                <button type="submit" className="submit-btn" disabled={isSaving}>
                    {isSaving ? '저장 중...' : '💾 저장하기'}
                </button>
            </form>

            <style jsx>{`
                .manual-log-page { padding: 32px; max-width: 1200px; margin: 0 auto; }
                .page-title { margin-bottom: 8px; }
                .page-subtitle { color: var(--text-secondary); margin-bottom: 24px; }
                
                .log-form { 
                    background: var(--bg-card); 
                    padding: 28px; 
                    border-radius: 16px; 
                    border: 1px solid var(--border-color); 
                    display: flex; 
                    flex-direction: column; 
                    gap: 20px; 
                }
                .form-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
                .form-group label { font-size: 13px; color: var(--text-secondary); font-weight: 500; }
                .form-row { display: flex; gap: 16px; }
                
                input, select, textarea { 
                    background: var(--bg-tertiary); 
                    border: 1px solid var(--border-color); 
                    padding: 12px; 
                    border-radius: 8px; 
                    color: var(--text-primary); 
                    font-size: 14px;
                    width: 100%;
                }
                input::placeholder, textarea::placeholder { color: var(--text-muted); }
                .readonly-input { background: var(--bg-secondary); color: var(--text-secondary); cursor: not-allowed; }
                
                .url-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
                .url-row input { flex: 1; }
                .url-add-btn, .url-remove-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .url-add-btn { background: var(--accent-primary); color: white; }
                .url-remove-btn { background: #ef4444; color: white; }
                
                .submit-btn { 
                    background: var(--accent-primary); 
                    color: white; 
                    border: none; 
                    padding: 16px; 
                    border-radius: 8px; 
                    font-weight: bold; 
                    cursor: pointer;
                    font-size: 16px;
                    margin-top: 8px;
                }
                .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>
        </div>
    );
}

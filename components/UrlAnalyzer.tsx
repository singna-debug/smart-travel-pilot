'use client';

import { useState } from 'react';

interface ProductInfo {
    title: string;
    price: string;
    inclusions: string[];
    exclusions: string[];
    itinerary: string[];
    features?: string[];
    specialOffers?: string[];
    courses?: string[];
    keyPoints?: string[];
    destination?: string;
    departureDate?: string;
    departureAirport?: string;
    airline?: string;
    duration?: string;
    hashtags?: string;
    url?: string;
    hasNoOption?: boolean;
    hasFreeSchedule?: boolean;
    index?: number;
}

interface AnalysisResult {
    url: string;
    index: number;
    raw: ProductInfo;
    formatted: string;
}

interface SingleResult {
    raw: ProductInfo;
    formatted: string;
    recommendation: string;
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

    const analyzeSingle = async () => {
        if (!singleUrl.trim()) {
            setError('URL을 입력해주세요.');
            return;
        }

        setLoading(true);
        setError('');
        setSingleResult(null);

        try {
            const response = await fetch('/api/analyze-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: singleUrl }),
            });

            const data = await response.json();

            if (data.success) {
                setSingleResult(data.data);
            } else {
                setError(data.error || '분석에 실패했습니다.');
            }
        } catch (err) {
            setError('분석 중 오류가 발생했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
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
        setCompareResult(null);

        try {
            const response = await fetch('/api/analyze-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: validUrls }),
            });

            const data = await response.json();

            if (data.success) {
                setCompareResult(data.data);
            } else {
                setError(data.error || '비교 분석에 실패했습니다.');
            }
        } catch (err) {
            setError('분석 중 오류가 발생했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
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
        alert('클립보드에 복사되었습니다!');
    };

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

            {/* 단일 분석 모드 */}
            {mode === 'single' && (
                <div className="analyzer-input-section">
                    <h3 className="section-title">📦 여행 상품 URL 분석</h3>
                    <p className="section-desc">상품 URL을 입력하면 가격, 포함사항, 일정 등을 자동으로 추출하고 상담 멘트를 생성합니다.</p>
                    <div className="analyzer-input-wrapper">
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
                            {loading ? '분석 중...' : '분석'}
                        </button>
                    </div>
                    {error && <div className="analyzer-error">{error}</div>}
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
                    {error && <div className="analyzer-error">{error}</div>}
                </div>
            )}

            {/* 단일 분석 결과 */}
            {singleResult && mode === 'single' && (
                <div className="analyzer-result">
                    <div className="result-card info-card">
                        <div className="result-header">
                            <h4>📄 상품 요약</h4>
                            <button onClick={() => copyToClipboard(singleResult.formatted)} className="action-button">
                                📋 복사
                            </button>
                        </div>
                        <h3 className="product-title-text" style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '16px', color: '#e2e8f0' }}>
                            {singleResult.raw.index || 1}. {singleResult.raw.title}
                        </h3>

                        <div className="product-info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                                <span className="info-label" style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>💰 가격</span>
                                <span className="info-value price" style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                    {singleResult.raw.price ? (singleResult.raw.price.endsWith('원') ? singleResult.raw.price : `${singleResult.raw.price}원`) : '가격 정보 없음'}
                                </span>
                            </div>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                                <span className="info-label" style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>🌏 지역</span>
                                <span className="info-value" style={{ color: '#f8fafc', fontWeight: '500' }}>{singleResult.raw.destination}</span>
                            </div>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                                <span className="info-label" style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>✈️ 출발공항</span>
                                <span className="info-value" style={{ color: '#f8fafc', fontWeight: '500' }}>
                                    {singleResult.raw.departureAirport}
                                    {singleResult.raw.airline && <span style={{ fontSize: '0.9rem', color: '#cbd5e1', display: 'block', marginTop: '4px' }}>({singleResult.raw.airline})</span>}
                                </span>
                            </div>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                                <span className="info-label" style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>📅 출발일</span>
                                <span className="info-value" style={{ color: '#f8fafc', fontWeight: '500' }}>{singleResult.raw.departureDate || '날짜 미정'}</span>
                            </div>
                            <div className="info-item" style={{ background: '#1e293b', padding: '12px', borderRadius: '8px' }}>
                                <span className="info-label" style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>⏳ 기간</span>
                                <span className="info-value" style={{ color: '#f8fafc', fontWeight: '500' }}>{singleResult.raw.duration || '기간 미정'}</span>
                            </div>
                        </div>

                        {(singleResult.raw.keyPoints && singleResult.raw.keyPoints.length > 0) && (
                            <div className="product-section" style={{ marginBottom: '16px', background: '#1e293b', padding: '16px', borderRadius: '12px' }}>
                                <h5 style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: '600', marginBottom: '12px' }}>💡 상품 포인트</h5>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                    {singleResult.raw.keyPoints.slice(0, 5).map((item, i) => (
                                        <li key={i} style={{ marginBottom: '8px', paddingLeft: '14px', borderLeft: '2px solid #38bdf8', color: '#cbd5e1', fontSize: '0.95rem' }}>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {(singleResult.raw.features && singleResult.raw.features.length > 0) && (
                            <div className="product-section" style={{ marginBottom: '16px' }}>
                                <h5 style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: '600', marginBottom: '8px' }}>✨ 특징</h5>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {singleResult.raw.features.map((item, i) => (
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
                            <button onClick={() => copyToClipboard(compareResult.comparison)} className="action-button">
                                📋 복사
                            </button>
                        </div>
                        <div className="comparison-content">
                            {compareResult.comparison.split('\n').map((line, i) => {
                                if (line.startsWith('##')) {
                                    return <h3 key={i}>{line.replace(/^#+\s*/, '')}</h3>;
                                }
                                if (line.startsWith('###')) {
                                    return <h4 key={i}>{line.replace(/^#+\s*/, '')}</h4>;
                                }
                                if (line.startsWith('**') && line.endsWith('**')) {
                                    return <strong key={i}>{line.replace(/\*\*/g, '')}</strong>;
                                }
                                if (line.startsWith('•') || line.startsWith('-')) {
                                    return <p key={i} className="bullet">{line}</p>;
                                }
                                return <p key={i}>{line}</p>;
                            })}
                        </div>
                    </div>

                    {/* 개별 상품 정보 */}
                    <div className="products-grid">
                        {compareResult.products.map((product) => (
                            <div key={product.index} className="result-card product-card">
                                <span className="product-number">{product.index}번</span>
                                <h5 className="product-title-small">{product.raw.title.substring(0, 40)}...</h5>
                                <div className="product-price">{product.raw.price}</div>
                                <div className="product-destination">{product.raw.destination || '목적지 미상'}</div>
                                {product.raw.inclusions.length > 0 && (
                                    <div className="product-inclusions">
                                        포함: {product.raw.inclusions.slice(0, 2).join(', ')}
                                        {product.raw.inclusions.length > 2 && ` 외 ${product.raw.inclusions.length - 2}개`}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// Supabase 클라이언트 초기화
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Product {
    id: string;
    title: string;
    description: string;
    price: string;
    url: string;
    keywords: string[];
    created_at: string;
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'manual' | 'url' | 'excel'>('url'); // 기본 URL 탭

    // 입력 폼 상태
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price: '',
        url: '',
        keywords: '',
    });

    const [crawlUrl, setCrawlUrl] = useState('');
    const [isCrawling, setIsCrawling] = useState(false);
    const [crawlResult, setCrawlResult] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching products:', error);
        } else {
            setProducts(data || []);
        }
        setLoading(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        saveProduct(formData);
    };

    const saveProduct = async (data: typeof formData) => {
        if (!data.title || !data.description) {
            alert('상품명과 내용은 필수입니다.');
            return;
        }

        const keywordsArray = data.keywords.split(',').map(k => k.trim()).filter(k => k);

        const { error } = await supabase
            .from('products')
            .insert({
                title: data.title,
                description: data.description,
                price: data.price,
                url: data.url,
                keywords: keywordsArray,
            });

        if (error) {
            console.error('Error adding product:', error);
            alert('상품 추가에 실패했습니다.');
        } else {
            alert('상품이 추가되었습니다! AI가 이제 이 상품을 알게 됩니다. 🧠');
            setFormData({ title: '', description: '', price: '', url: '', keywords: '' });
            fetchProducts();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting product:', error);
            alert('삭제 실패');
        } else {
            fetchProducts();
        }
    };

    const handleCrawl = async () => {
        if (!crawlUrl) return;
        setIsCrawling(true);
        setCrawlResult(null);
        try {
            const res = await fetch('/api/crawl', {
                method: 'POST',
                body: JSON.stringify({ url: crawlUrl }),
            });
            const data = await res.json();
            if (data.error) {
                setCrawlResult('❌ 정보를 가져오지 못했습니다: ' + data.error);
            } else {
                // 분석 결과 표시
                const resultText = `✅ 분석 완료!

📌 상품명: ${data.title || '없음'}
💰 가격: ${data.price || '없음'}
📝 설명: ${data.description?.substring(0, 200) || '없음'}...
🔗 URL: ${crawlUrl}`;
                setCrawlResult(resultText);

                // 폼 데이터에도 저장
                setFormData({
                    title: data.title || '',
                    description: data.description || '',
                    price: data.price || '',
                    url: crawlUrl,
                    keywords: '',
                });
            }
        } catch (e) {
            console.error(e);
            setCrawlResult('❌ 크롤링 중 오류가 발생했습니다.');
        } finally {
            setIsCrawling(false);
        }
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws) as any[];

            let successCount = 0;
            data.forEach(async (row) => {
                const productData = {
                    title: row['상품명'] || row['Title'] || '',
                    description: row['내용'] || row['Description'] || '',
                    price: row['가격'] || row['Price'] || '',
                    url: row['URL'] || row['Link'] || '',
                    keywords: row['키워드'] || row['Keywords'] || '',
                };
                if (productData.title) {
                    await saveProduct(productData);
                    successCount++;
                }
            });
            alert(`${data.length}개 중 ${successCount}개(추정) 업로드 작업이 시작되었습니다. 잠시 후 새로고침하세요.`);
            setTimeout(fetchProducts, 2000);
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="products-page">
            <header className="page-header">
                <div>
                    <h1 className="page-title">🔗 URL 분석</h1>
                    <p className="page-subtitle">여행 상품 URL을 분석하여 정보를 추출합니다.</p>
                </div>
            </header>

            {/* URL 분석 섹션 */}
            <div className="analysis-section">
                <div className="url-input-row">
                    <input
                        type="text"
                        value={crawlUrl}
                        onChange={(e) => setCrawlUrl(e.target.value)}
                        placeholder="분석할 상품 URL을 입력하세요 (예: mode-tour.co.kr/...)"
                        className="url-input"
                    />
                    <button onClick={handleCrawl} disabled={isCrawling} className="analyze-btn">
                        {isCrawling ? '분석 중...' : '🔍 분석하기'}
                    </button>
                </div>

                {crawlResult && (
                    <div className="crawl-result">
                        <pre>{crawlResult}</pre>
                        {formData.title && (
                            <button onClick={handleSubmit} className="save-btn">
                                💾 이 상품을 AI에게 학습시키기
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* 추가 탭 (직접입력/엑셀) */}
            <div className="extra-section">
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'manual' ? 'active' : ''}`}
                        onClick={() => setActiveTab('manual')}
                    >
                        ✍️ 직접 입력
                    </button>
                    <button
                        className={`tab ${activeTab === 'excel' ? 'active' : ''}`}
                        onClick={() => setActiveTab('excel')}
                    >
                        📊 엑셀 업로드
                    </button>
                </div>

                <div className="tab-content">
                    {activeTab === 'manual' && (
                        <form onSubmit={handleSubmit} className="product-form">
                            <div className="form-group">
                                <label>상품명</label>
                                <input type="text" name="title" value={formData.title} onChange={handleInputChange} placeholder="상품명 입력" />
                            </div>
                            <div className="form-group">
                                <label>상세 내용</label>
                                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={4} placeholder="상품 설명" />
                            </div>
                            <div className="form-row">
                                <input type="text" name="price" value={formData.price} onChange={handleInputChange} placeholder="가격 (예: 100만원)" />
                                <input type="text" name="keywords" value={formData.keywords} onChange={handleInputChange} placeholder="키워드 (쉼표 구분)" />
                            </div>
                            <input type="text" name="url" value={formData.url} onChange={handleInputChange} placeholder="참고 URL" className="full-width" />
                            <button type="submit" className="submit-btn">등록하기</button>
                        </form>
                    )}

                    {activeTab === 'excel' && (
                        <div className="excel-upload">
                            <p>엑셀 파일(.xlsx)을 업로드하여 여러 상품을 한 번에 등록합니다.</p>
                            <p className="small">칼럼 헤더: 상품명, 내용, 가격, URL, 키워드</p>
                            <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} ref={fileInputRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* 등록된 상품 목록 */}
            <div className="product-list-section">
                <h3>등록된 상품 ({products.length})</h3>
                {loading ? <div className="loading">로딩 중...</div> : (
                    <div className="product-grid">
                        {products.map(product => (
                            <div key={product.id} className="product-card">
                                <h4>{product.title}</h4>
                                <p className="price">{product.price}</p>
                                <p className="desc">{product.description.substring(0, 100)}...</p>
                                <div className="card-actions">
                                    <a href={product.url} target="_blank" rel="noreferrer">🔗 링크</a>
                                    <button onClick={() => handleDelete(product.id)} className="delete-btn">삭제</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
                .products-page { padding: 32px; max-width: 1200px; margin: 0 auto; }
                
                .analysis-section { 
                    background: var(--bg-card); 
                    border-radius: 16px; 
                    padding: 24px; 
                    margin-bottom: 24px; 
                    border: 1px solid var(--border-color); 
                }
                .url-input-row { display: flex; gap: 12px; }
                .url-input { flex: 1; background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 14px; border-radius: 8px; color: var(--text-primary); font-size: 14px; }
                .analyze-btn { background: var(--accent-primary); color: white; border: none; padding: 14px 24px; border-radius: 8px; cursor: pointer; font-weight: bold; white-space: nowrap; }
                .analyze-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                
                .crawl-result { 
                    margin-top: 16px; 
                    background: var(--bg-tertiary); 
                    padding: 16px; 
                    border-radius: 8px; 
                    white-space: pre-wrap; 
                    font-family: monospace; 
                    font-size: 13px; 
                }
                .save-btn { margin-top: 12px; background: var(--accent-secondary); color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
                
                .extra-section { 
                    background: var(--bg-card); 
                    border-radius: 16px; 
                    padding: 24px; 
                    margin-bottom: 32px; 
                    border: 1px solid var(--border-color); 
                }
                .tabs { display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
                .tab { background: none; border: none; color: var(--text-secondary); padding: 8px 16px; cursor: pointer; font-size: 14px; font-weight: 600; }
                .tab.active { color: var(--accent-primary); border-bottom: 2px solid var(--accent-primary); }
                
                .product-form { display: flex; flex-direction: column; gap: 12px; }
                input, textarea { background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 12px; border-radius: 8px; color: var(--text-primary); }
                .form-row { display: flex; gap: 10px; } .form-row input { flex: 1; }
                .full-width { width: 100%; }
                .submit-btn { background: var(--accent-primary); color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold; }
                
                .excel-upload { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
                .small { font-size: 12px; color: var(--text-muted); }

                .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
                .product-card { background: var(--bg-card); padding: 20px; border-radius: 12px; border: 1px solid var(--border-color); }
                .product-card h4 { margin-bottom: 8px; font-size: 16px; }
                .price { color: var(--accent-primary); font-weight: bold; margin-bottom: 8px; }
                .desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; height: 40px; overflow: hidden; }
                .card-actions { display: flex; justify-content: space-between; font-size: 13px; }
                .delete-btn { color: #ef4444; background: none; border: none; cursor: pointer; }
            `}</style>
        </div>
    );
}

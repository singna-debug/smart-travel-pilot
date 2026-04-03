import UrlAnalyzer from '@/components/UrlAnalyzer';

export default function ToolsPage() {
    return (
        <div>
            <header className="page-header">
                <h1 className="page-title">🔗 URL 분석</h1>
                <p className="page-subtitle">여행 상품 URL을 분석하여 정보를 추출합니다</p>
            </header>

            <div className="tools-grid">
                <UrlAnalyzer />
            </div>
        </div>
    );
}

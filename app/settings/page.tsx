import SettingsPanel from '@/components/SettingsPanel';

export default function SettingsPage() {
    return (
        <div>
            <header className="page-header">
                <h1 className="page-title">⚙️ 설정</h1>
                <p className="page-subtitle">회사 정보, API 연동 및 시스템 설정을 관리합니다</p>
            </header>
            <SettingsPanel />
        </div>
    );
}

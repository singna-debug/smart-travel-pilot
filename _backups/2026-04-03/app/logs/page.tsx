import ActivityLog from '@/components/ActivityLog';

export default function LogsPage() {
    return (
        <div>
            <header className="page-header">
                <h1 className="page-title">📋 활동 로그</h1>
                <p className="page-subtitle">모든 상담 활동 내역을 확인하세요</p>
            </header>

            <ActivityLog limit={100} showHeader={false} />
        </div>
    );
}

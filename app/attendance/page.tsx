import AttendancePanel from '@/components/AttendancePanel';

export default function AttendancePage() {
    return (
        <div>
            <header className="page-header">
                <h1 className="page-title">⏰ 근태관리</h1>
                <p className="page-subtitle">출퇴근 기록, 휴가 신청 및 근태 현황을 관리합니다</p>
            </header>
            <AttendancePanel />
        </div>
    );
}


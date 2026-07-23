'use client';

import React, { useEffect, useState } from 'react';
import DashboardCalendar from '@/components/DashboardCalendar';

export default function CalendarPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCalendarData = async () => {
            try {
                const response = await fetch('/api/stats');
                const result = await response.json();
                if (result.success) {
                    setData(result.data);
                }
            } catch (error) {
                console.error('캘린더 데이터 조회 오류:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCalendarData();
    }, []);

    return (
        <div>
            <header className="page-header">
                <h1 className="page-title">📅 업무 캘린더</h1>
                <p className="page-subtitle">구글 시트 실시간 상담 스케줄, 고객 출발일, 직원 근태를 한눈에 확인하세요</p>
            </header>
            <DashboardCalendar lists={data?.lists} isLoading={loading} />
        </div>
    );
}

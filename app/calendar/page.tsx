'use client';

import React, { useEffect, useState } from 'react';
import DashboardCalendar from '@/components/DashboardCalendar';

export default function CalendarPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCalendarData = async () => {
            try {
                let tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;
                if (!tenantId) {
                    try {
                        const { createClient } = await import('@/utils/supabase/client');
                        const supabase = createClient();
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            tenantId = user.email === 'gktla71@gmail.com' ? 'default_tenant' : user.id;
                            localStorage.setItem('tenant_id', tenantId);
                        }
                    } catch (e) {}
                }

                const response = await fetch('/api/stats', {
                    headers: tenantId ? { 'x-tenant-id': tenantId } : {}
                });
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

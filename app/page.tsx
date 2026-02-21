'use client';

import { useEffect, useState } from 'react';
import StatsCard from '@/components/StatsCard';
import ConsultationList from '@/components/ConsultationList';
import { ConsultationData } from '@/types';

interface DashboardResponse {
  summary: {
    newInquiriesCount: number;
    confirmedCount: number;
    completedCount: number;
    reminderCount: number;
  };
  schedule: {
    balanceDueCount: number;
    travelNoticeCount: number;
    postTripCount: number;
  };
  lists: {
    recentInquiries: ConsultationData[];
    confirmedInquiries: ConsultationData[];
    completedInquiries: ConsultationData[];
    needReminders: ConsultationData[];
    balanceDueTargets: ConsultationData[];
    travelNoticeTargets: ConsultationData[];
    postTripTargets: ConsultationData[];
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('recentInquiries'); // Default view
  const [activeTitle, setActiveTitle] = useState('최근 신규 문의');

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/stats');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('대시보드 데이터 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (filterKey: string, title: string) => {
    setActiveFilter(filterKey);
    setActiveTitle(title);
  };

  if (loading) {
    return <div className="loading-spinner">대시보드 데이터를 불러오는 중...</div>;
  }

  const currentList = data ? data.lists[activeFilter as keyof typeof data.lists] : [];

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">📊 여행 상담 대시보드</h1>
        <p className="page-subtitle">실시간 상담 현황과 챙겨야 할 스케줄을 한눈에 확인하세요.</p>
      </header>

      {/* 1. 현황 요약 (최근 7일) */}
      <section className="dashboard-section">
        <div className="section-label">
          📅 요약 (최근 7일)
        </div>
        <div className="stats-grid">
          <div onClick={() => handleCardClick('recentInquiries', '최근 신규 문의')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.summary.newInquiriesCount || 0} label="신규 문의" isActive={activeFilter === 'recentInquiries'} />
          </div>
          <div onClick={() => handleCardClick('confirmedInquiries', '예약 확정')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.summary.confirmedCount || 0} label="예약 확정" isActive={activeFilter === 'confirmedInquiries'} />
          </div>
          <div onClick={() => handleCardClick('completedInquiries', '결제 완료')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.summary.completedCount || 0} label="결제 완료" isActive={activeFilter === 'completedInquiries'} />
          </div>
        </div>
      </section>

      {/* 2. 스케줄링 */}
      <section className="dashboard-section" style={{ marginTop: '32px' }}>
        <div className="section-label">🗓️ 챙겨야할 스케줄</div>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div onClick={() => handleCardClick('needReminders', '리마인드 필요')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.summary.reminderCount || 0} label="리마인드 필요" isActive={activeFilter === 'needReminders'} isUrgent={true} />
          </div>
          <div onClick={() => handleCardClick('balanceDueTargets', '전체 예약 확정 현황')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.balanceDueCount || 0} label="예약 확정 (전체)" isActive={activeFilter === 'balanceDueTargets'} />
          </div>
          <div onClick={() => handleCardClick('travelNoticeTargets', '전체 결제 완료 현황')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.travelNoticeCount || 0} label="결제 완료 (전체)" isActive={activeFilter === 'travelNoticeTargets'} />
          </div>
          <div onClick={() => handleCardClick('postTripTargets', '전체 상담 완료 현황')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.postTripCount || 0} label="상담 완료 (전체)" isActive={activeFilter === 'postTripTargets'} />
          </div>
        </div>
      </section>

      {/* 3. 상세 리스트 */}
      <ConsultationList title={activeTitle} data={currentList} />
    </div>
  );
}

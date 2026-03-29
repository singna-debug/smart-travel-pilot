'use client';

import { useEffect, useState } from 'react';
import StatsCard from '@/components/StatsCard';
import ConsultationList from '@/components/ConsultationList';
import { ConsultationData } from '@/types';
import { RefreshCw } from 'lucide-react';

interface DashboardResponse {
  summary: {
    newInquiriesCount: number;
    confirmedCount: number;
    completedCount: number;
    reminderCount: number;
  };
  schedule: {
    remindersCount: number;
    confirmedCount: number;
    prepaidCount: number;
    noticeCount: number;
    balanceCount: number;
    confirmationSentCount: number;
    departureNoticeCount: number;
    phoneNoticeCount: number;
    happyCallCount: number;
  };
  lists: {
    recentInquiries: ConsultationData[];
    reminders: ConsultationData[];
    confirmed: ConsultationData[];
    completedInquiries: ConsultationData[];
    prepaidRequest: ConsultationData[];
    noticeRequest: ConsultationData[];
    balanceRequest: ConsultationData[];
    confirmationSent: ConsultationData[];
    departureNotice: ConsultationData[];
    phoneNotice: ConsultationData[];
    happyCall: ConsultationData[];
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
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">여행 상담 대시보드</h1>
          <p className="page-subtitle">실시간 상담 현황과 챙겨야 할 스케줄을 한눈에 확인하세요.</p>
        </div>
        <button 
          onClick={(e) => {
            e.preventDefault();
            setLoading(true);
            fetchDashboardData();
          }}
          className="refresh-button"
          disabled={loading}
          title="새로고침"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} style={{ fontStyle: 'normal' }} />
          <span>새로고침</span>
        </button>
      </header>

      {/* 1. 현황 요약 (최근 7일) */}
      <section className="dashboard-section">
        <div className="section-label">
          요약 (최근 7일)
        </div>
        <div className="stats-grid">
          <div onClick={() => handleCardClick('recentInquiries', '최근 신규 문의')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.summary.newInquiriesCount || 0} label="신규 문의" isActive={activeFilter === 'recentInquiries'} />
          </div>
          <div onClick={() => handleCardClick('confirmed', '예약 확정')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.summary.confirmedCount || 0} label="예약 확정" isActive={activeFilter === 'confirmed'} />
          </div>
          <div onClick={() => handleCardClick('completedInquiries', '결제 완료')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.summary.completedCount || 0} label="결제 완료" isActive={activeFilter === 'completedInquiries'} />
          </div>
        </div>
      </section>

      {/* 2. 스케줄링 */}
      <section className="dashboard-section" style={{ marginTop: '32px' }}>
        <div className="section-label">챙겨야할 스케줄</div>
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          
          <div onClick={() => handleCardClick('reminders', '리마인드 필요')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.remindersCount || 0} label="리마인드" isActive={activeFilter === 'reminders'} isUrgent={true} />
          </div>

          <div onClick={() => handleCardClick('prepaidRequest', '선금 요청 (7일 내)')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.prepaidCount || 0} label="선금 요청" isActive={activeFilter === 'prepaidRequest'} />
          </div>

          <div onClick={() => handleCardClick('noticeRequest', '출발전 안내 (7일 내)')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.noticeCount || 0} label="출발전 안내" isActive={activeFilter === 'noticeRequest'} />
          </div>

          <div onClick={() => handleCardClick('balanceRequest', '잔금 요청 (7일 내)')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.balanceCount || 0} label="잔금 요청" isActive={activeFilter === 'balanceRequest'} />
          </div>

          <div onClick={() => handleCardClick('confirmationSent', '확정서 발송 (7일 내)')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.confirmationSentCount || 0} label="확정서 발송" isActive={activeFilter === 'confirmationSent'} />
          </div>

          <div onClick={() => handleCardClick('departureNotice', '출발안내 (당일)')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.departureNoticeCount || 0} label="출발안내" isActive={activeFilter === 'departureNotice'} />
          </div>

          <div onClick={() => handleCardClick('phoneNotice', '전화안내 (당일)')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.phoneNoticeCount || 0} label="전화안내" isActive={activeFilter === 'phoneNotice'} />
          </div>

          <div onClick={() => handleCardClick('happyCall', '해피콜 (귀국일-1 ~)')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.happyCallCount || 0} label="해피콜" isActive={activeFilter === 'happyCall'} />
          </div>

        </div>
      </section>

      {/* 3. 상세 리스트 */}
      <ConsultationList title={activeTitle} data={currentList} onUpdate={fetchDashboardData} />
    </div>
  );
}

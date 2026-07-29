'use client';

import { useEffect, useState } from 'react';
import StatsCard from '@/components/StatsCard';
import ConsultationList from '@/components/ConsultationList';
import DashboardCalendar from '@/components/DashboardCalendar';
import { ConsultationData } from '@/types';
import { RefreshCw, X } from 'lucide-react';

interface DashboardResponse {
  summary: {
    newInquiriesCount: number;
    confirmedCount: number;
    completedCount: number;
    reminderCount: number;
  };
  schedule: {
    remindersCount: number;
    remindersOverdueCount?: number;
    confirmedCount: number;
    prepaidCount: number;
    prepaidOverdueCount?: number;
    noticeCount: number;
    noticeOverdueCount?: number;
    balanceCount: number;
    balanceOverdueCount?: number;
    confirmationSentCount: number;
    confirmationSentOverdueCount?: number;
    departureNoticeCount: number;
    departureNoticeOverdueCount?: number;
    phoneNoticeCount: number;
    phoneNoticeOverdueCount?: number;
    happyCallCount: number;
    happyCallOverdueCount?: number;
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

export default function DashboardPage({ isDummy = false }: { isDummy?: boolean }) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('recentInquiries'); // Default view
  const [activeTitle, setActiveTitle] = useState('최근 신규 문의');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const pendingCount = data?.lists.recentInquiries.filter(c => c.automation.status === '확인필요').length || 0;

  useEffect(() => {
    const initTenant = async () => {
      try {
        const { createClient } = await import('@/utils/supabase/client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // 사장님 본인 계정이면 무조건 default_tenant로 복구!
          if (user.email === 'gktla71@gmail.com') {
            localStorage.setItem('tenant_id', 'default_tenant');
          } else if (user.id) {
            localStorage.setItem('tenant_id', user.id);
          }
        }
      } catch (e) {}
      fetchDashboardData(false);
    };

    initTenant();
    const interval = setInterval(() => fetchDashboardData(false), 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (forceRefresh = false) => {
    try {
      const baseUrl = isDummy ? '/api/dummy/stats' : '/api/stats';
      const url = forceRefresh ? `${baseUrl}?refresh=true` : baseUrl;
      const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenant_id') : null;
      
      const response = await fetch(url, {
        headers: tenantId ? { 'x-tenant-id': tenantId } : {}
      });
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
      {pendingCount > 0 && !bannerDismissed && (
        <div className="telegram-alert-banner">
          <div className="telegram-alert-content">
            <div className="telegram-alert-icon">🚨</div>
            <div className="telegram-alert-text">
              <div className="telegram-alert-title">퇴근 시간 중 접수된 새로운 텔레그램 문의</div>
              <div className="telegram-alert-desc">
                확인이 필요한 새로운 문의가 <strong>{pendingCount}건</strong> 있습니다. 상담목록에서 내용을 확인하고 상태를 업데이트해 주세요.
              </div>
            </div>
          </div>
          <div className="telegram-alert-actions">
            <button 
              className="telegram-alert-btn" 
              onClick={() => {
                handleCardClick('recentInquiries', '최근 신규 문의');
                setBannerDismissed(true); // 배너 닫기 추가
                setTimeout(() => {
                  const element = document.querySelector('.dashboard-list-section');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  }
                }, 100);
              }}
            >
              상담목록 확인하기
            </button>
            <button 
              className="telegram-alert-close" 
              onClick={() => setBannerDismissed(true)}
              title="닫기"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">{isDummy ? '여행 상담 대시보드 [더미]' : '여행 상담 대시보드'}</h1>
          <p className="page-subtitle">{isDummy ? '실시간 상담 현황(더미)과 챙겨야 할 스케줄을 한눈에 확인하세요.' : '실시간 상담 현황과 챙겨야 할 스케줄을 한눈에 확인하세요.'}</p>
        </div>
        <button 
          onClick={(e) => {
            e.preventDefault();
            setLoading(true);
            fetchDashboardData(true);
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

      {/* 2. 통합 캘린더 */}
      <section className="dashboard-section" style={{ marginTop: '32px' }}>
        <DashboardCalendar lists={data?.lists} isLoading={loading} />
      </section>

      {/* 3. 스케줄링 */}
      <section className="dashboard-section" style={{ marginTop: '32px' }}>
        <div className="section-label">챙겨야할 스케줄</div>
        <div className="stats-grid">
          
          <div onClick={() => handleCardClick('reminders', '리마인드 필요')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.remindersCount || 0} label="리마인드 (상담 후 2일 후)" isActive={activeFilter === 'reminders'} isUrgent={true} overdueValue={data?.schedule.remindersOverdueCount} />
          </div>

          <div onClick={() => handleCardClick('prepaidRequest', '선금 요청')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.prepaidCount || 0} label="선금 요청 (예약 확정 후)" isActive={activeFilter === 'prepaidRequest'} overdueValue={data?.schedule.prepaidOverdueCount} />
          </div>

          <div onClick={() => handleCardClick('balanceRequest', '잔금 요청')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.balanceCount || 0} label="잔금 요청 (출발 3주 전)" isActive={activeFilter === 'balanceRequest'} overdueValue={data?.schedule.balanceOverdueCount} />
          </div>

          <div onClick={() => handleCardClick('confirmationSent', '가이드북 발송')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.confirmationSentCount || 0} label="가이드북 발송 (출발 10일 전)" isActive={activeFilter === 'confirmationSent'} overdueValue={data?.schedule.confirmationSentOverdueCount} />
          </div>

          <div onClick={() => handleCardClick('noticeRequest', '출발전 체크사항')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.noticeCount || 0} label="출발전 체크사항 (출발 1주일 전)" isActive={activeFilter === 'noticeRequest'} overdueValue={data?.schedule.noticeOverdueCount} />
          </div>

          <div onClick={() => handleCardClick('departureNotice', '출발 안내')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.departureNoticeCount || 0} label="출발 안내 (출발 3일 전)" isActive={activeFilter === 'departureNotice'} overdueValue={data?.schedule.departureNoticeOverdueCount} />
          </div>

          <div onClick={() => handleCardClick('phoneNotice', '전화 안내')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.phoneNoticeCount || 0} label="전화 안내 (출발 1일 전)" isActive={activeFilter === 'phoneNotice'} overdueValue={data?.schedule.phoneNoticeOverdueCount} />
          </div>

          <div onClick={() => handleCardClick('happyCall', '해피콜')} style={{ cursor: 'pointer' }}>
            <StatsCard value={data?.schedule.happyCallCount || 0} label="해피콜 (도착 후 2일 후)" isActive={activeFilter === 'happyCall'} overdueValue={data?.schedule.happyCallOverdueCount} />
          </div>

        </div>
      </section>

      {/* 3. 상세 리스트 */}
      <ConsultationList title={activeTitle} data={currentList} onUpdate={() => fetchDashboardData(true)} isDummy={isDummy} />
    </div>
  );
}

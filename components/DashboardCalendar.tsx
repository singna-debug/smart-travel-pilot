'use client';

import React, { useState, useEffect } from 'react';
import {
  addDays,
  subDays,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  addMonths,
  subMonths
} from 'date-fns';
import { ConsultationData } from '@/types';

export type CalendarEventType = 
  | 'reminder' 
  | 'prepaid' 
  | 'balance' 
  | 'guidebook' 
  | 'departure_notice' 
  | 'check_notice' 
  | 'departure' 
  | 'arrival' 
  | 'happycall' 
  | 'leave' 
  | 'off_site' 
  | 'meeting' 
  | 'business_trip' 
  | 'overdue';

export interface CalendarEvent {
  id?: string;
  date: string; // 'YYYY-MM-DD'
  type: CalendarEventType;
  badgeText: string;
  color: string;
  title: string;
  subtitle: string;
  category: 'task' | 'customer' | 'staff';
  customerName?: string;
  destination?: string;
  managerName?: string; // 담당자 이름
  isOverdue?: boolean;
}

interface DashboardCalendarProps {
  consultations?: ConsultationData[];
  lists?: Record<string, ConsultationData[]>;
  isLoading?: boolean;
}

const C = {
  task: '#3b82f6',              // 파랑 (리마인드, 선금, 잔금)
  guide: '#f59e0b',             // 주황 (가이드북, 출발안내, 체크인)
  departure: '#10b981',         // 초록 (출발)
  arrival_happycall: '#8b5cf6', // 보라 (도착, 해피콜)
  overdue: '#ef4444',           // 빨강 (기한초과)
  leave_field: '#06b6d4',       // 청록 (직원 외근, 미팅)
  trip: '#ec4899'               // 핑크 (OOO 출장)
};

// 날짜 파싱 헬퍼 (YYYY-MM-DD 또는 ISO)
function parseToYmd(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const clean = dateStr.replace('(완료)', '').trim().split(' ')[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(clean)) return clean.replace(/\//g, '-');
  try {
    const d = new Date(clean);
    if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
  } catch {
    return null;
  }
  return null;
}

// 쌤플 담당자 목록 (실제 지정이 없을 때 순환 맵핑용)
const MOCK_MANAGERS = ['김담당', '박팀장', '이과장', '정대리', '최실장'];

// 구글 시트/대시보드 실데이터 파싱 함수
function parseConsultationsToEvents(consultations: ConsultationData[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const todayYmd = format(new Date(), 'yyyy-MM-dd');

  consultations.forEach((c, index) => {
    const customerName = c.customer?.name || '고객';
    const dest = c.trip?.destination || c.trip?.product_name || '여행';
    const uniqueId = `${customerName}-${index}`;

    // 담당자 파싱 (데이터에 지정되어 있으면 사용, 없으면 데모용 분배)
    const managerName = (c as any).manager || (c as any).managerName || MOCK_MANAGERS[index % MOCK_MANAGERS.length];

    // 1. 고객 출발일
    const depYmd = parseToYmd(c.trip?.departure_date);
    if (depYmd) {
      events.push({
        id: `${uniqueId}-dep`,
        date: depYmd,
        type: 'departure',
        badgeText: '출발',
        color: C.departure,
        title: `🛫 [출발] ${customerName}님 (${dest})`,
        subtitle: `목적지: ${dest} | 연락처: ${c.customer?.phone || '-'}`,
        category: 'customer',
        customerName,
        destination: dest,
        managerName
      });
    }

    // 2. 차기 리마인드일
    const followupYmd = parseToYmd(c.automation?.next_followup);
    if (followupYmd && !c.automation?.next_followup?.includes('(완료)')) {
      const isPast = followupYmd < todayYmd;
      events.push({
        id: `${uniqueId}-rem`,
        date: followupYmd,
        type: isPast ? 'overdue' : 'reminder',
        badgeText: isPast ? '리마인드초과' : '리마인드',
        color: isPast ? C.overdue : C.task,
        title: `${isPast ? '🚨' : '🔵'} [리마인드] ${customerName}님`,
        subtitle: `상담 상태: ${c.automation?.status || '상담중'} | ${dest}`,
        category: 'task',
        customerName,
        destination: dest,
        managerName,
        isOverdue: isPast
      });
    }

    // 3. 선금 요청일
    const prepaidYmd = parseToYmd(c.automation?.prepaid_date);
    if (prepaidYmd && !c.automation?.prepaid_date?.includes('(완료)')) {
      events.push({
        id: `${uniqueId}-prep`,
        date: prepaidYmd,
        type: 'prepaid',
        badgeText: '선금요청',
        color: C.task,
        title: `💳 [선금요청] ${customerName}님`,
        subtitle: `예약확정 후 선금 안내 (${dest})`,
        category: 'task',
        customerName,
        destination: dest,
        managerName
      });
    }

    // 4. 잔금 요청일
    const balanceYmd = parseToYmd(c.automation?.balance_date);
    if (balanceYmd && !c.automation?.balance_date?.includes('(완료)')) {
      const isPast = balanceYmd < todayYmd;
      events.push({
        id: `${uniqueId}-bal`,
        date: balanceYmd,
        type: isPast ? 'overdue' : 'balance',
        badgeText: isPast ? '잔금초과' : '잔금요청',
        color: isPast ? C.overdue : C.task,
        title: `${isPast ? '🚨' : '💰'} [잔금요청] ${customerName}님`,
        subtitle: `출발 3주 전 잔금 수령 안내 (${dest})`,
        category: 'task',
        customerName,
        destination: dest,
        managerName,
        isOverdue: isPast
      });
    }

    // 5. 가이드북 발송
    const guidebookYmd = parseToYmd(c.automation?.confirmation_sent);
    if (guidebookYmd && !c.automation?.confirmation_sent?.includes('(완료)')) {
      events.push({
        id: `${uniqueId}-guide`,
        date: guidebookYmd,
        type: 'guidebook',
        badgeText: '가이드북',
        color: C.guide,
        title: `📖 [가이드북] ${customerName}님`,
        subtitle: `출발 10일 전 확정가이드북 발송 (${dest})`,
        category: 'task',
        customerName,
        destination: dest,
        managerName
      });
    }

    // 6. 출발안내
    const depNoticeYmd = parseToYmd(c.automation?.departure_notice);
    if (depNoticeYmd && !c.automation?.departure_notice?.includes('(완료)')) {
      events.push({
        id: `${uniqueId}-depnot`,
        date: depNoticeYmd,
        type: 'departure_notice',
        badgeText: '출발안내',
        color: C.guide,
        title: `📢 [출발안내] ${customerName}님`,
        subtitle: `출발 3일 전 최종 체크안내 (${dest})`,
        category: 'customer',
        customerName,
        destination: dest,
        managerName
      });
    }

    // 7. 해피콜
    const happyYmd = parseToYmd(c.automation?.happy_call);
    if (happyYmd && !c.automation?.happy_call?.includes('(완료)')) {
      events.push({
        id: `${uniqueId}-happy`,
        date: happyYmd,
        type: 'happycall',
        badgeText: '해피콜',
        color: C.arrival_happycall,
        title: `📞 [해피콜] ${customerName}님`,
        subtitle: `귀국 후 안부 및 만족도 체크 (${dest})`,
        category: 'customer',
        customerName,
        destination: dest,
        managerName
      });
    }
  });

  return events;
}

// 데모 데이터 생성기
function generateMockEvents(year: number, month: number): CalendarEvent[] {
  let baseToday = new Date();
  if (baseToday.getFullYear() !== year || baseToday.getMonth() !== month - 1) {
    baseToday = new Date(year, month - 1, 15);
  }

  const events: CalendarEvent[] = [];
  const addEvent = (
    date: Date, 
    type: CalendarEventType, 
    badgeText: string,
    color: string, 
    title: string, 
    subtitle: string, 
    category: 'task' | 'customer' | 'staff',
    managerName: string = '김담당'
  ) => {
    events.push({
      id: Math.random().toString(36).substring(7),
      date: format(date, 'yyyy-MM-dd'),
      type,
      badgeText,
      color,
      title,
      subtitle,
      category,
      managerName
    });
  };

  // Today (리마인드 여러 건 포함)
  addEvent(baseToday, 'reminder', '리마인드', C.task, '🔵 [리마인드] 배성용님', '상담 상태: 상담중 | 스페인, 북유럽', 'task', '김담당');
  addEvent(baseToday, 'reminder', '리마인드', C.task, '🔵 [리마인드] 정은선님', '상담 상태: 상담중 | 마츠야마', 'task', '박팀장');
  addEvent(baseToday, 'reminder', '리마인드', C.task, '🔵 [리마인드] 최은영님', '상담 상태: 상담중 | 상해', 'task', '이과장');
  addEvent(baseToday, 'reminder', '리마인드', C.task, '🔵 [리마인드] 이영길님', '상담 상태: 상담중 | 북해도', 'task', '정대리');
  addEvent(baseToday, 'reminder', '리마인드', C.task, '🔵 [리마인드] 김철수님', '상담 상태: 상담중 | 보라카이', 'task', '김담당');
  addEvent(baseToday, 'happycall', '해피콜', C.arrival_happycall, '📞 [해피콜] 곽귀근님', '귀국 후 안부 및 만족도 체크 (오키나와)', 'customer', '최실장');
  addEvent(baseToday, 'happycall', '해피콜', C.arrival_happycall, '📞 [해피콜] 김수아님', '귀국 후 안부 및 만족도 체크 (일본)', 'customer', '김담당');
  addEvent(baseToday, 'happycall', '해피콜', C.arrival_happycall, '📞 [해피콜] 박지성님', '귀국 후 안부 및 만족도 체크 (베트남)', 'customer', '이과장');
  addEvent(baseToday, 'meeting', '공항미팅', C.leave_field, '🤝 [미팅] 인천공항 VIP 미팅', '김이사님 인천공항 T1 VIP 샌딩', 'staff', '박팀장');
  addEvent(baseToday, 'departure', '출발', C.departure, '🛫 [출발] 박지성 가족 4명', '보라카이 직항 / 보라카이 샌드바 리조트', 'customer', '김담당');

  // Future
  addEvent(addDays(baseToday, 1), 'prepaid', '선금요청', C.task, '💳 [선금요청] 최민수 고객님', '예약확정 후 선금 입금 확인', 'task', '정대리');
  addEvent(addDays(baseToday, 1), 'prepaid', '선금요청', C.task, '💳 [선금요청] 강동원 고객님', '선금 결제계좌 발송', 'task', '김담당');
  addEvent(addDays(baseToday, 2), 'off_site', '직원외근', C.leave_field, '💼 [외근] 김대리 외근', '하나투어 본사 제휴 미팅', 'staff', '김대리');
  addEvent(addDays(baseToday, 3), 'business_trip', '보라카이출장', C.trip, '✈️ [출장] 박팀장 보라카이 출장', '현지 샌드바 리조트 점검 및 현지 가이드 미팅', 'staff', '박팀장');

  return events;
}

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith('#')) return `rgba(0,119,255,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 뱃지 그룹화 구조체 정의
interface GroupedBadge {
  type: CalendarEventType;
  badgeLabel: string;
  color: string;
  count: number;
}

function groupDayEventsToBadges(dayEvents: CalendarEvent[]): GroupedBadge[] {
  if (dayEvents.length === 0) return [];
  const map = new Map<string, { type: CalendarEventType; text: string; color: string; count: number }>();

  dayEvents.forEach(e => {
    const key = e.badgeText;
    const existing = map.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        type: e.type,
        text: e.badgeText,
        color: e.color,
        count: 1
      });
    }
  });

  const result: GroupedBadge[] = [];
  map.forEach((val) => {
    let badgeLabel = val.text;
    if (val.count > 1) {
      badgeLabel = `${val.text} ${val.count}건`;
    } else {
      if (['리마인드', '선금요청', '잔금요청', '가이드북', '출발안내', '해피콜', '리마인드초과', '잔금초과'].includes(val.text)) {
        badgeLabel = `${val.text} 1건`;
      }
    }

    result.push({
      type: val.type,
      badgeLabel,
      color: val.color,
      count: val.count
    });
  });

  return result;
}

export default function DashboardCalendar({ consultations, lists, isLoading }: DashboardCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [parsedRealEvents, setParsedRealEvents] = useState<CalendarEvent[]>([]);

  // 아코디언/드롭다운 접기-펼치기 상태 (뱃지별 오픈 상태)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  // 카테고리 필터 (전체 / 특정 유형)
  const [filterType, setFilterType] = useState<string>('ALL');

  useEffect(() => {
    let allConsultations: ConsultationData[] = [];
    if (consultations && consultations.length > 0) {
      allConsultations = consultations;
    } else if (lists) {
      Object.values(lists).forEach(arr => {
        if (Array.isArray(arr)) {
          allConsultations.push(...arr);
        }
      });
    }

    if (allConsultations.length > 0) {
      const realEvents = parseConsultationsToEvents(allConsultations);
      setParsedRealEvents(realEvents);
    } else {
      setParsedRealEvents([]);
    }
  }, [consultations, lists]);

  const activeEvents = parsedRealEvents.length > 0 
    ? parsedRealEvents 
    : generateMockEvents(currentMonth.getFullYear(), currentMonth.getMonth() + 1);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const dateInterval = eachDayOfInterval({ start: startDate, end: endDate });

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // 선택된 날짜의 이벤트 전체
  const selectedDayEvents = activeEvents.filter(e => e.date === format(selectedDate, 'yyyy-MM-dd'));
  const dayNameIndex = selectedDate.getDay();

  // 선택된 날짜 이벤트를 유형(badgeText)별로 그룹화
  const groupedEventsMap = new Map<string, CalendarEvent[]>();
  selectedDayEvents.forEach(e => {
    const groupKey = e.badgeText;
    if (!groupedEventsMap.has(groupKey)) {
      groupedEventsMap.set(groupKey, []);
    }
    groupedEventsMap.get(groupKey)!.push(e);
  });

  // 선택날짜 변경 시 상세 일정 그룹 기본적으로 접어두기 (기본 false)
  useEffect(() => {
    const initialOpenState: Record<string, boolean> = {};
    Array.from(groupedEventsMap.keys()).forEach((key) => {
      initialOpenState[key] = false; // 기본적으로 접힘 상태로 시작
    });
    setOpenGroups(initialOpenState);
    setFilterType('ALL');
  }, [selectedDate]);

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // unique badgeText 목록 (필터 드롭다운용)
  const availableBadgeTexts = Array.from(groupedEventsMap.keys());

  return (
    <div className="cal-container">
      {/* Header */}
      <div className="cal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="cal-month-title">📅 업무 캘린더</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="cal-nav-btn" onClick={handlePrevMonth} title="이전 달">◀</button>
          <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px' }}>
            {format(currentMonth, 'yyyy년 M월')}
          </span>
          <button className="cal-nav-btn" onClick={handleNextMonth} title="다음 달">▶</button>
          <button className="cal-today-btn" onClick={handleToday}>오늘</button>
        </div>
      </div>

      {/* Grid Header */}
      <div className="cal-dow-row">
        {dayNames.map((day, i) => (
          <div key={day} className={`cal-dow-cell ${i === 0 ? 'cal-sunday' : i === 6 ? 'cal-saturday' : ''}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Grid Cells */}
      <div className="cal-grid">
        {dateInterval.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          const dayEvents = activeEvents.filter(e => e.date === dayStr);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const dayOfWeek = day.getDay();
          
          let cellClass = 'cal-cell';
          if (!isCurrentMonth) cellClass += ' cal-other-month';
          if (isToday(day)) cellClass += ' cal-today';
          if (isSameDay(day, selectedDate)) cellClass += ' cal-selected';
          if (dayOfWeek === 0) cellClass += ' cal-sunday';
          if (dayOfWeek === 6) cellClass += ' cal-saturday';

          const groupedBadges = groupDayEventsToBadges(dayEvents);
          const visibleBadges = groupedBadges.slice(0, 2);
          const hiddenBadgesCount = groupedBadges.length - 2;

          return (
            <div key={day.toString()} className={cellClass} onClick={() => setSelectedDate(day)}>
              <div className="cal-day-num">{format(day, 'd')}</div>
              
              <div className="cal-badges-container">
                {visibleBadges.map((badge, idx) => (
                  <div
                    key={idx}
                    className="cal-badge-pill"
                    style={{
                      background: hexToRgba(badge.color, 0.22),
                      color: badge.color,
                      borderColor: hexToRgba(badge.color, 0.45)
                    }}
                  >
                    <span className="cal-badge-text">{badge.badgeLabel}</span>
                  </div>
                ))}
                {hiddenBadgesCount > 0 && (
                  <div className="cal-badge-more">
                    +{hiddenBadgesCount}개 항목 더보기
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Panel (드롭다운 & 담당자 정보 적용) */}
      <div className="cal-detail" key={format(selectedDate, 'yyyy-MM-dd')}>
        <div className="cal-detail-header-row">
          <div className="cal-detail-header">
            📋 {format(selectedDate, 'M월 d일')} ({dayNames[dayNameIndex]}) — 해당일 상세 업무 및 일정
            <span className="cal-detail-count">{selectedDayEvents.length}건</span>
          </div>

          {/* 유형별 드롭다운 필터 */}
          {availableBadgeTexts.length > 0 && (
            <div className="cal-filter-wrapper">
              <span className="cal-filter-label">유형 필터:</span>
              <select 
                className="cal-filter-select" 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="ALL">전체 보기 ({selectedDayEvents.length}건)</option>
                {availableBadgeTexts.map(text => (
                  <option key={text} value={text}>
                    {text} ({groupedEventsMap.get(text)?.length}건)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* 상세 목록 (드롭다운 / 아코디언 그룹화 및 우측 담당자 표시) */}
        <div className="cal-detail-list">
          {selectedDayEvents.length === 0 ? (
            <div className="cal-empty">등록되거나 예정된 일정이 없습니다.</div>
          ) : (
            Array.from(groupedEventsMap.entries())
              .filter(([badgeKey]) => filterType === 'ALL' || filterType === badgeKey)
              .map(([badgeKey, groupEvents]) => {
                const isGroupOpen = Boolean(openGroups[badgeKey]); // 기본 false (접힘 상태)
                const firstEvent = groupEvents[0];
                const badgeColor = firstEvent.color;

                return (
                  <div key={badgeKey} className="cal-accordion-group">
                    {/* 그룹 헤더 드롭다운 버튼 */}
                    <div 
                      className="cal-accordion-header"
                      onClick={() => toggleGroup(badgeKey)}
                      style={{
                        borderColor: hexToRgba(badgeColor, 0.3),
                        background: hexToRgba(badgeColor, 0.08)
                      }}
                    >
                      <div className="cal-accordion-title">
                        <span 
                          className="cal-event-badge"
                          style={{
                            background: hexToRgba(badgeColor, 0.25),
                            color: badgeColor,
                            border: `1px solid ${hexToRgba(badgeColor, 0.5)}`
                          }}
                        >
                          {badgeKey}
                        </span>
                        <span className="cal-group-count-text">
                          총 <strong>{groupEvents.length}건</strong>의 일정
                        </span>
                      </div>
                      <div className="cal-accordion-arrow">
                        {isGroupOpen ? '▲ 접기' : '▼ 펼치기'}
                      </div>
                    </div>

                    {/* 아코디언 그룹 내 개별 일정 항목들 */}
                    {isGroupOpen && (
                      <div className="cal-accordion-content">
                        {groupEvents.map((e, idx) => (
                          <div key={idx} className="cal-event-item">
                            <div 
                              className="cal-event-badge" 
                              style={{
                                background: hexToRgba(e.color, 0.2),
                                color: e.color,
                                border: `1px solid ${hexToRgba(e.color, 0.4)}`
                              }}
                            >
                              {e.badgeText}
                            </div>

                            {/* 주요 제목 및 상세 정보 */}
                            <div className="cal-event-content">
                              <div className="cal-event-title">{e.title}</div>
                              <div className="cal-event-subtitle">{e.subtitle}</div>
                            </div>

                            {/* 우측 담당자 표시 Tag */}
                            <div className="cal-manager-tag" title={`담당자: ${e.managerName || '김담당'}`}>
                              <span className="cal-manager-icon">👤</span>
                              <span className="cal-manager-label">담당:</span>
                              <span className="cal-manager-name">{e.managerName || '김담당'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}

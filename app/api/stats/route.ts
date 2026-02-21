import { NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';
import { differenceInDays, isAfter, isBefore, addDays, startOfDay, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const consultations = await getAllConsultations();
        const today = startOfDay(new Date());

        // 1. 최근 7일 이내 생성된 신규 문의 목록
        const recentInquiries = consultations.filter(c => {
            if (!c.timestamp) return false;
            // timestamp 형식: "2026-02-21 20:30" 또는 "2026-02-21T20:30:00.000Z"
            const dateStr = c.timestamp.replace(' ', 'T');
            const createdDate = startOfDay(new Date(dateStr));
            const diff = differenceInDays(today, createdDate);
            return diff >= 0 && diff <= 7;
        });

        // 2. 최근 7일 문의 중 '예약확정'인 건수
        const confirmedInquiries = recentInquiries.filter(c => c.automation.status === '예약확정');

        // 3. 결제완료 건수 (전체 또는 최근 7일? 사용자 요청: "결제완료건이면 숫자반영되고". 문맥상 최근 7일 문의 중)
        const completedInquiries = recentInquiries.filter(c => c.automation.status === '결제완료');

        // 4. 팔로업일(next_followup)이 앞으로 7일 이내인 건수
        const needReminders = consultations.filter(c => {
            if (!c.automation.next_followup) return false;
            const followUpDateStr = c.automation.next_followup.replace(' ', 'T');
            const followUpDate = startOfDay(new Date(followUpDateStr));
            const diff = differenceInDays(followUpDate, today);
            // 오늘이거나 미래 7일 이내
            return diff >= 0 && diff <= 7 && !['상담완료', '결제완료', '취소'].includes(c.automation.status);
        });

        // 기타 스케줄 (기존 기능 유지)
        const balanceDueTargets = consultations.filter(c => c.automation.status === '예약확정'); // 임시
        const travelNoticeTargets = consultations.filter(c => c.automation.status === '결제완료'); // 임시
        const postTripTargets = consultations.filter(c => c.automation.status === '상담완료'); // 임시

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    newInquiriesCount: recentInquiries.length,
                    confirmedCount: confirmedInquiries.length,
                    completedCount: completedInquiries.length,
                    reminderCount: needReminders.length,
                },
                schedule: {
                    balanceDueCount: balanceDueTargets.length,
                    travelNoticeCount: travelNoticeTargets.length,
                    postTripCount: postTripTargets.length,
                },
                lists: {
                    recentInquiries,
                    confirmedInquiries,
                    completedInquiries,
                    needReminders,
                    balanceDueTargets,
                    travelNoticeTargets,
                    postTripTargets,
                }
            },
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { mockConsultations } from '@/lib/dummy-data';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const recentInquiries = mockConsultations.filter(c => c.automation.status === '상담중');
        const confirmed = mockConsultations.filter(c => c.automation.status === '예약확정');
        const completedInquiries = mockConsultations.filter(c => c.automation.status === '결제완료');

        // Simple mock schedules
        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    newInquiriesCount: recentInquiries.length,
                    confirmedCount: confirmed.length,
                    completedCount: completedInquiries.length,
                    reminderCount: 1,
                },
                schedule: {
                    remindersCount: 1,
                    remindersOverdueCount: 0,
                    confirmedCount: confirmed.length,
                    prepaidCount: 1,
                    prepaidOverdueCount: 0,
                    noticeCount: 1,
                    noticeOverdueCount: 0,
                    balanceCount: 1,
                    balanceOverdueCount: 0,
                    confirmationSentCount: 1,
                    confirmationSentOverdueCount: 0,
                    departureNoticeCount: 1,
                    departureNoticeOverdueCount: 0,
                    phoneNoticeCount: 1,
                    phoneNoticeOverdueCount: 0,
                    happyCallCount: 1,
                    happyCallOverdueCount: 0,
                },
                lists: {
                    recentInquiries: mockConsultations,
                    reminders: mockConsultations.slice(0, 1),
                    confirmed: confirmed,
                    completedInquiries: completedInquiries,
                    prepaidRequest: mockConsultations.slice(0, 1),
                    noticeRequest: mockConsultations.slice(0, 1),
                    balanceRequest: mockConsultations.slice(0, 1),
                    confirmationSent: mockConsultations.slice(0, 1),
                    departureNotice: mockConsultations.slice(0, 1),
                    phoneNotice: mockConsultations.slice(0, 1),
                    happyCall: mockConsultations.slice(0, 1),
                }
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch dummy stats' }, { status: 500 });
    }
}

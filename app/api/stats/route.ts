import { NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';
import { differenceInDays, isAfter, isBefore, addDays, startOfDay, parseISO } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const consultations = await getAllConsultations();
        const todayObj = startOfDay(new Date());

        // 날짜 파싱 헬퍼
        const parseD = (dStr?: string | null) => {
            if (!dStr) return null;
            const cleanStr = dStr.replace('(완료)', '').trim().replace(' ', 'T');
            const d = new Date(cleanStr);
            if (isNaN(d.getTime())) return null;
            return startOfDay(d);
        };

        const isNotDone = (val?: string) => {
            if (!val) return false; // 값이 없으면 대상 아님
            return !val.includes('(완료)');
        };

        const isBetween = (dStr: string | undefined, minDiff: number, maxDiff: number) => {
            if (!dStr) return false;
            const d = parseD(dStr);
            if (!d) return false;
            const diff = differenceInDays(d, todayObj);
            return diff >= minDiff && diff <= maxDiff;
        };

        const isExactToday = (dStr: string | undefined) => {
            if (!dStr) return false;
            const d = parseD(dStr);
            if (!d) return false;
            return differenceInDays(d, todayObj) === 0;
        };

        // 1. 최근 7일 이내 생성된 신규 문의 목록 (Summary 용 유지)
        const recentInquiries = consultations.filter(c => {
            const d = parseD(c.timestamp);
            if (!d) return false;
            const diff = differenceInDays(todayObj, d);
            return diff >= 0 && diff <= 7;
        });

        // 1. 리마인드 (next_followup): 앞으로 7일 이내 (완료 안된 건)
        const reminders = consultations.filter(c => 
            isNotDone(c.automation.next_followup) && isBetween(c.automation.next_followup, 0, 7)
        );

        // 2. 예약확정 (confirmed_date): 오늘로부터 30일 전까지 
        // 또는 상태가 '예약확정', '결제완료' 등인 모든 건
        const confirmed = consultations.filter(c => {
            const status = c.automation.status || '';
            if (['예약확정', '선금완료', '잔금완료', '결제완료', '확정', '전액결제'].includes(status)) return true;
            
            const d = parseD(c.automation.confirmed_date);
            if (!d) return false;
            const diff = differenceInDays(d, todayObj);
            // 30일 전 ~ 오늘까지의 확정 건 노출
            return diff >= -30 && diff <= 0;
        });

        // 3. 선금요청 (prepaid_date): 앞으로 7일 이내
        const prepaidRequest = consultations.filter(c => 
            isNotDone(c.automation.prepaid_date) && isBetween(c.automation.prepaid_date, 0, 7)
        );

        // 4. 출발전안내 (notice_date): 앞으로 7일 이내
        const noticeRequest = consultations.filter(c => 
            isNotDone(c.automation.notice_date) && isBetween(c.automation.notice_date, 0, 7)
        );

        // 5. 잔금요청 (balance_date): 앞으로 7일 이내
        const balanceRequest = consultations.filter(c => 
            isNotDone(c.automation.balance_date) && isBetween(c.automation.balance_date, 0, 7)
        );

        // 6. 확정서발송 (confirmation_sent): 앞으로 7일 이내
        const confirmationSent = consultations.filter(c => 
            isNotDone(c.automation.confirmation_sent) && isBetween(c.automation.confirmation_sent, 0, 7)
        );

        // 7. 출발안내 (departure_notice): 당일건
        const departureNotice = consultations.filter(c => 
            isNotDone(c.automation.departure_notice) && isExactToday(c.automation.departure_notice)
        );

        // 8. 전화안내 (phone_notice): 당일건
        const phoneNotice = consultations.filter(c => 
            isNotDone(c.automation.phone_notice) && isExactToday(c.automation.phone_notice)
        );

        // 9. 해피콜 (happy_call): 귀국일로부터 하루전부터의 해당건 (해피콜이 완료되지 않은 것)
        // today >= returnDate - 1 day => differenceInDays(today, returnDate - 1) >= 0 => differenceInDays(today, returnDate) >= -1
        const happyCall = consultations.filter(c => {
            if (!isNotDone(c.automation.happy_call)) return false; // 해피콜이 이미 완료된 경우 제외
            const rDate = parseD(c.trip.return_date);
            if (!rDate) return false;
            const diff = differenceInDays(todayObj, rDate);
            return diff >= -1; // 귀국일 하루 전부터 계속 노출 (완료 누를 때까지)
        });

        // 10. 결제완료 (completedInquiries): 상태가 '선금완료', '잔금완료', '결제완료' 인 건
        const completedInquiries = consultations.filter(c => 
            ['선금완료', '잔금완료', '결제완료'].includes(c.automation.status)
        );

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    newInquiriesCount: recentInquiries.length,
                    confirmedCount: confirmed.length,
                    completedCount: completedInquiries.length,
                    reminderCount: reminders.length,
                },
                schedule: {
                    remindersCount: reminders.length,
                    confirmedCount: confirmed.length,
                    prepaidCount: prepaidRequest.length,
                    noticeCount: noticeRequest.length,
                    balanceCount: balanceRequest.length,
                    confirmationSentCount: confirmationSent.length,
                    departureNoticeCount: departureNotice.length,
                    phoneNoticeCount: phoneNotice.length,
                    happyCallCount: happyCall.length,
                },
                lists: {
                    recentInquiries,
                    reminders,
                    confirmed,
                    completedInquiries,
                    prepaidRequest,
                    noticeRequest,
                    balanceRequest,
                    confirmationSent,
                    departureNotice,
                    phoneNotice,
                    happyCall,
                }
            },
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
    }
}

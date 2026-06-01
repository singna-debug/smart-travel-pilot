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

        const isCanceled = (status?: string) => {
            return status === '취소/보류' || status === '취소';
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

        // [Refactor] 중복 고객 합치기 (최신 상태만 남기기)
        const getLatestConsultations = (list: any[]) => {
            const map = new Map<string, any>();
            list.forEach(c => {
                const phone = c.customer.phone ? String(c.customer.phone).replace(/[^0-9]/g, '') : '';
                const key = phone && phone.length > 5 ? phone : c.customer.name;
                if (!key) return;
                
                const existing = map.get(key);
                if (!existing) {
                    map.set(key, c);
                } else {
                    const curDate = parseD(c.timestamp);
                    const extDate = parseD(existing.timestamp);
                    if (curDate && extDate && curDate > extDate) {
                        map.set(key, c);
                    } else if (curDate && !extDate) {
                        map.set(key, c);
                    }
                }
            });
            return Array.from(map.values());
        };

        const latestConsultations = getLatestConsultations(consultations);

        // 1. 최근 7일 이내 생성된 신규 문의 목록 (Summary 용 유지)
        const recentInquiries = latestConsultations.filter(c => {
            const d = parseD(c.timestamp);
            if (!d) return false;
            const diff = differenceInDays(todayObj, d);
            return diff >= 0 && diff <= 7;
        });

        // 1. 리마인드 (next_followup): 앞으로 7일 이내 (완료 안된 건)
        const reminders = latestConsultations.filter(c => 
            !isCanceled(c.automation.status) && isNotDone(c.automation.next_followup) && isBetween(c.automation.next_followup, 0, 7)
        );

        // 2. 예약확정 (confirmed_date): 오늘로부터 30일 전까지 
        const confirmed = latestConsultations.filter(c => {
            const status = c.automation.status || '';
            if (['예약확정', '선금완료', '잔금완료', '결제완료', '확정', '전액결제'].includes(status)) return true;
            
            const d = parseD(c.automation.confirmed_date);
            if (!d) return false;
            const diff = differenceInDays(d, todayObj);
            return diff >= -30 && diff <= 0;
        });

        // 3. 선금요청 (prepaid_date): 앞으로 7일 이내
        const prepaidRequest = latestConsultations.filter(c => 
            !isCanceled(c.automation.status) && isNotDone(c.automation.prepaid_date) && isBetween(c.automation.prepaid_date, 0, 7)
        );

        // 4. 출발전안내 (notice_date): 앞으로 7일 이내
        const noticeRequest = latestConsultations.filter(c => 
            !isCanceled(c.automation.status) && isNotDone(c.automation.notice_date) && isBetween(c.automation.notice_date, 0, 7)
        );

        // 5. 잔금요청 (balance_date): 앞으로 7일 이내
        const balanceRequest = latestConsultations.filter(c => 
            !isCanceled(c.automation.status) && isNotDone(c.automation.balance_date) && isBetween(c.automation.balance_date, 0, 7)
        );

        // 6. 확정서발송 (confirmation_sent): 앞으로 7일 이내
        const confirmationSent = latestConsultations.filter(c => 
            !isCanceled(c.automation.status) && isNotDone(c.automation.confirmation_sent) && isBetween(c.automation.confirmation_sent, 0, 7)
        );

        // 7. 출발안내 (departure_notice): 당일건
        const departureNotice = latestConsultations.filter(c => 
            !isCanceled(c.automation.status) && isNotDone(c.automation.departure_notice) && isExactToday(c.automation.departure_notice)
        );

        // 8. 전화안내 (phone_notice): 당일건
        const phoneNotice = latestConsultations.filter(c => 
            !isCanceled(c.automation.status) && isNotDone(c.automation.phone_notice) && isExactToday(c.automation.phone_notice)
        );

        // 9. 해피콜 (happy_call): 귀국일 당일부터의 해당건 (해피콜이 완료되지 않은 것)
        const happyCall = latestConsultations.filter(c => {
            if (isCanceled(c.automation.status)) return false;
            if (!isNotDone(c.automation.happy_call)) return false;
            const rDate = parseD(c.trip.return_date);
            if (!rDate) return false;
            const diff = differenceInDays(todayObj, rDate);
            return diff >= 0;
        });

        // 10. 결제완료 (completedInquiries): 상태가 '선금완료', '잔금완료', '결제완료' 인 건
        const completedInquiries = latestConsultations.filter(c => 
            ['선금완료', '잔금완료', '결제완료'].includes(c.automation.status)
        );

        // 최종 정렬 (보기 좋게 최신순)
        const sortByTimestamp = (list: any[]) => {
            return list.sort((a, b) => {
                const da = parseD(a.timestamp);
                const db = parseD(b.timestamp);
                if (!da) return 1;
                if (!db) return -1;
                return db.getTime() - da.getTime();
            });
        };

        const finalRecentInquiries = sortByTimestamp(recentInquiries);
        const finalReminders = sortByTimestamp(reminders);
        const finalConfirmed = sortByTimestamp(confirmed);
        const finalPrepaid = sortByTimestamp(prepaidRequest);
        const finalNotice = sortByTimestamp(noticeRequest);
        const finalBalance = sortByTimestamp(balanceRequest);
        const finalConfirmationSent = sortByTimestamp(confirmationSent);
        const finalDepartureNotice = sortByTimestamp(departureNotice);
        const finalPhoneNotice = sortByTimestamp(phoneNotice);
        const finalHappyCall = sortByTimestamp(happyCall);
        const finalCompletedInquiries = sortByTimestamp(completedInquiries);

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    newInquiriesCount: finalRecentInquiries.length,
                    confirmedCount: finalConfirmed.length,
                    completedCount: finalCompletedInquiries.length,
                    reminderCount: finalReminders.length,
                },
                schedule: {
                    remindersCount: finalReminders.length,
                    confirmedCount: finalConfirmed.length,
                    prepaidCount: finalPrepaid.length,
                    noticeCount: finalNotice.length,
                    balanceCount: finalBalance.length,
                    confirmationSentCount: finalConfirmationSent.length,
                    departureNoticeCount: finalDepartureNotice.length,
                    phoneNoticeCount: finalPhoneNotice.length,
                    happyCallCount: finalHappyCall.length,
                },
                lists: {
                    recentInquiries: finalRecentInquiries,
                    reminders: finalReminders,
                    confirmed: finalConfirmed,
                    completedInquiries: finalCompletedInquiries,
                    prepaidRequest: finalPrepaid,
                    noticeRequest: finalNotice,
                    balanceRequest: finalBalance,
                    confirmationSent: finalConfirmationSent,
                    departureNotice: finalDepartureNotice,
                    phoneNotice: finalPhoneNotice,
                    happyCall: finalHappyCall,
                }
            },
        });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch data' }, { status: 500 });
    }
}

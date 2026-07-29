import { NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';
import { supabase } from '@/lib/supabase';
import { getTenantIdFromHeaderOrQuery, DEFAULT_TENANT_ID } from '@/lib/tenant';
import { differenceInDays, isAfter, isBefore, addDays, startOfDay, parseISO, format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const refresh = searchParams.get('refresh') === 'true';
        const tenantId = getTenantIdFromHeaderOrQuery(request);

        let consultations: any[] = [];

        if (tenantId === DEFAULT_TENANT_ID) {
            consultations = await getAllConsultations(refresh);
        } else if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
            const { data } = await supabase
                .from('consultations')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (data) {
                consultations = data.map(c => ({
                    id: c.id,
                    timestamp: c.created_at,
                    visitor_id: c.visitor_id,
                    customer: { name: c.customer_name, phone: c.customer_phone },
                    trip: {
                        destination: c.destination,
                        product_name: c.product_name,
                        departure_date: c.departure_date,
                        url: c.url
                    },
                    automation: { status: c.status },
                    summary: c.summary
                }));
            }
        }
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

        const isTargetActive = (dStr: string | undefined, maxDaysAfter: number = 2) => {
            if (!dStr) return false;
            const d = parseD(dStr);
            if (!d) return false;
            const diff = differenceInDays(todayObj, d);
            return diff >= 0 && diff <= maxDaysAfter;
        };

        const isTargetPastOrToday = (dStr: string | undefined) => {
            if (!dStr) return false;
            const d = parseD(dStr);
            if (!d) return false;
            const diff = differenceInDays(todayObj, d);
            return diff >= 0;
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

        // 1. 최근 7일 이내 생성된 신규 문의 목록 (Summary 용 유지) 또는 상태가 '확인필요'인 건
        const recentInquiries = latestConsultations.filter(c => {
            if (c.automation.status === '확인필요') return true;
            const d = parseD(c.timestamp);
            if (!d) return false;
            const diff = differenceInDays(todayObj, d);
            return diff >= 0 && diff <= 7;
        });

        // 1. 리마인드 (next_followup)
        const reminders = latestConsultations.filter(c => {
            const status = (c.automation.status || '').trim();
            const isResolved = ['상담완료', '예약확정', '선금완료', '잔금완료', '여행완료', '결제완료', '확정', '전액결제', '완료', '취소', '취소/보류'].includes(status);
            
            const next_followup = c.automation.next_followup;
            let targetFollowupDate: string | undefined = undefined;
            
            if (next_followup && next_followup.trim() !== '') {
                if (isNotDone(next_followup)) {
                    targetFollowupDate = next_followup;
                }
            } else {
                const tsDate = parseD(c.timestamp);
                if (tsDate) {
                    const fallbackDate = addDays(tsDate, 2);
                    targetFollowupDate = format(fallbackDate, 'yyyy-MM-dd');
                }
            }
            
            return !isResolved && targetFollowupDate && isTargetPastOrToday(targetFollowupDate);
        });

        // 2. 예약확정 (confirmed_date): 오늘로부터 30일 전까지 
        const confirmed = latestConsultations.filter(c => {
            const status = c.automation.status || '';
            if (['예약확정', '선금완료', '잔금완료', '여행완료', '결제완료', '확정', '전액결제'].includes(status)) return true;
            
            const d = parseD(c.automation.confirmed_date);
            if (!d) return false;
            const diff = differenceInDays(todayObj, d);
            return diff >= 0 && diff <= 30;
        });

        // 3. 선금요청 (prepaid_date): 타겟일 당일부터 완료 처리 전까지 계속 노출 (단, 선금완료/잔금완료/결제완료/상담완료/취소 제외)
        const prepaidRequest = latestConsultations.filter(c => {
            const status = (c.automation.status || '').trim();
            const isResolved = ['선금완료', '잔금완료', '결제완료', '전액결제', '완료', '여행완료', '상담완료', '취소', '취소/보류'].includes(status);
            return !isResolved && isNotDone(c.automation.prepaid_date) && isTargetPastOrToday(c.automation.prepaid_date);
        });

        // 4. 출발전 체크사항 (notice_date)
        const noticeRequest = latestConsultations.filter(c => {
            const status = (c.automation.status || '').trim();
            const isResolved = ['상담완료', '취소', '취소/보류'].includes(status);
            return !isResolved && isNotDone(c.automation.notice_date) && isTargetPastOrToday(c.automation.notice_date);
        });

        // 5. 잔금요청 (balance_date)
        const balanceRequest = latestConsultations.filter(c => {
            const status = (c.automation.status || '').trim();
            const isResolved = ['잔금완료', '결제완료', '전액결제', '완료', '여행완료', '상담완료', '취소', '취소/보류'].includes(status);
            return !isResolved && isNotDone(c.automation.balance_date) && isTargetPastOrToday(c.automation.balance_date);
        });

        // 6. 가이드북 발송 (confirmation_sent)
        const confirmationSent = latestConsultations.filter(c => {
            const status = (c.automation.status || '').trim();
            const isResolved = ['상담완료', '취소', '취소/보류'].includes(status);
            return !isResolved && isNotDone(c.automation.confirmation_sent) && isTargetPastOrToday(c.automation.confirmation_sent);
        });

        // 7. 출발안내 (departure_notice)
        const departureNotice = latestConsultations.filter(c => {
            const status = (c.automation.status || '').trim();
            const isResolved = ['상담완료', '취소', '취소/보류'].includes(status);
            return !isResolved && isNotDone(c.automation.departure_notice) && isTargetPastOrToday(c.automation.departure_notice);
        });

        // 8. 전화안내 (phone_notice)
        const phoneNotice = latestConsultations.filter(c => {
            const status = (c.automation.status || '').trim();
            const isResolved = ['상담완료', '취소', '취소/보류'].includes(status);
            return !isResolved && isNotDone(c.automation.phone_notice) && isTargetPastOrToday(c.automation.phone_notice);
        });

        // 9. 해피콜 (happy_call)
        const happyCall = latestConsultations.filter(c => 
            !isCanceled(c.automation.status) && isNotDone(c.automation.happy_call) && isTargetPastOrToday(c.automation.happy_call)
        );

        // 10. 결제완료 (completedInquiries): 상태가 '선금완료', '잔금완료', '결제완료' 인 건
        const completedInquiries = latestConsultations.filter(c => 
            ['선금완료', '잔금완료', '결제완료'].includes(c.automation.status)
        );

        // [기한초과 계산 헬퍼]
        const checkOverdue = (dStr?: string) => {
            if (!dStr) return false;
            const d = parseD(dStr);
            if (!d) return false;
            const diff = differenceInDays(todayObj, d);
            return diff > 2; // 당일, 1일차, 2일차까지는 기한 내(0, 1, 2) / 3일차(diff=3)부터 기한초과
        };

        // 데이터 맵핑 및 정렬 (isOverdue 플래그 추가 포함)
        const processAndSortList = (list: any[], dateFieldExtractor: (item: any) => string | undefined) => {
            const mappedList = list.map(item => {
                const targetDate = dateFieldExtractor(item);
                return {
                    ...item,
                    isOverdue: checkOverdue(targetDate)
                };
            });

            return mappedList.sort((a, b) => {
                const da = parseD(a.timestamp);
                const db = parseD(b.timestamp);
                if (!da) return 1;
                if (!db) return -1;
                return db.getTime() - da.getTime();
            });
        };

        const finalRecentInquiries = [...recentInquiries].sort((a, b) => {
            const da = parseD(a.timestamp);
            const db = parseD(b.timestamp);
            if (!da) return 1;
            if (!db) return -1;
            return db.getTime() - da.getTime();
        });

        const finalReminders = processAndSortList(reminders, c => {
            const next_followup = c.automation.next_followup;
            if (next_followup && next_followup.trim() !== '') return next_followup;
            const tsDate = parseD(c.timestamp);
            return tsDate ? format(addDays(tsDate, 2), 'yyyy-MM-dd') : undefined;
        });

        const finalConfirmed = [...confirmed].sort((a, b) => {
            const da = parseD(a.timestamp);
            const db = parseD(b.timestamp);
            if (!da) return 1;
            if (!db) return -1;
            return db.getTime() - da.getTime();
        });

        const finalPrepaid = processAndSortList(prepaidRequest, c => c.automation.prepaid_date);
        const finalNotice = processAndSortList(noticeRequest, c => c.automation.notice_date);
        const finalBalance = processAndSortList(balanceRequest, c => c.automation.balance_date);
        const finalConfirmationSent = processAndSortList(confirmationSent, c => c.automation.confirmation_sent);
        const finalDepartureNotice = processAndSortList(departureNotice, c => c.automation.departure_notice);
        const finalPhoneNotice = processAndSortList(phoneNotice, c => c.automation.phone_notice);
        const finalHappyCall = processAndSortList(happyCall, c => c.automation.happy_call);
        
        const finalCompletedInquiries = [...completedInquiries].sort((a, b) => {
            const da = parseD(a.timestamp);
            const db = parseD(b.timestamp);
            if (!da) return 1;
            if (!db) return -1;
            return db.getTime() - da.getTime();
        });

        const getOverdueCount = (list: any[]) => list.filter(item => item.isOverdue).length;

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
                    remindersOverdueCount: getOverdueCount(finalReminders),

                    confirmedCount: finalConfirmed.length, // 예약확정은 기한초과 없음

                    prepaidCount: finalPrepaid.length,
                    prepaidOverdueCount: getOverdueCount(finalPrepaid),

                    noticeCount: finalNotice.length,
                    noticeOverdueCount: getOverdueCount(finalNotice),

                    balanceCount: finalBalance.length,
                    balanceOverdueCount: getOverdueCount(finalBalance),

                    confirmationSentCount: finalConfirmationSent.length,
                    confirmationSentOverdueCount: getOverdueCount(finalConfirmationSent),

                    departureNoticeCount: finalDepartureNotice.length,
                    departureNoticeOverdueCount: getOverdueCount(finalDepartureNotice),

                    phoneNoticeCount: finalPhoneNotice.length,
                    phoneNoticeOverdueCount: getOverdueCount(finalPhoneNotice),

                    happyCallCount: finalHappyCall.length,
                    happyCallOverdueCount: getOverdueCount(finalHappyCall),
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


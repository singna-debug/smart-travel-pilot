import { getAllConsultations } from './google-sheets';
import { format } from 'date-fns';
import { ConsultationData } from '@/types';

/**
 * 한국 시간(KST) 기준으로 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getTodayKST(): string {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const kst = new Date(utc + 9 * 60 * 60000);
    return format(kst, 'yyyy-MM-dd');
}

/**
 * 오늘 처리해야 할 업무(알림) 목록을 가져오고 메시지를 구성합니다.
 */
export async function getTodayNotificationMessage(): Promise<string | null> {
    try {
        const consultations = await getAllConsultations(true); // 강제 리프레시
        const today = getTodayKST();

        const categories = {
            reminders: { label: '리마인드', emoji: '🔔', list: [] as ConsultationData[] },
            prepaid: { label: '선금 요청', emoji: '💰', list: [] as ConsultationData[] },
            preDeparture: { label: '출발전 안내', emoji: '✉️', list: [] as ConsultationData[] },
            balance: { label: '잔금 요청', emoji: '💵', list: [] as ConsultationData[] },
            confirmation: { label: '확정서 발송', emoji: '📄', list: [] as ConsultationData[] },
            departure: { label: '출발안내', emoji: '✈️', list: [] as ConsultationData[] },
            phone: { label: '전화안내', emoji: '📞', list: [] as ConsultationData[] },
            happyCall: { label: '해피콜', emoji: '🎉', list: [] as ConsultationData[] },
        };

        consultations.forEach((item) => {
            const { next_followup, prepaid_date, notice_date, balance_date, confirmation_sent, departure_notice, phone_notice, happy_call, balance_due_date } = item.automation || {};

            const isNotDone = (val?: string) => {
                if (!val) return false;
                return !val.includes('(완료)');
            };

            if (next_followup === today && isNotDone(next_followup)) categories.reminders.list.push(item);
            if (prepaid_date === today && isNotDone(prepaid_date)) categories.prepaid.list.push(item);
            if (notice_date === today && isNotDone(notice_date)) categories.preDeparture.list.push(item);
            if ((balance_date === today || balance_due_date === today) && isNotDone(balance_date)) categories.balance.list.push(item);
            if (confirmation_sent === today && isNotDone(confirmation_sent)) categories.confirmation.list.push(item);
            if (departure_notice === today && isNotDone(departure_notice)) categories.departure.list.push(item);
            if (phone_notice === today && isNotDone(phone_notice)) categories.phone.list.push(item);
            if (happy_call === today && isNotDone(happy_call)) categories.happyCall.list.push(item);
        });

        const totalCount = Object.values(categories).reduce((acc, cat) => acc + cat.list.length, 0);



        let message = `<b>오늘(${today})의 챙겨야 할 스케줄 요약</b>\n\n`;
        
        // 요약 섹션
        Object.values(categories).forEach(cat => {
            message += `- ${cat.label}: ${cat.list.length}건\n`;
        });

        message += `\n✅ <b>확인이 필요한 총 ${totalCount}건의 업무가 있습니다.</b>\n`;
        message += `\n-----------------------------------\n\n`;
        message += `📋 <b>오늘 처리해야 할 상세 리스트</b>\n\n`;

        // 상세 섹션
        Object.values(categories).forEach(cat => {
            if (cat.list.length > 0) {
                message += `[${cat.emoji} ${cat.label}]\n`;
                cat.list.forEach((item, idx) => {
                    message += `${idx + 1}. ${item.customer.name} (${item.customer.phone})\n`;
                    message += `   - ${item.trip.destination} (${item.trip.product_name})\n`;
                });
                message += `\n`;
            }
        });

        message += `<i>상세 내용은 대시보드에서 확인해 주세요!</i>`;
        return message;

    } catch (error) {
        console.error('[Notifications] Error fetching today notifications:', error);
        return '<b>⚠️ 알림 데이터를 가져오는 중 오류가 발생했습니다.</b>';
    }
}

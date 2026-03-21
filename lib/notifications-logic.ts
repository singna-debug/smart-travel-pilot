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

        const reminders: ConsultationData[] = [];
        const notices: ConsultationData[] = [];
        const balanceDues: ConsultationData[] = [];

        consultations.forEach((item) => {
            const { next_followup, notice_date, balance_due_date } = item.automation || {};

            if (next_followup === today) reminders.push(item);
            if (notice_date === today) notices.push(item);
            if (balance_due_date === today) balanceDues.push(item);
        });

        if (reminders.length === 0 && notices.length === 0 && balanceDues.length === 0) {
            return null;
        }

        let message = `<b>📢 오늘(${today}) 업무 알림</b>\n\n`;

        if (reminders.length > 0) {
            message += `<b>[🔔 팔로업 / 리마인드]</b>\n`;
            reminders.forEach((r, idx) => {
                message += `${idx + 1}. ${r.customer.name} (${r.customer.phone})\n   - ${r.trip.destination} (${r.trip.product_name})\n`;
            });
            message += `\n`;
        }

        if (notices.length > 0) {
            message += `<b>[✉️ 예약안내 발송]</b>\n`;
            notices.forEach((n, idx) => {
                message += `${idx + 1}. ${n.customer.name} (${n.customer.phone})\n   - ${n.trip.destination} (${n.trip.product_name})\n`;
            });
            message += `\n`;
        }

        if (balanceDues.length > 0) {
            message += `<b>[💰 잔금 확인 / 확정서]</b>\n`;
            balanceDues.forEach((b, idx) => {
                message += `${idx + 1}. ${b.customer.name} (${b.customer.phone})\n   - ${b.trip.destination} (${b.trip.product_name})\n`;
            });
            message += `\n`;
        }

        message += `<i>사이트에서 상세 내용을 확인하세요!</i>`;
        return message;

    } catch (error) {
        console.error('[Notifications] Error fetching today notifications:', error);
        return '<b>⚠️ 알림 데이터를 가져오는 중 오류가 발생했습니다.</b>';
    }
}

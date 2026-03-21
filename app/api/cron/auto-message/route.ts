import { NextRequest, NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';
import { smsService } from '@/lib/sms-service';
import { format } from 'date-fns';

/**
 * 매일 지정된 시간에 실행되어 오늘 발송 대상인 고객에게 문자를 보냅니다.
 * (Vercel Cron 또는 외부 스케줄러에서 호출)
 */
export async function GET(request: NextRequest) {
  // 보안을 위한 Auth Key 확인 (선택 사항)
  // const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new Response('Unauthorized', { status: 401 });
  // }

  try {
    const consultations = await getAllConsultations(true); // 캐시 무시하고 강제 새로고침
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    console.log(`[Cron] Checking for messages to send on ${todayStr}...`);
    
    let sentCount = 0;
    const results = [];

    for (const data of consultations) {
      const phone = data.customer.phone;
      if (!phone || phone === '미정') continue;

      // 1. 팔로업 대상 확인
      if (data.automation.next_followup === todayStr) {
        console.log(`[Cron] Sending Follow-up to ${data.customer.name} (${phone})`);
        const success = await smsService.sendFollowUp(data);
        results.push({ name: data.customer.name, type: 'followup', success });
        if (success) sentCount++;
      }

      // 2. 잔금 기한 리마인드
      if (data.automation.balance_due_date === todayStr) {
        console.log(`[Cron] Sending Balance Reminder to ${data.customer.name} (${phone})`);
        const success = await smsService.sendReminder(data, 'balance');
        results.push({ name: data.customer.name, type: 'balance', success });
        if (success) sentCount++;
      }

      // 3. 안내 발송일 리마인드
      if (data.automation.notice_date === todayStr) {
        console.log(`[Cron] Sending Notice Reminder to ${data.customer.name} (${phone})`);
        const success = await smsService.sendReminder(data, 'notice');
        results.push({ name: data.customer.name, type: 'notice', success });
        if (success) sentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      today: todayStr,
      processed: consultations.length,
      sent: sentCount,
      details: results
    });

  } catch (error: any) {
    console.error('[Cron] Error processing auto-messages:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

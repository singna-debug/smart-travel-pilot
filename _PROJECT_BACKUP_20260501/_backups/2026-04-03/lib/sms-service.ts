import { ConsultationData } from '@/types';

/**
 * Aligo SMS Service
 * 알리고 API를 사용하여 문자 메시지를 발송합니다.
 * API KEY와 USER ID가 필요합니다.
 */
export class SMSService {
  private static instance: SMSService;
  private apiKey: string | undefined;
  private userId: string | undefined;
  private sender: string | undefined;

  private constructor() {
    this.apiKey = process.env.ALIGO_API_KEY;
    this.userId = process.env.ALIGO_USER_ID;
    this.sender = process.env.ALIGO_SENDER || '01000000000'; // 발신번호 사전등록 필요
  }

  public static getInstance(): SMSService {
    if (!SMSService.instance) {
      SMSService.instance = new SMSService();
    }
    return SMSService.instance;
  }

  /**
   * 문자 발송 핵심 로직
   */
  private async sendSMS(receiver: string, message: string): Promise<any> {
    if (!this.apiKey || !this.userId) {
      console.error('[SMS] API Key or User ID missing');
      return { success: false, error: 'Config missing' };
    }

    try {
      const formData = new URLSearchParams();
      formData.append('key', this.apiKey);
      formData.append('userid', this.userId);
      formData.append('sender', this.sender!);
      formData.append('receiver', receiver.replace(/-/g, '').replace(/'/g, ''));
      formData.append('msg', message);
      formData.append('msg_type', message.length > 90 ? 'LMS' : 'SMS'); // 90바이트 기준

      const response = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('[SMS] Send Result:', result);
      
      return {
        success: result.result_code === '1' || result.result_code === 1,
        data: result
      };
    } catch (error) {
      console.error('[SMS] Fatal Error:', error);
      return { success: false, error };
    }
  }

  /**
   * 팔로업 메시지 발송
   */
  public async sendFollowUp(data: ConsultationData): Promise<boolean> {
    const phone = data.customer.phone;
    if (!phone || phone === '미정') return false;

    const message = `[Smart Travel Pilot] 안녕하세요, ${data.customer.name}님!
요청하신 ${data.trip.destination} 여행 상담 건으로 연락드렸습니다. 
추가로 궁금하신 점이나 도움이 필요하시면 언제든 말씀해 주세요. 감사합니다.`;

    const result = await this.sendSMS(phone, message);
    return result.success;
  }

  /**
   * 리마인드 메시지 발송 (잔금, 안내 등)
   */
  public async sendReminder(data: ConsultationData, type: 'balance' | 'notice'): Promise<boolean> {
    const phone = data.customer.phone;
    if (!phone || phone === '미정') return false;

    let message = '';
    if (type === 'balance') {
      message = `[Smart Travel Pilot] 안녕하세요, ${data.customer.name}님!
예약하신 ${data.trip.destination} 여행의 잔금 기한이 오늘까지입니다. 
확인 후 입금 부탁드립니다. 감사합니다.`;
    } else {
      message = `[Smart Travel Pilot] 안녕하세요, ${data.customer.name}님!
여행 관련 중요 안내 사항이 발송되었습니다. 확인 부탁드립니다. 즐거운 여행 되세요!`;
    }

    const result = await this.sendSMS(phone, message);
    return result.success;
  }
}

export const smsService = SMSService.getInstance();

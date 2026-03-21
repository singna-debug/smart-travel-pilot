import { smsService } from './lib/sms-service';

/**
 * SMS 발송 기능 테스트용 스크립트
 * 환경변수 ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER가 설정되어 있어야 합니다.
 */
async function testSMS() {
  console.log('--- SMS 발송 테스트 시작 ---');
  
  const testData: any = {
    customer: {
      name: '테스트고객',
      phone: '01012345678' // 실제 테스트 시 자신의 번호로 수정 필요
    },
    trip: {
      destination: '제주도',
      product_name: '제주 3박 4일 패키지'
    }
  };

  console.log('1. 팔로업 메시지 테스트...');
  const followUpResult = await smsService.sendFollowUp(testData);
  console.log('결과:', followUpResult ? '성공' : '실패 (환경변수 확인 필요)');

  console.log('\n2. 잔금 리마인드 테스트...');
  const reminderResult = await smsService.sendReminder(testData, 'balance');
  console.log('결과:', reminderResult ? '성공' : '실패');
}

testSMS().catch(console.error);

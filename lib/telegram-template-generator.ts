import { getLocalSettings, getAsyncTenantSettings, LocalTenantSettings } from './tenant-local-store';

export type TemplateType = 
    | 'remind' 
    | 'booking' 
    | 'dotcom' 
    | 'balance' 
    | 'ticket' 
    | 'confirmation' 
    | 'pre_4w' 
    | 'departure' 
    | 'happy_call' 
    | 'china_barcode';

export const TEMPLATE_LIST: { id: TemplateType; label: string; icon: string }[] = [
    { id: 'remind', label: '리마인드', icon: '⏰' },
    { id: 'booking', label: '예약 및 결제', icon: '✅' },
    { id: 'dotcom', label: '닷컴안내', icon: '🌐' },
    { id: 'balance', label: '잔금 안내', icon: '💰' },
    { id: 'ticket', label: '항공권 발권', icon: '🎫' },
    { id: 'confirmation', label: '확정서 안내', icon: '📖' },
    { id: 'pre_4w', label: '출발전 체크사항', icon: '📅' },
    { id: 'departure', label: '출발 안내', icon: '✈️' },
    { id: 'happy_call', label: '해피콜', icon: '📞' },
    { id: 'china_barcode', label: '중국 바코드', icon: '📱' },
];

export interface TemplateContextData {
    customerName?: string;
    customerPhone?: string;
    destination?: string;
    productName?: string;
    productUrl?: string;
    price?: string;
    departureDate?: string;
    returnDate?: string;
    duration?: string;
    travelersCount?: number;
    airline?: string;
    bookingNumber?: string;
    bankAccount?: string;
    bankHolder?: string;
    confirmationLink?: string;
    specialTerms?: string;
    exclusions?: string;
    companyName?: string;
    agentName?: string;
    companyPhone?: string;
    kakaoTalkId?: string;
}

export async function generateTelegramTemplateText(type: TemplateType, data: TemplateContextData, tenantId: string = 'default_tenant'): Promise<string> {
    let local: LocalTenantSettings = {};
    try {
        local = await getAsyncTenantSettings(tenantId);
    } catch (e) {
        console.error('[TemplateGenerator] getAsyncTenantSettings error:', e);
        local = getLocalSettings(tenantId);
    }
    const companyNameRaw = local.companyName || data.companyName || '';
    const agentNameRaw = local.managerName || data.agentName || '';
    const companyPhone = local.phone || data.companyPhone || '';
    const kakaoTalkId = local.kakaoTalkId || data.kakaoTalkId || '';

    const companyName = companyNameRaw ? companyNameRaw : '여행사';
    const agentName = agentNameRaw ? agentNameRaw : (companyNameRaw ? `${companyNameRaw} 담당자` : '담당자');

    const name = data.customerName || '고객';
    const phone = data.customerPhone || '';
    const dest = data.destination || '';
    const url = data.productUrl || '';
    const departureDateDisplay = data.departureDate || '미정';
    const travelersNum = data.travelersCount || 1;
    const price = data.price || '가격 문의';
    const airlineDisplay = data.airline || '';
    const bookingNumber = data.bookingNumber || '(예약번호)';
    const bankAccount = data.bankAccount || (local.bankAccount || '입금 계좌 안내');
    const bankHolder = data.bankHolder || (local.bankHolder || companyName);
    const confirmationLink = data.confirmationLink || url;

    const today = new Date();
    const todayStr = `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}`;

    let contactFooter = `──────────────────\n📞 문의: ${companyName}`;
    if (companyPhone) contactFooter += ` (${companyPhone})`;
    if (kakaoTalkId) contactFooter += `\n💬 카톡 ID: ${kakaoTalkId}`;

    switch (type) {
        case 'remind':
            return `✈️ [${companyName}] 상담 상품 리마인드 (담당: ${agentName})

안녕하세요, ${name}님! ${companyName} ${agentName}입니다. 😊
일전에 상담 도와드린 ${dest ? dest + ' ' : ''}여행 상품은 잘 확인해 보셨을까요?

🔗 기존 안내한 일정 URL : ${url || '(일정표 링크)'}

상품을 살펴보시다 더 궁금하신 점이나 조정이 필요한 부분이 있으시면 언제든 편하게 말씀해 주세요. ${name}님께 가장 꼭 맞고 만족스러운 여행이 되도록 정성껏 다듬어 드리겠습니다.

──────────────────

🏆 믿고 맡길 수 있는 '${companyName}'
✅ 축적된 전문성과 노하우
✅ 언제나 고객 최우선 맞춤 서비스
✅ 합리적 가격의 명품 여행 패키지
✅ 숙련된 담당자의 1:1 전담 상담

신뢰와 전문성으로 완벽한 여행을 약속드립니다.
답장 기다리겠습니다. 감사합니다! ✈️

${contactFooter}`;

        case 'booking':
            return `✈️ [${companyName}] 여행 예약 안내

안녕하세요, ${name}님! ${companyName} ${agentName}입니다. 😊
예약을 진심으로 감사드립니다.
원활한 여행 준비를 위해 주요 사항을 안내해 드립니다.

──────────────────

Ⅰ. 예약 및 결제 정보

1. 예약 정보
- 예약일자 : ${todayStr}
- 예약/여행자 : ${name}님 ${phone ? `${phone} ` : ''}${travelersNum > 0 ? `일행 ${travelersNum}분` : ''}
- 예약번호 : ${bookingNumber}
- 출 발 일 : ${departureDateDisplay}
- 귀 국 일 : ${data.returnDate || ''}
- 항 공 사 : ${airlineDisplay}
- 상세일정 : ${url}
(위 주소를 클릭하시면 일정, 호텔 등 세부 사항을 확인할 수 있습니다.)

──────────────────

2. 상품가 및 결제 안내 (가상계좌 및 카드)
- 상 품 가 : ${price}
- 불 포 함 : ${data.exclusions || '가이드팁, 매너 팁, 개인 경비'}
- 상기 상품은 항공, 현지 호텔이 완료되면 확정됩니다.

- 계  약  금: 1인 50만원 * ${travelersNum}명 (예약 시 안내)
- 최종 잔금: 출발 3주 전 다시 안내드립니다.

──────────────────

3. 결제방법
1) 카드결제: 여행사 계좌 또는 카드 단말기를 통해 결제
2) 계좌입금
${bankAccount}
예  금  주 : ${bankHolder}

──────────────────

Ⅱ. 취소 규정 및 계약 진행 일정

1. 취소료 규정 (국외여행 특별약관)
${data.specialTerms || `- 출발 30일전까지 취소 시 계약금 환급\n- 출발 29~20일전 취소 시 10% 부과\n- 출발 19~10일전 취소 시 15% 부과\n- 출발 9~8일전 취소 시 20% 부과\n- 출발 7~1일전 취소 시 30% 부과\n- 출발 당일 취소 시 50% 부과`}

${contactFooter}`;

        case 'dotcom':
            return `✈️  여행 예약 안내

${name} 고객님, 안녕하세요! 😊
이번 여행의 담당자로 배정된 ${companyName} ${agentName}입니다.

신속한 예약을 위해 현재 항공, 호텔 확인 중이며,
잠시 후 예약 관련 안내를 위해 전화 드리겠습니다.

📋 예약 확인 내역
• 여 행 지 : ${dest || '여행지'}
• 출 발 일 : ${departureDateDisplay}
• 인      원: 총 ${travelersNum}명
• 예약상품 : ${url || '(일정표 링크)'}

기타 궁금하신 점은 아래 연락처로 언제든 편하게 문의해 주세요.
고객님의 즐거운 여행을 위해 정성을 다해 준비하겠습니다!

${contactFooter}`;

        case 'balance':
            return `✈️ [${companyName}] 여행 상품 잔금 결제 안내 (담당: ${agentName})

안녕하세요, ${name}님! ${companyName} ${agentName}입니다. 😊
기다려주신 ${dest} 여행이 이제 곧 시작됩니다!
안전하고 즐거운 여행을 위해 기간 내 잔금 결제 부탁드립니다.

──────────────────

💳 납부 금액
- 상품가: ${price}
──────────────────

📅 납부 기한
- 출발 3주 전까지

──────────────────

💡 결제 방법
1) 계좌 입금
${bankAccount}
예금주 : ${bankHolder}

2) 카드 결제
- 여행사 카드 단말기 또는 담당자 안내에 따라 결제

${contactFooter}`;

        case 'ticket':
            return `✈️ [${companyName}] 항공권 발권 및 좌석 지정 안내

안녕하세요, ${name}님! 
항공권 발권이 완료되었습니다.
편안한 여행을 위해 좌석을 미리 지정하세요.

──────────────────

🪑 좌석 지정 방법
1. 온라인 사전 신청 (항공사 홈페이지)
- 예약번호로 접속하여 좌석 선택
- 출발 1~2일 전 무료 지정 가능

2. 온라인 체크인 (출발 24시간 전)
- 항공사 홈페이지/앱에서 체크인 후 변경 가능

3. 공항 카운터 (당일)
- 잔여 좌석 범위 내에서 조정 요청

──────────────────

📞 문의처: ${airlineDisplay || '해당 항공사 고객센터'}

즐거운 여행 되세요! ✈️`;

        case 'confirmation':
            return `안녕하세요! ${name} 고객님
이번 여행의 모바일 가이드북을 보내드립니다. ✈️

1. 세부 일정은 아래 일정표를 기준으로 움직입니다.
${url}

2. 아래 가이드북은 일정을 바탕으로 고객님의 여행 날짜에 맞게 저희 여행사에서 별도로 만들었습니다. 

📍 날씨 정보
🧳 준비물 
💰 환전 정보
📞 로밍
🗺️ 여행지 가이드 
등을 담았습니다.

출발 전 아래 링크에서 확인하셔서 
즐거운 여행을 만드세요! 🌟
${confirmationLink}`;

        case 'pre_4w':
            return `✈️ [${companyName}] 출발 전 필수 체크사항 안내 

안녕하세요, ${name}님! ${companyName} ${agentName}입니다. 😊
여행 출발이 어느덧 한 달 앞으로 다가왔습니다.
출발 전 확인 사항 안내해 드립니다.

1. 현금영수증
- 현금 결제 부분 발행 가능 (담당자에게 현금영수증 발행 번호 전달)

2. 마일리지 적립 안내
- 출발 전 회원가입 시 마일리지 적립 가능

3. 공항 버스 예약 (필수)
- 광주/지방 출발 고객의 경우 공항버스 사전 예약 필수

${contactFooter}`;

        case 'departure':
            return `✈️ [${companyName}] 드디어 출발! 즐거운 여행 되세요! (담당: ${agentName})

안녕하세요, ${name}님! ${companyName} ${agentName}입니다. 😊
드디어 기다리시던 ${dest} 여행 출발일입니다!

공항에는 항공기 출발 최소 3시간 전에는 도착하셔서 여유 있게 수속하시길 권장드립니다.

설레는 마음 가득 안고 조심히 잘 다녀오세요!
${name}님의 여행이 눈부시게 아름답길 진심으로 응원합니다. ✨

${agentName} 드림 ✈️`;

        case 'happy_call':
            return `✈️ [${companyName}] 여행은 즐거우셨나요? 해피콜 안내 (담당: ${agentName})

안녕하세요, ${name}님! ${companyName} ${agentName}입니다. 😊
${dest} 여행은 무사히 잘 다녀오셨나요? 일상으로 돌아오신 소감이 어떠신지 궁금합니다.

이번 여행이 ${name}님께 소중한 추억으로 남았길 진심으로 바라며,
소중한 여행 후기 한 줄 부탁드립니다. 📝

${agentName} 드림 ✈️`;

        case 'china_barcode':
            return `📱 [${companyName}] 중국 입국 바코드 안내

안녕하세요, ${name}님! ${companyName}입니다.
중국 입국을 위한 모바일 세관 신고 바코드 작성 안내드립니다.

- 작성 시점: 출발 24시간 전~당일
- 제출 장소: 중국 공항 입국장

즐거운 여행 되시기 바랍니다! ✈️`;

        default:
            return `[${companyName}] ${name}님, 여행 안내 메시지입니다.\n일정표: ${url}`;
    }
}

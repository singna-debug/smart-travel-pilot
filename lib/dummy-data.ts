import type { ConsultationData, DetailedProductInfo, SecondaryResearch, MeetingInfo } from '@/types';

// Helper to format dates relative to today
const getRelativeDateStr = (daysOffset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const getRelativeDateStrDot = (daysOffset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
};

// 1. Mock Consultation Data (Dashboard & Chats View)
export const mockConsultations: ConsultationData[] = [
    {
        customer: { name: '김철수', phone: '010-1234-5678' },
        trip: {
            destination: '후쿠오카',
            product_name: '[품격] 후쿠오카/온천 2박3일 실속 패키지 (힐튼호텔 2박)',
            departure_date: getRelativeDateStr(10),
            return_date: getRelativeDateStr(12),
            travelers_count: '2',
            url: 'https://www.modetour.com/product/fukuoka-3d',
            duration: '2박 3일'
        },
        automation: {
            status: '예약확정',
            next_followup: getRelativeDateStr(1),
            recurringCustomer: '신규고객',
            inquirySource: '네이버 블로그',
            confirmed_product: 'https://www.modetour.com/product/fukuoka-3d',
            confirmed_date: getRelativeDateStr(-1),
            prepaid_date: getRelativeDateStr(1) + ' (완료)',
            noticeDate: getRelativeDateStr(3),
            balanceDate: getRelativeDateStr(5),
            confirmation_sent: getRelativeDateStr(7),
            departure_notice: getRelativeDateStr(8),
            phone_notice: getRelativeDateStr(9),
            happy_call: getRelativeDateStr(13)
        },
        sheetRowIndex: 2,
        sheetName: '상담기록',
        sheetGid: 0,
        summary: '가족 여행 목적. 부모님 동반하여 온천 위주 패키지 추천함. 힐튼 숙박 만족도 높음.',
        source: '카카오톡',
        timestamp: new Date().toISOString(),
        visitor_id: 'dummy-chulsoo-123',
        reservation_number: 'DUMMY888',
        confirmation_link: ''
    },
    {
        customer: { name: '이영희', phone: '010-9876-5432' },
        trip: {
            destination: '다낭',
            product_name: '[초특가] 다낭/호이안 3박4일 패키지 (5성급 리조트)',
            departure_date: getRelativeDateStr(15),
            return_date: getRelativeDateStr(18),
            travelers_count: '4',
            url: 'https://www.modetour.com/product/danang-4d',
            duration: '3박 4일'
        },
        automation: {
            status: '상담중',
            next_followup: getRelativeDateStr(0),
            recurringCustomer: '재방문',
            inquirySource: '카카오톡 채널'
        },
        sheetRowIndex: 3,
        sheetName: '상담기록',
        sheetGid: 0,
        summary: '친구 모임 여행. 쇼핑 없는 노옵션 투어 원함. 견적 발송 후 답변 대기 중.',
        source: '텔레그램',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        visitor_id: 'dummy-younghee-456'
    },
    {
        customer: { name: '홍길동', phone: '010-5555-5555' },
        trip: {
            destination: '후쿠오카',
            product_name: '[에어텔] 후쿠오카 텐진 프리스타일 3일',
            departure_date: getRelativeDateStr(5),
            return_date: getRelativeDateStr(7),
            travelers_count: '1',
            url: 'https://www.modetour.com/product/fukuoka-free',
            duration: '2박 3일'
        },
        automation: {
            status: '결제완료',
            next_followup: getRelativeDateStr(2),
            recurringCustomer: '신규고객',
            inquirySource: '인스타그램 및 페이스북',
            confirmed_product: 'https://www.modetour.com/product/fukuoka-free',
            confirmed_date: getRelativeDateStr(-3),
            prepaid_date: getRelativeDateStr(-3) + ' (완료)',
            noticeDate: getRelativeDateStr(-2) + ' (완료)',
            balanceDate: getRelativeDateStr(-1) + ' (완료)',
            confirmation_sent: getRelativeDateStr(1),
            departure_notice: getRelativeDateStr(2),
            phone_notice: getRelativeDateStr(4),
            happy_call: getRelativeDateStr(8)
        },
        sheetRowIndex: 4,
        sheetName: '상담기록',
        sheetGid: 0,
        summary: '나홀로 자유여행. 항공 및 호텔 예약 완료됨. 패스권 추천 완료.',
        source: '웹',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        visitor_id: 'dummy-gildong-789',
        reservation_number: 'DUMMY999'
    }
];

// 2. Fukuoka 3-Day Mock DetailedProductInfo (URL Analysis Result)
export const mockProductInfo: DetailedProductInfo = {
    title: '[품격] 후쿠오카/온천 2박3일 실속 패키지 (힐튼호텔 2박)',
    destination: '후쿠오카',
    price: '899,000원',
    departureDate: getRelativeDateStr(10),
    returnDate: getRelativeDateStr(12),
    departureAirport: '인천국제공항 (ICN)',
    duration: '2박 3일',
    airline: '대한항공 (Korean Air)',
    hotel: '힐튼 후쿠오카 씨호크 (Hilton Fukuoka Sea Hawk) 2박',
    hotels: [
        {
            name: '힐튼 후쿠오카 씨호크',
            address: '2 Chome-2-3 Jigyohama, Chuo Ward, Fukuoka, 810-8650, Japan',
            checkIn: getRelativeDateStr(10),
            checkOut: getRelativeDateStr(12),
            images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=60'],
            amenities: ['무료 Wi-Fi', '실내/야외 수영장', '스파 및 사우나', '피트니스 센터', '한국어 가능 직원']
        }
    ],
    url: 'https://www.modetour.com/product/fukuoka-3d',
    features: ['힐튼 호텔 숙박', '유후인/벳부 핵심 투어 포함', '가마도지옥 족욕 체험', '특식 제공 (모츠나베, 세이로무시)'],
    courses: ['다자이후 텐만구', '유후인 긴린코 호수', '벳부 가마도 지옥'],
    specialOffers: ['가마도지옥 라무네 사이다 및 온천계란 제공', '모바일 여행자 전용 안내 가이드북 발송'],
    inclusions: [
        '왕복 항공료 및 공항 이용료',
        '전용 관광버스 및 기사 경비',
        '한국인 가이드 가이딩 비용',
        '힐튼 호텔 2박 (2인 1실 기준)',
        '일정표 내 명시된 관광지 입장료',
        '일정표 내 명시된 식사 (특식 2회 포함)',
        '1억원 여행자 보험'
    ],
    exclusions: [
        '가이드/기사 경비 (현지 지불: 성인/소아 인당 3,000엔)',
        '개인 매너팁 및 자유 시간 개인 경비',
        '호텔 싱글룸 사용료 (인당 200,000원 추가)'
    ],
    itinerary: [
        {
            day: 1,
            title: '인천 -> 후쿠오카 -> 다자이후',
            date: getRelativeDateStrDot(10) + '(금)',
            route: '인천 -> 후쿠오카 -> 다자이후 -> 호텔',
            timeline: [
                { title: '인천공항 미팅', description: '인천국제공항 제2여객터미널 3층 대한항공 H카운터 앞 가이드 미팅 및 출국 수속' },
                { title: '인천 출발 (KE787)', description: '대한항공 KE787편으로 인천 출발 (비행시간 약 1시간 20분)' },
                { title: '후쿠오카 공항 도착', description: '입국 수속 및 수하물 수령 후 전용 차량 탑승' },
                { title: '다자이후 텐만구 관광', description: '학문의 신을 모시는 신사 관광 및 매화떡 시식' },
                { title: '힐튼 후쿠오카 씨호크 체크인', description: '호텔 체크인 후 휴식 및 자유 시간' }
            ],
            summary: {
                attraction: '다자이후 텐만구',
                hotel: '힐튼 후쿠오카 씨호크',
                meal: '조식: 기내식 / 중식: 우동 정식 / 석식: 호텔 뷔페',
                transport: '전용 관광 버스'
            }
        },
        {
            day: 2,
            title: '유후인 -> 벳부 온천 투어',
            date: getRelativeDateStrDot(11) + '(토)',
            route: '호텔 -> 유후인 -> 벳부 -> 호텔',
            timeline: [
                { title: '호텔 조식', description: '호텔 뷔페식으로 맛있는 조식 식사' },
                { title: '유후인 이동 및 관광', description: '동화 속 마을 같은 민예촌 거리 산책 및 물안개가 피어오르는 긴린코 호수 관람' },
                { title: '벳부 이동 및 점심식사', description: '현지식 세이로무시(편백나무 찜) 식사' },
                { title: '가마도 지옥 온천 체험', description: '신기한 지옥 온천 관람 및 온천 열을 활용한 족욕 체험 (온천 계란과 라무네 사이다 시식)' },
                { title: '호텔 복귀 및 석식', description: '후쿠오카로 복귀하여 모츠나베(곱창전골) 특식 후 호텔 투숙' }
            ],
            summary: {
                attraction: '유후인 긴린코 호수, 벳부 가마도지옥',
                hotel: '힐튼 후쿠오카 씨호크',
                meal: '조식: 호텔식 / 중식: 세이로무시 / 석식: 모츠나베 특식',
                transport: '전용 관광 버스'
            }
        },
        {
            day: 3,
            title: '쇼핑 -> 후쿠오카 -> 인천',
            date: getRelativeDateStrDot(12) + '(일)',
            route: '호텔 -> 캐널시티 -> 후쿠오카 -> 인천',
            timeline: [
                { title: '호텔 조식 및 체크아웃', description: '조식 식사 후 체크아웃 수속 완료' },
                { title: '캐널시티 하카타 자유시간', description: '대형 복합 쇼핑몰에서 인공 운하 분수쇼 관람 및 자유 쇼핑/점심식사' },
                { title: '후쿠오카 공항 이동', description: '공항 이동 후 출국 및 보딩 수속' },
                { title: '후쿠오카 출발 (KE788)', description: '대한항공 KE788편으로 후쿠오카 출발' },
                { title: '인천공항 도착 및 해산', description: '인천국제공항 도착 후 수하물 수령 및 귀가' }
            ],
            summary: {
                attraction: '캐널시티 하카타',
                hotel: '귀국 (숙박 없음)',
                meal: '조식: 호텔식 / 중식: 자유식 / 석식: 기내식',
                transport: '전용 관광 버스 및 항공기'
            }
        }
    ],
    keyPoints: ['힐튼 5성급 숙박 만족도 최상', '인기 온천 유후인/벳부 하루 만에 완벽 정복', '쇼핑 및 옵션 최소화로 여유로운 여행'],
    hashtags: '#후쿠오카 #온천여행 #힐튼호텔 #유후인 #벳부 #가족여행',
    hasNoOption: true,
    hasFreeSchedule: true,
    flightCode: 'KE787',
    departureFlightNumber: 'KE787',
    returnFlightNumber: 'KE788',
    departureTime: '08:00',
    arrivalTime: '09:20',
    returnDepartureTime: '20:00',
    returnArrivalTime: '21:25',
    departureSegments: [
        {
            airline: '대한항공',
            flightNo: 'KE787',
            departureCity: '서울/인천(ICN)',
            departureTime: '08:00',
            arrivalCity: '후쿠오카(FUK)',
            arrivalTime: '09:20',
            duration: '1시간 20분'
        }
    ],
    returnSegments: [
        {
            airline: '대한항공',
            flightNo: 'KE788',
            departureCity: '후쿠오카(FUK)',
            departureTime: '20:00',
            arrivalCity: '서울/인천(ICN)',
            arrivalTime: '21:25',
            duration: '1시간 25분'
        }
    ],
    meetingInfo: [
        {
            type: '미팅안내',
            location: '인천국제공항 1터미널 3층 출국장 14번 출구 앞(N카운터 옆 창측) 여행사카운터 9~10번 테이블 "모두투어"',
            time: '출발 2시간 30분 전 미팅',
            description: '모두투어 전용 샌딩 카운터(9~10번 테이블)에서 안내원 미팅 후 출국 수속을 진행해 주시기 바랍니다.',
            imageUrl: 'https://img.modetour.com/tourinfo/meeting/icn_t1_mode.jpg'
        }
    ]
};

// 3. Fukuoka Mock SecondaryResearch
export const mockSecondaryResearch: SecondaryResearch = {
    currency: {
        localCurrency: 'JPY',
        currencySymbol: '¥',
        calculationTip: '엔화 금액 뒤에 0을 붙이면 대략적인 한화(KRW) 가치와 비슷합니다. 예: 1,000엔은 약 10,000원 수준입니다.',
        exchangeTip: '일본은 대다수 백화점과 대형 상점에서 카드를 지원하지만, 전통 시장이나 소규모 맛집, 자판기 등은 오직 현금만 받는 경우가 아주 흔합니다. 1인당 하루 최소 3,000엔 ~ 5,000엔 정도의 엔화 지폐 및 동전을 준비하는 것이 편리합니다.',
        tipCulture: '일본에는 팁 문화가 전혀 존재하지 않습니다. 잔돈을 고맙다는 표시로 테이블에 남겨두면 직원이 두고 간 돈이라며 공항이나 거리까지 뒤쫓아와서 돌려주는 경우가 빈번하니 팁은 주지 않으셔야 합니다.',
        targetCodes: ['JPY']
    },
    roaming: {
        description: '국내 통신 3사의 일일 로밍 패스 요금제 또는 현지 통신망(Softbank, Docomo)을 사용하는 e-SIM/도시락 eSIM을 추천합니다.',
        carriers: 'Softbank / NTT Docomo',
        simEsim: '포켓 와이파이는 여럿이 쓰기에 경제적이지만 충전 무거움이 있습니다. 최근에는 유심 교체 필요 없는 간편한 e-SIM 사용이 가장 큰 인기입니다.',
        roamingTip: '벳부나 유후인으로 이동하는 고속도로 터널 구간이나 산간 지역에서는 모바일 신호가 일시적으로 약해지거나 끊길 수 있으니 구글 지도 오프라인 모드나 대략적인 경로를 미리 캡처해두면 편리합니다.'
    },
    weather: {
        summary: '현재 후쿠오카의 날씨는 매우 화창하며 여행하기에 아주 쾌적한 온도 분포를 보여주고 있습니다. 아침저녁 일교차가 다소 있을 수 있으므로 가벼운 바람막이나 얇은 카디건을 준비해 주세요.',
        forecast: [
            { date: '1일차', tempMin: '16°C', tempMax: '24°C', description: '맑음', icon: '☀️' },
            { date: '2일차', tempMin: '15°C', tempMax: '25°C', description: '구름조금', icon: '⛅' },
            { date: '3일차', tempMin: '17°C', tempMax: '23°C', description: '맑음', icon: '☀️' }
        ],
        clothingTips: [
            { title: '기본 복장 추천', content: '낮 시간대에는 반소매나 얇은 긴소매 옷차림이 알맞습니다.' },
            { title: '여분 아우터 필수', content: '온천 지역인 유후인과 벳부는 고지대에 있어 후쿠오카 시내보다 기온이 2~3도 낮고 산바람이 붑니다. 걸칠 외투를 챙기세요.' }
        ],
        packingSummary: '선글라스, 우산 겸 양산, 온천 및 족욕 후 젖은 발을 닦을 작은 휴대용 미니 타월'
    },
    customs: {
        warningTitle: '아이코스 등 궐련형 전자담배 반입 주의',
        warningContent: '일본으로 입국 시 아이코스, 릴 등의 궐련형 전자담배는 액상형/스틱 포함 면세 한도가 제한적입니다. 특히 대량 반입 시 관세 과세 대상이 될 수 있으니 주의 바랍니다. 일반적인 자가 사용 목적의 1~2개 기기는 세관 신고 없이 통과 가능합니다.',
        minorEntry: '만 18세 미만 미성년자가 부모 동반 없이 제3자(가이드 혹은 인솔자 등)와 입국 시 법적인 서류 요건은 없으나, 영문 가족관계증명서 지참을 권장합니다.',
        minorDetail: '일본은 미성년자 단독 입국에 대해 필리핀이나 베트남만큼 규정이 까다롭지 않으나, 부모가 작성하고 서명한 서약서(영문)와 가족관계를 입증할 영문 등본을 만약을 대비해 준비하면 매우 안심할 수 있습니다.',
        dutyFree: '면세 범위: 주류 3병(병당 760ml 이하), 담배 200개비(전자담배 포함), 향수 2온스(약 56ml), 기타 휴대용 물품 가격 합계 20만엔 이하.',
        passportNote: '유효기간은 일본 체류 예정 기간 동안 만료되지 않고 유효하면 법적으로 입국 가능하나, 통상 출발일 기준 최소 3개월 이상의 여유 잔여기간을 두는 것이 권장됩니다.',
        links: [
            {
                label: '비지트 재팬 웹 (Visit Japan Web) 등록',
                url: 'https://vjw-lp.digital.go.jp/ko/',
                type: 'arrival_card',
                description: '일본 입국 시 필수적인 입국심사서와 세관신고를 사전에 한 번에 등록하여 QR코드로 신속히 통과할 수 있는 온라인 서비스입니다.',
                howTo: '출발 최소 24시간 전에 회원가입 후 여행 정보 및 건강 상태, 여권 정보를 입력하여 노란색/파란색 QR코드를 생성하고 모바일에 저장하세요.'
            }
        ],
        majorAlert: {
            title: '육류 가공품(육포, 소시지, 만두 등) 절대 반입 금지',
            content: '일본 가축전염병 예방업법에 따라 한국에서 제조된 생고기는 물론, 육포, 소시지, 어묵, 만두 등 고기가 함유된 가공식품은 수하물/기내 반입이 일절 금지됩니다.',
            penalty: '위반 적발 시 최대 300만 엔 이하의 벌금 또는 3년 이하의 징역형에 처할 수 있으므로, 김밥 등 간식에 고기가 포함되었는지 꼭 확인하세요.'
        },
        prohibitedItems: [
            {
                category: '절대 반입 금지 및 검역 품목',
                items: ['모든 축산물 및 가공품 (육포, 햄, 장조림 등)', '사과, 배, 귤, 고추 등 신선 과일 및 채소류 일체', '흙이 묻은 모든 식물이나 모종', '위조 상표 및 짝퉁 제품 (지식재산권 침해 물품)']
            }
        ],
        arrivalProcedure: {
            title: '일본 후쿠오카 공항 입국 절차',
            timing: '공항 착륙 직후부터 세관 검사대 통과까지',
            steps: [
                { step: '1단계: 비행기 하차 및 검역', description: '기내에서 내린 후 검역관들의 지시에 따라 열화상 카메라 통과 (체온 측정)' },
                { step: '2단계: 지문 등록 및 입국 심사', description: '입국 심사대에서 양손 검지 손가락 지문을 스캔하고 안면 사진 촬영. 비지트 재팬 웹 QR코드 또는 지면 입국카드를 여권과 함께 제시' },
                { step: '3단계: 수하물 수령', description: '항공편 전광판을 확인하고 위탁 수하물이 나오는 수하물 컨베이어 벨트에서 본인 짐을 찾음' },
                { step: '4단계: 세관 검사', description: '세관신고서(비지트 재팬 웹 QR 세관용)를 세관 무인 키오스크에 스캔한 후 출구를 통해 통과' }
            ]
        }
    },
    landmarks: [
        {
            name: '다자이후 텐만구',
            nameLocal: '太宰府天満宮',
            description: '학문과 문화, 액막이의 신인 스가와라 미치자네를 모시는 신사입니다. 매년 합격 기원을 위해 수많은 수험생과 관광객이 몰려들며, 신사 내에는 행운을 가져다주는 소 동상과 유명한 매화나무가 있습니다. 신사 입구 상점가에서 파는 구운 찹쌀떡인 우메가에모치(매화떡)를 맛보세요.',
            imageUrl: 'https://images.unsplash.com/photo-1542044896530-05d85be9b11a?w=800&auto=format&fit=crop&q=60'
        },
        {
            name: '유후인 긴린코 호수',
            nameLocal: '金鱗湖',
            description: '호수 바닥에서 따뜻한 온천수와 차가운 지하수가 동시에 솟아올라 일교차가 큰 가을과 겨울 아침이 되면 환상적인 물안개가 피어오르는 유후인의 명물 호수입니다. 호수 주변으로 울창한 숲과 아기자기한 미술관, 카페가 어우러져 있어 한적한 산책을 즐기기에 완벽한 힐링 스폿입니다.',
            imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&auto=format&fit=crop&q=60'
        },
        {
            name: '캐널시티 하카타',
            nameLocal: 'キャナルシティ博多',
            description: '약 180m 길이의 인공 운하를 중심으로 쇼핑몰, 영화관, 극장, 어뮤즈먼트 시설, 두 개의 호텔이 모여 있는 초대형 복합 상업 시설입니다. 매시간 펼쳐지는 음악과 화려한 물줄기의 분수쇼가 명물이며, 라멘 스타디움 등 유명 맛집과 브랜드들이 밀집해 있어 쇼핑과 미식을 한 번에 즐길 수 있습니다.',
            imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=60'
        }
    ],
    baggage: {
        checkedWeight: '23kg',
        carryonWeight: '10kg',
        checkedNote: '대한항공 일반석 기준 위탁 수하물은 1인당 1개 23kg(가로/세로/높이 삼변의 합이 158cm 이내) 가능합니다. 등산용 칼, 손톱깎이, 면도칼 등 날카로운 물품과 100ml 초과의 액체류, 크림, 젤 등은 기내 반입이 일절 불가능하므로 반드시 캐리어에 담아 위탁 수하물로 부치셔야 합니다.',
        carryonNote: '기내 휴대 가방은 1인당 1개 10kg(노트북 가방 혹은 핸드백 1개 추가 가능) 이내로 반입할 수 있습니다. 스마트폰/노트북용 보조배터리, 일회용 가스라이터(1인당 1개 한정), 궐련형/액상형 전자담배는 화재 위험으로 위탁 수하물 반입이 법적으로 엄격히 제한되므로, 반드시 직접 몸에 소지하거나 기내 휴대 가방에 넣어 기내에 타셔야 합니다.',
        additionalNotes: [
            '보조배터리가 캐리어 내부에 있을 경우 엑스레이 검사에서 적발되어 수하물 처리가 지연되거나 강제 개봉 검사를 받을 수 있습니다. 짐을 보내기 전 반드시 한 번 더 가방 속을 확인하세요.',
            '액체류 기내 휴대 시에는 개별 100ml 이하의 용기에 담아 1리터 크기의 투명 지퍼백 1개에 담아야 반입이 가능합니다.'
        ]
    },
    customGuides: [
        {
            topic: '일본 돈키호테 면세/할인 꿀팁',
            icon: '🛍️',
            sections: [
                {
                    title: '면세 적용 조건',
                    type: 'list',
                    items: [
                        '하루 한 매장에서 순수 구입 금액이 세금 제외 5,000엔 이상 시 가능 (세금 포함 5,500엔)',
                        '반드시 여권 원본을 지참하셔야 합니다. (복사본이나 스마트폰 사진은 면세 불가)',
                        '일본 국내에서 소비하지 않고 개봉하지 않은 상태로 국외로 반출해야 합니다.'
                    ]
                },
                {
                    title: '면세 및 추가 할인 스텝',
                    type: 'steps',
                    steps: [
                        { step: '1단계: 장바구니 쇼핑', detail: '돈키호테 매장 내에서 일반 물품(의류, 가전 등)과 소모품(의약품, 화장품, 식품)을 쇼핑합니다.' },
                        { step: '2단계: 면세 전용 카운터 대기', detail: '돈키호테 내부의 "Tax-Free Counter"라고 쓰인 전용 계산대로 이동합니다.' },
                        { step: '3단계: 여권 제시 및 계산', detail: '계산 시 직원에게 면세 혜택과 카카오톡 등으로 제공받은 돈키호테 5% 모바일 추가 할인 쿠폰 화면을 함께 보여줍니다.' },
                        { step: '4단계: 비닐 밀봉 포장', detail: '면세 처리된 물품은 한국 귀국 전까지 개봉 불가하도록 특수 비닐에 밀봉해 줍니다. 일본 내에서 뜯지 않도록 주의하세요.' }
                    ]
                }
            ]
        }
    ]
};

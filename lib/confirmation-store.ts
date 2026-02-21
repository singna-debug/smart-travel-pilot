import type { ConfirmationDocument } from '@/types';

/**
 * 확정서 데이터 인메모리 저장소
 * 프로토타입용. 프로덕션에서는 Supabase 또는 Google Sheets로 교체.
 */
const store = new Map<string, ConfirmationDocument>();

/** 데모 확정서 (서버 재시작 시에도 항상 존재) */
const DEMO_DOC: ConfirmationDocument = {
    id: 'CF-DEMO',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reservationNumber: 'STP-2026-0222',
    status: '예약확정',
    customer: { name: '김지연', phone: '010-1234-5678' },
    trip: {
        productName: '[발리 5일] 우붓 & 울루와뚜 핵심일주',
        productUrl: 'https://www.modetour.com/package/bali-sample',
        destination: '인도네시아 발리',
        departureDate: '2026-03-15',
        returnDate: '2026-03-19',
        duration: '4박 5일',
        travelers: [
            { name: '김지연', type: 'adult' },
            { name: '박민수', type: 'adult' },
            { name: '김하윤', type: 'child' },
        ],
        adultCount: 2,
        childCount: 1,
        infantCount: 0,
    },
    flight: {
        airline: '가루다 인도네시아항공',
        departureAirport: '인천(ICN)',
        departureTime: '09:30',
        arrivalTime: '15:40',
        returnDepartureTime: '22:50',
        returnArrivalTime: '07:10+1',
    },
    hotel: {
        name: 'The Westin Resort & Spa Ubud, Bali',
        address: 'Jl. Lod Tunduh, Ubud, Gianyar, Bali 80571',
        checkIn: '14:00',
        checkOut: '12:00',
        images: [
            'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=80',
            'https://images.unsplash.com/photo-1573790387438-4da905039392?w=800&q=80',
            'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800&q=80',
        ],
        amenities: ['수영장', '스파', '조식 포함', '무료 Wi-Fi', '공항 셔틀', '피트니스 센터', '레스토랑', '발레파킹'],
    },
    itinerary: [
        {
            day: 'Day 1',
            date: '3/15 (일)',
            title: '인천 출발 → 발리 도착',
            activities: ['인천국제공항 집합 및 출국수속', '가루다 인도네시아항공 탑승 (09:30)', '발리 응우라라이 국제공항 도착 (15:40)', '호텔 체크인 및 자유시간'],
            meals: { breakfast: '불포함', lunch: '기내식', dinner: '호텔 뷔페' },
            hotel: 'The Westin Resort & Spa Ubud',
        },
        {
            day: 'Day 2',
            date: '3/16 (월)',
            title: '우붓 문화 탐방',
            activities: ['테갈랄랑 라이스 테라스 관광', '우붓 왕궁 & 우붓 시장', '몽키포레스트 산책', '전통 발리 댄스 공연 관람'],
            meals: { breakfast: '호텔 조식', lunch: '현지식 (나시고렝)', dinner: '씨푸드 레스토랑' },
            hotel: 'The Westin Resort & Spa Ubud',
        },
        {
            day: 'Day 3',
            date: '3/17 (화)',
            title: '화산 & 온천 투어',
            activities: ['킨타마니 화산 전망대', '바투르 온천 체험', '티르타엠풀 사원 (신성한 샘물 사원)', '스타벅스 발리 리저브 방문'],
            meals: { breakfast: '호텔 조식', lunch: '화산 전망 레스토랑', dinner: '자유식' },
            hotel: 'The Westin Resort & Spa Ubud',
        },
        {
            day: 'Day 4',
            date: '3/18 (수)',
            title: '울루와뚜 & 해변',
            activities: ['울루와뚜 사원 (절벽 사원)', '판다와 비치 자유시간', '짐바란 해변 일몰 감상', '짐바란 씨푸드 바베큐 디너'],
            meals: { breakfast: '호텔 조식', lunch: '현지식', dinner: '짐바란 BBQ' },
            hotel: 'The Westin Resort & Spa Ubud',
        },
        {
            day: 'Day 5',
            date: '3/19 (목)',
            title: '자유시간 & 귀국',
            activities: ['호텔 체크아웃 후 자유시간', '쿠타 지역 쇼핑 (비치워크 몰)', '공항 이동 및 출국수속', '발리 출발 (22:50)'],
            meals: { breakfast: '호텔 조식', lunch: '자유식', dinner: '자유식' },
            hotel: '',
        },
    ],
    inclusions: [
        '왕복 항공권 (가루다 인도네시아항공)',
        '공항↔호텔 왕복 픽업',
        '4성급 호텔 4박 (2인 1실 기준)',
        '조식 4회 포함',
        '일정표 내 관광지 입장료',
        '전 일정 전용 차량 & 한국어 가이드',
        '여행자보험',
    ],
    exclusions: [
        '개인 경비 (쇼핑, 간식 등)',
        '가이드 & 기사 팁 (1인 $5/일 권장)',
        '선택 관광 비용',
        'PCR 검사비 (필요 시)',
    ],
    notices: '• 여권 유효기간 6개월 이상 필수\n• 발리 도착 비자(VOA) 현장 구매 $35\n• 자외선 차단제, 모자, 편한 신발 준비\n• 사원 방문 시 긴 바지/사롱 필수 (현장 대여 가능)',
    checklist: '여권 (유효기간 6개월 이상)\n여권 사본 2부\n증명사진 2매\n달러 현금 (팁 & VOA용 $100 이상)\n자외선 차단제 / 모자\n상비약 (소화제, 지사제 등)\n수영복 / 비치타올\n우천 대비 우산·우의\n멀티 어댑터 (C타입)',
    cancellationPolicy: '출발 30일 전: 전액 환불\n출발 29~20일 전: 여행경비 10% 공제\n출발 19~10일 전: 여행경비 15% 공제\n출발 9~8일 전: 여행경비 20% 공제\n출발 7~1일 전: 여행경비 30% 공제\n출발 당일: 여행경비 50% 공제',
    files: [],
};

// 시작 시 데모 문서 자동 등록
store.set(DEMO_DOC.id, DEMO_DOC);

export const confirmationStore = {
    get: (id: string) => store.get(id),
    set: (id: string, doc: ConfirmationDocument) => store.set(id, doc),
    delete: (id: string) => store.delete(id),
    list: () => Array.from(store.values()),
    has: (id: string) => store.has(id),
};

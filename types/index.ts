// 상담 데이터 타입
export interface ConsultationData {
  customer: {
    name: string;
    phone: string;
  };
  trip: {
    destination: string;
    product_name: string;
    departure_date: string;
    return_date?: string;
    travelers?: string;
    travelers_count?: string;     // 총인원 (연락처 다음 컬럼)
    url: string;
    duration?: string;
  };
  automation: {
    status: '상담중' | '예약확정' | '선금완료' | '잔금완료' | '여행완료' | '취소/보류' | string;
    next_followup: string;        // 차기 팔로업일
    recurringCustomer?: string;    // 재방문여부
    inquirySource?: string;       // 유입경로 (인사이트)
    confirmed_product?: string;   // 확정상품 URL
    confirmed_date?: string;      // 예약확정일
    prepaid_date?: string;        // 선금일 (확정+2일)
    notice_date?: string;         // 출발전안내(4주)
    balance_date?: string;        // 잔금일 (출발-3주)
    confirmation_sent?: string;   // 확정서 발송 (출발-2주)
    departure_notice?: string;    // 출발안내 (출발-3일)
    phone_notice?: string;        // 전화 안내 (출발-1일)
    happy_call?: string;          // 해피콜 (귀국+1일)
    balance_due_date?: string;    // (구) 잔금기한 - 호환성 유지
    inquiry_info_backup?: string; // 원본 문의 정보 백업 (AA열)
  };
  sheetRowIndex?: number;
  sheetName?: string;
  sheetGid?: number;
  summary?: string;
  source?: '카카오톡' | '웹' | '대시보드' | '직접입력' | string;
  timestamp?: string;
  visitor_id?: string;
  specific_reminder_date?: string;
  reservation_number?: string; // 예약번호 (AC열)
}

// 채팅 메시지 타입
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  consultationData?: ConsultationData;
}

// 카카오 스킬 요청 타입
export interface KakaoSkillRequest {
  intent: {
    id: string;
    name: string;
  };
  userRequest: {
    timezone: string;
    params: {
      ignoreMe: string;
    };
    block: {
      id: string;
      name: string;
    };
    utterance: string;
    lang: string;
    user: {
      id: string;
      type: string;
      properties: Record<string, string>;
    };
    callbackUrl?: string; // 카카오 콜백 URL (비동기 응답용)
  };
  bot: {
    id: string;
    name: string;
  };
  action: {
    name: string;
    clientExtra: Record<string, unknown>;
    params: Record<string, string>;
    id: string;
    detailParams: Record<string, { origin: string; value: string; groupName: string }>;
  };
}

// 카카오 스킬 응답 타입
export interface KakaoSkillResponse {
  version: string;
  template: {
    outputs: Array<{
      simpleText?: { text: string };
      simpleImage?: { imageUrl: string; altText: string };
      basicCard?: {
        title: string;
        description: string;
        thumbnail?: { imageUrl: string };
        buttons?: Array<{ label: string; action: string; webLinkUrl?: string }>;
      };
    }>;
    quickReplies?: Array<{
      messageText: string;
      action: string;
      label: string;
    }>;
  };
  useCallback?: boolean; // 비동기 응답 여부
}

// URL 크롤링 결과 타입
export interface TravelProductInfo {
  title: string;
  price: string;
  inclusions: string[];
  exclusions: string[];
  itinerary: string[];
  departureDate?: string;
  destination?: string;
  hasNoOption?: boolean;
  hasFreeSchedule?: boolean;
}

export interface DetailedProductInfo {
  title: string;
  destination: string;
  price: string;
  departureDate: string;
  departureAirport: string;
  duration: string;
  airline: string;
  hotel: string; // 기존 단일 호텔 필드 (요약용)
  hotels?: HotelInfo[]; // 다중 호텔 지원
  url: string;
  features: string[];
  courses: string[];
  specialOffers: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: ItineraryDay[];
  keyPoints: string[];
  hashtags: string;
  hasNoOption: boolean;
  hasFreeSchedule: boolean;
  flightCode?: string;
  departureFlightNumber?: string;
  returnFlightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  returnDepartureTime?: string;
  returnArrivalTime?: string;
  departureSegments?: FlightSegment[];
  returnSegments?: FlightSegment[];
  returnDate?: string;
  isProduct?: boolean;
  index?: number;
  meetingInfo?: MeetingInfo[];
  description?: string;
  notices?: string[];
  specialTerms?: string;
  baggageNote?: string;
}

// URL 분석기 단일 결과 타입
export interface SingleResult {
  raw: DetailedProductInfo;
  formatted: string;
  recommendation: string;
}

// URL 다중 분석 결과 항목 타입
export interface AnalysisResult {
  url: string;
  index: number;
  raw: DetailedProductInfo;
  formatted: string;
}

// 확정서 업로드 파일 타입
export interface DocumentFile {
  id: string;
  name: string;
  type: 'boarding_pass' | 'visa' | 'insurance' | 'other';
  label: string;
  url: string;
  uploadedAt: string;
}

// 여행자 정보
export interface TravelerInfo {
  name: string;
  type: 'adult' | 'child' | 'infant';
}

// 호텔 기본 정보
export interface HotelInfo {
  name: string;
  address: string;
  checkIn: string;
  checkOut: string;
  images?: string[];
  amenities?: string[];
}

export interface FlightSegment {
  airline: string;
  flightNo: string;
  departureCity: string;
  departureTime: string;
  arrivalCity: string;
  arrivalTime: string;
  duration?: string;
  layoverDuration?: string;
}

// 모바일 확정서 데이터
export interface ConfirmationDocument {
  id: string;
  createdAt: string;
  updatedAt: string;

  // 예약 기본 정보
  reservationNumber: string;
  status: '결제완료' | '예약확정' | '확정';

  // 고객 정보
  customer: {
    name: string;
    phone: string;
  };

  // 여행 정보
  trip: {
    productName: string;
    productUrl: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    duration: string;
    travelers: TravelerInfo[];
    adultCount: number;
    childCount: number;
    infantCount: number;
  };

  // 항공 정보
  flight: {
    airline: string;
    departureAirport: string;
    departureFlightNumber?: string;
    departureTime: string;
    arrivalTime: string;
    returnFlightNumber?: string;
    returnDepartureTime: string;
    returnArrivalTime: string;
    departureSegments?: FlightSegment[];
    returnSegments?: FlightSegment[];
  };

  // 숙박 정보
  hotels: HotelInfo[]; // 다중 호텔 지원

  // 일정표 (URL 분석에서 가져옴)
  itinerary: any[];

  // 포함/불포함
  inclusions: string[];
  exclusions: string[];

  // 관리자 메모
  notices: string;
  checklist: string;
  cancellationPolicy: string;

  // 업로드 서류
  files: DocumentFile[];

  // 상품 분석 원본 데이터
  productData?: DetailedProductInfo;

  // 2차 조사 결과
  secondaryResearch?: SecondaryResearch;

  // 미팅 및 수속 정보
  meetingInfo?: MeetingInfo[];
}

// 2차 조사 결과 데이터
export interface SecondaryResearch {
  // 환전 및 결제
  currency: {
    localCurrency: string;       // VND
    currencySymbol: string;      // ₫
    calculationTip: string;
    exchangeTip: string;
    tipCulture: string;
    targetCodes?: string[];      // 계산기용 통화 코드 (예: ["EUR", "DKK"])
  };
  // 로밍·통신
  roaming: {
    description: string;          // 로밍 개요 설명
    carriers: string;
    simEsim: string;
    roamingTip?: string;          // 통신 꿀팁 (예: 산간지역 신호 약함)
  };
  // 날씨 및 복장
  weather?: {
    summary: string;
    forecast: {
      date: string;
      tempMin: string;
      tempMax: string;
      description: string;
    }[];
    clothingTips: {
      title: string;
      content: string;
    }[];
    packingSummary: string;
  };
  // 입국·세관
  customs: {
    warningTitle: string;        // 예: "전자담배 절대 반입 금지"
    warningContent: string;      // 경고 상세
    minorEntry: string;          // 미성년자 입국 서류 (간략)
    minorDetail?: string;        // 미성년자 상세 서류/공증 가이드
    dutyFree: string;            // 면세 한도
    passportNote: string;        // 여권 유의사항
    links?: {
      label: string;
      url: string;
      type: 'visa' | 'arrival_card' | 'customs' | 'other';
      description?: string;     // 어떨 때 필요한지 (When)
      howTo?: string;           // 신청 방법 (How)
    }[];
    // 추가된 정밀 필드
    majorAlert?: {
      title: string;             // 예: "육류 가공품 반입 절대 금지"
      content: string;
      penalty?: string;          // 예: "최소 20만 TWD 벌금"
    };
    prohibitedItems?: {
      category: string;         // 예: "절대 반입 금지 (검역 대상)"
      items: string[];
      note?: string;
    }[];
    arrivalProcedure?: {
      title: string;            // 예: "온라인 입국신고서 (Arrival Card)"
      timing?: string;          // 예: "입국일 기준 3일 이내"
      steps: {
        step: string;
        description: string;
      }[];
    };
  };
  // 여행지·관광지 소개
  landmarks: LandmarkInfo[];
  // 수하물 규정
  baggage: BaggageInfo;
  // 커스텀 가이드 섹션들
  customGuides: CustomGuideSection[];
}

export interface ItineraryStep {
  title: string;
  description?: string;
  icon?: 'location' | 'flight' | 'meal' | 'note' | 'default';
  isBold?: boolean;
}

export interface ItineraryDay {
  day: number | string;
  title: string;
  date?: string;   // 예: "2026/06/26(금)"
  route?: string;  // 예: "인천 -> 도야"
  timeline: (string | ItineraryStep)[]; // 하이브리드 지원 (구조화 데이터 우선)
  summary: {
    attraction: string;
    hotel: string;
    meal: string;
    transport: string;
  };
  // 호환성을 위한 구 필드 보관
  activities?: string[];
  transport?: any;
  meals?: any;
}

export interface LandmarkInfo {
  name: string;                  // 한국어 이름
  nameLocal?: string;            // 현지어 이름
  description: string;
  imageUrl?: string;             // 이미지 URL (생성/검색)
}

export interface BaggageInfo {
  checkedWeight: string;         // "15kg" 또는 "23kg"
  carryonWeight: string;         // "10kg" 또는 "7kg"
  checkedNote: string;           // 위탁 수하물 상세
  carryonNote: string;           // 기내 수하물 상세
  additionalNotes: string[];     // 추가 주의사항
}

export interface CustomGuideSection {
  topic: string;                 // 주제
  icon: string;                  // 이모지 아이콘
  sections: CustomGuideSubSection[];
}

export interface CustomGuideSubSection {
  title: string;
  type: 'steps' | 'table' | 'list' | 'text' | 'route';
  content?: string;              // text 타입
  items?: string[];              // list 타입
  steps?: { step: string; detail: string }[];         // steps 타입
  headers?: string[];            // table 타입
  rows?: string[][];             // table 타입
  route?: string[];              // route 타입
}

export interface MeetingInfo {
  type: '미팅장소' | '수속카운터';
  location: string;
  time: string;
  description: string;
  imageUrl?: string;
}

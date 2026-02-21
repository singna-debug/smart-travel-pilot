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
    url: string;
    duration?: string;
  };
  automation: {
    status: '상담중' | '견적제공' | '예약확정' | '결제완료' | '상담완료' | '취소' | '관리자확인필요';
    balance_due_date: string;
    notice_date: string;
    next_followup: string;
  };
  sheetRowIndex?: number;
  sheetName?: string;
  sheetGid?: number;
  summary?: string;
  source?: '카카오톡' | '웹' | '대시보드' | '직접입력' | string;
  timestamp?: string;
  visitor_id?: string;
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
  hotel: string;
  url: string;
  features: string[];
  courses: string[];
  specialOffers: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: any[];
  keyPoints: string[];
  hashtags: string;
  hasNoOption: boolean;
  hasFreeSchedule: boolean;
  isProduct?: boolean;
  index?: number;
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
    departureTime: string;
    arrivalTime: string;
    returnDepartureTime: string;
    returnArrivalTime: string;
  };

  // 숙박 정보
  hotel: HotelInfo;

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
}

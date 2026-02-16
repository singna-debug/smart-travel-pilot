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
  summary?: string;
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
}

import { ConsultationData } from '@/types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { crawlTravelProduct, formatProductInfo } from './url-crawler';
import { calculateAutomationDates, extractDateFromText, getTodayString } from './date-calculator';
import { SYSTEM_INSTRUCTION } from './knowledge';
import { supabase } from './supabase';
import fs from 'fs';
import path from 'path';

const debugLog = (msg: string) => {
    try {
        const logPath = path.join(process.cwd(), 'debug.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) { console.error(e); }
};

// Gemini AI 초기화
const apiKey = (process.env.GEMINI_API_KEY || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
if (!apiKey) {
    console.error('[AI Engine] GEMINI_API_KEY가 설정되지 않았습니다!');
}
const genAI = new GoogleGenerativeAI(apiKey);
const modelName = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';
const model = genAI.getGenerativeModel({ model: modelName }); // 환경변수에서 모델명을 가져옴

// 대화 컨텍스트 (메모리)
const conversationContexts = new Map<string, {
    history: { role: 'user' | 'model'; parts: string }[];
    consultation: ConsultationData;
    lastActive: number;
}>();

/**
 * Supabase에서 관련 상품 검색
 */
async function findRelevantProducts(query: string): Promise<string> {
    if (!supabase) return '';

    // 간단한 키워드 추출 (공백 기준)
    const keywords = query.split(/\s+/).filter(k => k.length > 1);
    if (keywords.length === 0) return '';

    // OR 검색 조건 생성
    const orCondition = keywords.map(k => `title.ilike.%${k}%,description.ilike.%${k}%,keywords.cs.{${k}}`).join(',');

    const { data, error } = await supabase
        .from('products')
        .select('title, description, price, url')
        .or(orCondition)
        .limit(3);

    if (error || !data || data.length === 0) return '';

    return data.map(p =>
        `[상품명: ${p.title}]\n- 내용: ${p.description}\n- 가격: ${p.price || '문의'}\n- 링크: ${p.url || '없음'}`
    ).join('\n\n');
}

/**
 * AI 응답 생성 (Gemini Pro 사용)
 */
export async function generateTravelResponse(
    userId: string,
    userMessage: string,
    visitorName?: string
): Promise<{ message: string; consultationData: ConsultationData }> {


    // 1. 컨텍스트 로드 또는 초기화
    debugLog(`[Start] generateTravelResponse for ${userId}: ${userMessage.substring(0, 20)}`);
    let context = conversationContexts.get(userId);
    if (!context || (Date.now() - context.lastActive > 1000 * 60 * 60)) { // 1시간 지나면 리셋
        context = {
            history: [],
            consultation: {
                customer: { name: visitorName || '미정', phone: '미정' },
                trip: { destination: '', product_name: '', departure_date: '', url: '' },
                automation: {
                    status: '상담중',
                    balance_due_date: '미정',
                    notice_date: '미정',
                    next_followup: calculateAutomationDates(getTodayString()).next_followup,
                },
                summary: '신규 상담',
            },
            lastActive: Date.now(),
        };
    } else if (visitorName) {
        // 기존 세션이 있어도 이름이 바뀌었거나 새로 들어왔으면 업데이트
        context.consultation.customer.name = visitorName;
    }

    // 2. 입력 메시지 분석 (규칙 기반 정보 추출 보조)
    const extractedDate = extractDateFromText(userMessage);
    if (extractedDate) context.consultation.trip.departure_date = extractedDate;

    // 3. 지식 검색 (RAG)
    debugLog(`[RAG] Finding relevant products...`);
    const productInfo = await findRelevantProducts(userMessage);
    debugLog(`[RAG] Done. Found: ${!!productInfo}`);
    let systemInjection = '';

    if (productInfo) {
        systemInjection += `\n\n🔎 [검색된 관련 상품 정보]\n${productInfo}\n\n위 상품 정보를 참고해서 구체적으로 답변해줘.`;
    }

    // 4. URL 크롤링 (특수 케이스)
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = userMessage.match(urlRegex);
    if (match) {
        context.consultation.trip.url = match[0];
        try {
            const crawledData = await crawlTravelProduct(match[0]);
            if (crawledData) {
                systemInjection += `
\n[시스템 알림]: 고객이 링크(${match[0]})를 보냈어. 
크롤링된 정보:
${formatProductInfo(crawledData)}
이 정보를 바탕으로 "상품 분석 전문가"처럼 리뷰해줘. 가격 대비 장점을 칭찬해.
`;
                context.consultation.trip.product_name = crawledData.title;
            }
        } catch (e) {
            console.error('크롤링 실패:', e);
        }
    }

    // 5. 프롬프트 구성
    const fullSystemPrompt = SYSTEM_INSTRUCTION + systemInjection;

    // 6. Gemini 채팅 세션 구성
    const chat = model.startChat({
        history: [
            {
                role: 'user',
                parts: [{ text: fullSystemPrompt }]
            },
            {
                role: 'model',
                parts: [{ text: '네, 알겠습니다. 클럽모두로서 전문적이고 신뢰감 있는 상담을 제공하겠습니다.' }]
            },
            ...context.history.map(h => ({
                role: h.role,
                parts: [{ text: h.parts }]
            }))
        ],
        generationConfig: {
            maxOutputTokens: 500, // 카카오 타임아웃 방지를 위해 500으로 축소
            temperature: 0.7,
        },
    });

    try {
        debugLog(`[Gemini] Sending message...`);
        const result = await chat.sendMessage(userMessage);
        let responseText = result.response.text();
        debugLog(`[Gemini] Response received. Length: ${responseText.length}`);

        // [DATA: ...] JSON 데이터 추출 및 처리
        const dataMatch = responseText.match(/\[DATA: ({[\s\S]*?})\]/);
        if (dataMatch && dataMatch[1]) {
            try {
                const extractedData = JSON.parse(dataMatch[1]);

                // 상담 정보 업데이트
                if (extractedData.destination) context.consultation.trip.destination = extractedData.destination;
                if (extractedData.date) context.consultation.trip.departure_date = extractedData.date;
                if (extractedData.people) context.consultation.summary += ` / 인원:${extractedData.people}`;
                if (extractedData.budget) context.consultation.summary += ` / 예산:${extractedData.budget}`;
                if (extractedData.name) context.consultation.customer.name = extractedData.name;
                if (extractedData.phone) context.consultation.customer.phone = extractedData.phone;
                if (extractedData.status) context.consultation.automation.status = extractedData.status;

                // 고객에게 보이는 메시지에서 JSON 제거
                responseText = responseText.replace(dataMatch[0], '').trim();
            } catch (e) {
                console.error('JSON parsing error:', e);
            }
        }

        // 관리자 호출 감지 (답변에 '관리자' 키워드가 포함되면)
        if (responseText.includes('관리자') && responseText.includes('확인')) {
            // 필요 시 알림 로직 추가 가능
            console.log('[알림] 관리자 개입 필요');
            context.consultation.automation.status = '관리자확인필요';
        }

        // 7. 컨텍스트 업데이트
        context.history.push({ role: 'user', parts: userMessage });
        context.history.push({ role: 'model', parts: responseText });

        if (context.history.length > 20) {
            context.history = context.history.slice(context.history.length - 20);
        }

        context.lastActive = Date.now();
        conversationContexts.set(userId, context);

        // 상태 자동 추론
        if (responseText.includes('예약') && responseText.includes('도와드릴까요')) {
            context.consultation.automation.status = '견적제공';
        }

        console.log('[AI Engine] 응답 성공:', responseText.substring(0, 100));
        return {
            message: responseText,
            consultationData: context.consultation,
        };

    } catch (error: any) {
        debugLog(`[Gemini Error] ${error.message}`);
        console.error('[AI Engine] Gemini API Error:', error.message);
        console.error('[AI Engine] Error details:', JSON.stringify(error, null, 2));
        return {
            message: "죄송해요, 잠시 시스템 연결이 원활하지 않네요. 잠시 후 다시 말씀해 주시겠어요? 😅",
            consultationData: context.consultation
        };
    }
}

/**
 * 대화 내역 전체를 분석하여 상담 정보를 추출합니다 (수동 요약용)
 */
export async function extractConsultationData(
    history: { role: string; content: string }[]
): Promise<Partial<ConsultationData>> {
    const historyText = history.map(h => `${h.role === 'user' ? '고객' : '상담원'}: ${h.content}`).join('\n');

    const extractionPrompt = `
당신은 여행 상담 내역 전문가입니다. 아래 대화 내역에서 필요한 정보를 추출하여 JSON 형식으로만 응답하세요.

[추출할 정보]
1. destination: 목적지 (예: 일본, 싱가포르)
2. date: 출발일 (YYYY-MM-DD 형식 권장)
3. people: 인원수 (숫자와 명)
4. budget: 예산 (만원 단위 또는 전체 금액)
5. name: 고객 성함
6. phone: 전화번호 (010-XXXX-XXXX 형식)
7. status: 상담단계 (상담중, 견적제공, 예약확정, 결제완료, 상담완료, 취소/보류 중 하나)
8. summary: 대화 내용의 핵심 요약 (매우 간결하게)

[대화 내역]
${historyText}

[주의사항]
- 대화에서 명확히 확인되지 않은 정보는 null로 표시하세요.
- 오직 JSON 형식으로만 답변하세요. 마크다운 기호 없이 순수 JSON만 보내세요.
`;

    try {
        const result = await model.generateContent(extractionPrompt);
        let text = result.response.text().trim();

        // 마크다운 코드 블록 제거
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const extracted = JSON.parse(text);

        // ConsultationData 형식에 맞게 변환
        return {
            customer: {
                name: extracted.name || '미정',
                phone: extracted.phone || '미정'
            },
            trip: {
                destination: extracted.destination || '',
                product_name: '',
                departure_date: extracted.date || '',
                url: ''
            },
            automation: {
                status: extracted.status || '상담중',
                balance_due_date: '미정',
                notice_date: '미정',
                next_followup: calculateAutomationDates(getTodayString()).next_followup,
            },
            summary: extracted.summary || '상담 요약 없음'
        };
    } catch (e) {
        console.error('[AI Engine] Extraction Error:', e);
        return {};
    }
}

/**
 * 대화 초기화
 */
export function resetConversation(userId: string): void {
    conversationContexts.delete(userId);
}

/**
 * 텔레그램으로 입력된 오프라인 전화 문의 메시지를 자연어 분석하여 구조화합니다.
 */
export async function parseTelegramInquiry(text: string): Promise<{
    name: string;
    phone: string;
    destination: string;
    inflowChannel: string;
    inquiryDetails: string;
}> {
    const prompt = `
당신은 여행사 전화 문의 자연어 분석 전문가입니다. 관리자가 퇴근 후 모바일 메신저(텔레그램)로 자유롭게 남긴 메모를 분석하여 정형화된 JSON 데이터로 추출하세요.

[입력 메시지]
"${text}"

[추출 및 분석 규칙]
1. name: 고객의 한글/영문 성함 (예: "홍길동", "유수진"). 발견되지 않으면 "미정"으로 설정하세요.
2. phone: 010으로 시작하는 연락처. 발견되면 반드시 "010-XXXX-XXXX" 형식으로 대시(-)를 추가하여 포맷팅하세요. 예: "01012345678" -> "010-1234-5678". 발견되지 않으면 "미정"으로 설정하세요.
3. destination: 여행 목적지 (예: "일본", "다낭", "규슈"). 발견되지 않으면 빈 문자열("")로 설정하세요.
4. inflowChannel: 고객이 유입된 경로. 반드시 아래 제공되는 **표준 유입경로 리스트** 중 하나로 완벽히 매핑하세요:
   - "블로그": 입력글에 '블로그', '네이버 블로그', 'blog' 등이 포함되는 경우
   - "인스타그램": 입력글에 '인스타', '인스타그램', 'instagram', 'dm' 등이 포함되는 경우
   - "당근": 입력글에 '당근', '당근마켓', '당근글' 등이 포함되는 경우
   - "지인소개": 입력글에 '소개', '추천', '지인' 등이 포함되는 경우
   - "카카오톡": 입력글에 '카톡', '카카오', '카카오톡', 'kakao' 등이 포함되는 경우
   - "전화": 입력글에 '전화', '콜', '전화옴', '통화' 등이 포함되는 경우이거나, 유입경로를 추론할 수 없을 때 기본값으로 사용
   - "기타": 그 외 표준에 부합하지 않거나 특이한 경로
5. inquiryDetails: 대화에 언급된 문의 목적, 일정, 상세 메모 내용을 1-2문장의 깔끔하고 정중한 설명으로 요약하세요. (예: "6월 중순 3박 4일 일본 온천 여행 패키지 견적 요청").

[응답 주의사항]
- 마크다운 기호(예: \`\`\`json)나 부가 설명 없이, 오직 유효한 JSON 형식의 문자열 하나만 반환하세요.
- JSON 키 명칭은 반드시 아래와 일치해야 합니다:
  {
    "name": "성함",
    "phone": "연락처",
    "destination": "목적지",
    "inflowChannel": "표준유입경로",
    "inquiryDetails": "문의요약"
  }
`;

    try {
        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();
        
        // 마크다운 블록 제거
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const extracted = JSON.parse(responseText);
        
        return {
            name: extracted.name || '미정',
            phone: extracted.phone || '미정',
            destination: extracted.destination || '',
            inflowChannel: extracted.inflowChannel || '전화',
            inquiryDetails: extracted.inquiryDetails || text
        };
    } catch (e) {
        console.error('[AI Engine] Telegram Parsing Error:', e);
        // 파싱 실패 시 기본값 리턴
        return {
            name: '미정',
            phone: '미정',
            destination: '',
            inflowChannel: '전화',
            inquiryDetails: text
        };
    }
}

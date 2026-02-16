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
const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
    console.error('[AI Engine] GEMINI_API_KEY가 설정되지 않았습니다!');
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }); // 2026년 사용 가능한 모델 (로그상 성공 확인)

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
 * 대화 초기화
 */
export function resetConversation(userId: string): void {
    conversationContexts.delete(userId);
}

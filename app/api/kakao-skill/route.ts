import { NextRequest, NextResponse } from 'next/server';
import { generateTravelResponse } from '@/lib/ai-engine';
import { createKakaoTextResponse, createKakaoErrorResponse } from '@/lib/kakao-response';
import { KakaoSkillRequest } from '@/types';
import { messageStore } from '@/lib/message-store';

/**
 * 카카오 i 오픈빌더 스킬 서버 엔드포인트
 */
import fs from 'fs';
import path from 'path';

// Logger helper
// Force absolute path for reliability
const debugLog = (msg: string) => {
    try {
        const logPath = path.join(process.cwd(), 'debug.log');
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) { console.error(e); }
};

const log = (msg: string) => {
    console.log(msg);
    debugLog(msg); // File write
};

/**
 * 카카오 i 오픈빌더 스킬 서버 엔드포인트
 */
export async function POST(request: NextRequest) {
    const timestamp = new Date().toISOString();
    log(`[POST] 🚀 KAKAO REQUEST RECEIVED`);

    try {
        const rawBody = await request.text();
        if (!rawBody) {
            log('[POST] Empty body');
            return NextResponse.json(createKakaoErrorResponse('Empty body'));
        }

        const body: KakaoSkillRequest = JSON.parse(rawBody);
        const userMessage = body.userRequest?.utterance;
        const visitorId = body.userRequest?.user?.id || `kakao-${Date.now()}`;
        const nickname = body.userRequest?.user?.properties?.nickname;
        const callbackUrl = body.userRequest?.callbackUrl;

        log(`[POST] User: ${visitorId} (${nickname}), Msg: "${userMessage}", Callback: ${callbackUrl ? 'Yes' : 'No'}`);

        if (!userMessage) {
            log('[POST] No user message');
            return NextResponse.json(createKakaoErrorResponse('메시지를 인식할 수 없습니다.'));
        }

        // 콜백 URL이 제공된 경우 -> 무조건 비동기 처리 (타임아웃 방지)
        if (callbackUrl) {
            log(`[POST] Async processing via callbackUrl`);

            // 백그라운드 처리 시작 (await 하지 않음)
            processBackgroundTask(body, callbackUrl).catch(err => {
                log(`[Background Error] ${err.message}`);
                console.error('백그라운드 처리 중 오류 발생:', err);
            });

            // 즉시 응답 반환 (useCallback: true)
            return NextResponse.json({
                version: "2.0",
                useCallback: true,
                data: {
                    text: "잠시만 기다려주세요! 답변을 준비하고 있습니다. ⏳"
                }
            });
        }

        // 콜백 URL이 없는 경우 (테스트 툴 등) -> 동기 처리
        log(`[POST] Sync processing (no callbackUrl)`);
        const { message: responseMessage, consultationData } = await generateTravelResponse(
            visitorId,
            userMessage,
            nickname
        );

        consultationData.visitor_id = visitorId;
        consultationData.source = '카카오톡';

        // [Optimized] 응답 속도 개선: 시트 저장은 백그라운드로 미루고 응답부터 보냄
        const response = await createResponseData(visitorId, responseMessage, consultationData);

        // Fire-and-forget (await 하지 않음)
        finalizeAssistantResponse(visitorId, responseMessage, consultationData, nickname).catch(e => {
            log(`[Background Finalize Error] ${e.message}`);
        });

        return NextResponse.json(response);

    } catch (error: any) {
        log(`[POST Error] ${error.message}`);
        console.error('카카오 스킬 API 오류:', error);
        return NextResponse.json(createKakaoErrorResponse(`서버 오류: ${error.message}`));
    }
}

/**
 * 백그라운드 처리 (Gemini 및 Google Sheets 연동)
 */
async function processBackgroundTask(body: KakaoSkillRequest, callbackUrl: string) {
    const visitorId = body.userRequest?.user?.id || `kakao-${Date.now()}`;
    const userMessage = body.userRequest?.utterance || '';
    const nickname = body.userRequest?.user?.properties?.nickname;

    log(`[Background] Start for ${visitorId}`);

    // 1. 사용자 메시지 기록 및 콜백 URL 저장
    messageStore.addMessage(visitorId, 'user', userMessage);

    try {
        const { appendMessageToSheet } = await import('@/lib/google-sheets');
        appendMessageToSheet(visitorId, 'user', userMessage).catch(e => log(`[Sheet Log Error] ${e.message}`));

        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const { supabase } = await import('@/lib/supabase');
            if (supabase) {
                // 1. 콜백 URL 기록
                await supabase.from('consultations').upsert({
                    visitor_id: visitorId,
                    last_callback_url: callbackUrl,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'visitor_id' });

                // 2. 메시지 로그 기록 (User)
                await supabase.from('message_logs').insert({
                    visitor_id: visitorId,
                    role: 'user',
                    content: userMessage
                });

                // 3. AI 자동 분석 및 시트 동기화 (백그라운드)
                const { syncConsultationWithAI } = await import('@/lib/consultation-manager');
                syncConsultationWithAI(visitorId, nickname || '').catch(e => console.error(`[Auto Sync Error] ${e}`));
            }
        }
    } catch (e) { }

    // 2. 챗봇 활성화 상태 확인 (기본적으로 수동 모드 지향)
    let isBotEnabled = false; // 기본값 false로 변경 (수동 모드)
    try {
        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const { supabase } = await import('@/lib/supabase');
            if (supabase) {
                const { data } = await supabase
                    .from('consultations')
                    .select('is_bot_enabled')
                    .eq('visitor_id', visitorId)
                    .single();

                // 데이터가 있고 명시적으로 true인 경우에만 활성화
                if (data && data.is_bot_enabled === true) {
                    isBotEnabled = true;
                }
            }
        }
    } catch (e) {
        log(`[Bot Status Check Error] ${e}`);
    }

    if (!isBotEnabled) {
        log(`[Background] Bot is DISABLED for ${visitorId}. Sending 1:1 chat guide.`);

        // 1:1 채팅 이동 버튼 포함 응답
        const channelId = (process.env.KAKAO_CHANNEL_ID || '').replace('@', '');
        const chatUrl = channelId ? `http://pf.kakao.com/${channelId}/chat` : null;

        const responseBody = {
            version: "2.0",
            template: {
                outputs: [
                    {
                        simpleText: {
                            text: "안녕하세요! 상담원에게 메시지가 전달되었습니다. 잠시만 기다려주시면 직접 답변해 드릴게요. 😊"
                        }
                    },
                    {
                        basicCard: {
                            title: "상담원 대화 안내",
                            description: "빠른 1:1 대화를 원하시면 아래 버튼을 눌러주세요.",
                            buttons: chatUrl ? [{
                                action: "webLink",
                                label: "1:1 채팅하기",
                                webLinkUrl: chatUrl
                            }] : []
                        }
                    }
                ]
            }
        };

        try {
            await fetch(callbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(responseBody)
            });
        } catch (e) {
            log(`[Bot-Off Callback Error] ${e}`);
        }
        return;
    }

    // 3. AI 응답 생성
    log(`[Background] Generating AI response...`);
    let responseMessage: string;
    let consultationData: any;

    try {
        const result = await generateTravelResponse(
            visitorId,
            userMessage,
            nickname
        );
        responseMessage = result.message;
        consultationData = result.consultationData;
        log(`[Background] AI Response generated. Length: ${responseMessage.length}`);
    } catch (aiError: any) {
        log(`[Background AI Error] ${aiError.message}`);
        throw aiError;
    }

    consultationData.visitor_id = visitorId;
    consultationData.source = '카카오톡';

    // 3. 응답 데이터 생성
    const responseBody = await createResponseData(visitorId, responseMessage, consultationData);

    // 4. 콜백 전송
    log(`[Background] Sending callback to: ${callbackUrl}`);
    try {
        const fetchResponse = await fetch(callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responseBody)
        });

        const responseText = await fetchResponse.text();
        log(`[Background] Callback status: ${fetchResponse.status}, Body: ${responseText.substring(0, 100)}`);
    } catch (error: any) {
        log(`[Background Callback Error] ${error.message}`);
    }

    // 5. 최종 기록 및 세션 업데이트
    log(`[Background] Finalizing response (Upserting sheet)...`);
    await finalizeAssistantResponse(visitorId, responseMessage, consultationData, nickname);
    log(`[Background] Done.`);
}

/**
 * 최종 응답 생성 및 데이터 기록 공통 로직
 */
async function finalizeAssistantResponse(visitorId: string, responseMessage: string, consultationData: any, nickname?: string) {
    const safeVisitorName = consultationData.customer.name !== '미정' ? consultationData.customer.name : (nickname || `손님 ${visitorId.substring(0, 4)}`);

    // 세션 업데이트
    messageStore.upsertSession(visitorId, {
        visitorName: safeVisitorName,
        visitorPhone: consultationData.customer.phone,
        destination: consultationData.trip.destination,
        productName: consultationData.trip.product_name,
        departureDate: consultationData.trip.departure_date,
        productUrl: consultationData.trip.url,
        status: consultationData.automation.status,
        automationDates: {
            balanceDueDate: consultationData.automation.balance_due_date,
            noticeDate: consultationData.automation.notice_date,
            nextFollowup: consultationData.automation.next_followup,
        },
    });

    // 어시스턴트 메시지 저장
    messageStore.addMessage(visitorId, 'assistant', responseMessage);

    // 기록 로직 (Sheets, Supabase)
    try {
        const { upsertConsultationToSheet, appendMessageToSheet } = await import('@/lib/google-sheets');

        // 업서트 수행 (비동기로 결과 기다림)
        log(`[Finalize] Upserting to sheet...`);
        const upsertResult = await upsertConsultationToSheet(consultationData);
        log(`[Finalize] Upsert result: ${upsertResult}`);

        await appendMessageToSheet(visitorId, 'assistant', responseMessage);

        if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
            const { supabase } = await import('@/lib/supabase');
            if (supabase) {
                await supabase.from('consultations').upsert({
                    visitor_id: visitorId,
                    customer_name: safeVisitorName,
                    status: consultationData.automation.status,
                    summary: consultationData.summary
                }, { onConflict: 'visitor_id' });

                await supabase.from('message_logs').insert({
                    visitor_id: visitorId,
                    role: 'assistant',
                    content: responseMessage
                });
            }
        }
    } catch (e: any) {
        log(`[Finalize Error] ${e.message}`);
    }

    // return await createResponseData(visitorId, responseMessage, consultationData); // REMOVED
}

/**
 * 응답 데이터 포맷팅
 */
async function createResponseData(visitorId: string, responseMessage: string, consultationData: any) {
    // 메시지 끝의 불필요한 공백/줄바꿈 강력 제거
    const trimmedMessage = responseMessage.replace(/\s+$/, '');

    // 퀵어플라이 버튼 제거 (텍스트만 응답)
    const response = createKakaoTextResponse(trimmedMessage);
    if (response.template && response.template.quickReplies) {
        delete response.template.quickReplies;
    }
    return response;
}

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'Smart Travel Pilot 카카오 스킬 서버가 정상 작동 중입니다.',
        timestamp: new Date().toISOString(),
    });
}

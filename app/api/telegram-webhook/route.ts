import { NextRequest, NextResponse } from 'next/server';
import { parseTelegramInquiry } from '@/lib/ai-engine';
import { appendConsultationToSheet } from '@/lib/google-sheets';
import { sendTelegramMessage } from '@/lib/telegram';
import { supabase } from '@/lib/supabase';
import { ConsultationData } from '@/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('[Telegram Webhook] Received body:', JSON.stringify(body, null, 2));

        // 메시지가 없는 업데이트는 처리 생략 (Telegram의 중복 호출 방지를 위해 200 응답)
        if (!body.message || !body.message.text) {
            return NextResponse.json({ success: true, message: 'No text message to process' });
        }

        const messageText = body.message.text;
        const chatId = body.message.chat.id.toString();
        const senderName = body.message.from?.first_name || '관리자';

        // 1. 보안 체크: TELEGRAM_CHAT_ID가 설정되어 있는 경우 발신자 일치 여부 확인
        const authorizedChatId = process.env.TELEGRAM_CHAT_ID;
        if (authorizedChatId && chatId !== authorizedChatId) {
            console.warn(`[Telegram Webhook] Unauthorized access attempt from Chat ID: ${chatId}`);
            // 필요 시 봇 답장으로 거부 통지
            await sendTelegramMessage(
                `⚠️ <b>허가되지 않은 사용자입니다.</b>\n이 봇은 스마트 여행 파일럿 관리자 전용입니다.`,
                chatId
            );
            return NextResponse.json({ success: true, message: 'Unauthorized sender' });
        }

        // 봇 시작 명령어(/start)인 경우 가이드 메시지 전송
        if (messageText.startsWith('/start')) {
            const guide = `👋 <b>안녕하세요, ${senderName}님!</b>\n스마트 여행 파일럿 [퇴근 후 전화 문의 기록] 봇입니다.\n\n이곳에 퇴근 후 접수된 전화 문의 내용을 자유로운 문장으로 적어 보내주세요.\n\n<b>예시:</b>\n<i>"유수진 010-2614-4122 블로그 보고 전화옴 일본 6월 3박4일 패키지"</i>\n\n보내주신 내용은 AI가 자동 분석하여 <b>구글 시트</b>에 알맞게 기입하고, 내일 아침 출근 시 <b>대시보드 상단 배너</b>를 통해 '확인필요' 알림으로 띄워 드립니다.`;
            await sendTelegramMessage(guide, chatId);
            return NextResponse.json({ success: true, message: 'Start guide sent' });
        }

        // 2. Gemini AI 자연어 분석 요청
        console.log(`[Telegram Webhook] Parsing natural language: "${messageText}"`);
        const parsed = await parseTelegramInquiry(messageText);
        console.log('[Telegram Webhook] AI Parsed Result:', JSON.stringify(parsed, null, 2));

        // 3. 고유한 visitor_id 생성 (TG-연락처 숫자만, 번호가 없으면 TG-타임스탬프)
        const sanitizedPhone = parsed.phone.replace(/[^0-9]/g, '');
        const visitorId = sanitizedPhone && sanitizedPhone !== '010'
            ? `TG-${sanitizedPhone}`
            : `TG-${Date.now()}`;

        // 내일 날짜 계산 (yyyy-MM-dd)
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        const nextFollowupStr = nextDay.toISOString().split('T')[0];

        // 4. 구글 시트 저장용 데이터 구성
        const sheetData: ConsultationData = {
            visitor_id: visitorId,
            customer: {
                name: parsed.name,
                phone: parsed.phone,
            },
            trip: {
                destination: parsed.destination,
                product_name: '',
                departure_date: '',
                url: '',
            },
            automation: {
                status: '확인필요', // '확인필요' 상태 설정
                inquirySource: parsed.inflowChannel, // AI 표준 유입경로 매핑 결과 기입
                recurringCustomer: '신규고객',
                balance_due_date: '미정',
                notice_date: '미정',
                next_followup: nextFollowupStr,
            },
            source: '텔레그램',
            summary: parsed.inquiryDetails,
        };

        // 5. 구글 시트 기록 시도
        console.log('[Telegram Webhook] Appending to Google Sheets...');
        const sheetSuccess = await appendConsultationToSheet(sheetData);
        console.log('[Telegram Webhook] Google Sheets append result:', sheetSuccess);

        // 6. Supabase DB 기록 시도
        let dbSuccess = false;
        if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
            console.log('[Telegram Webhook] Saving to Supabase...');
            const { error: dbError } = await supabase
                .from('consultations')
                .upsert({
                    visitor_id: visitorId,
                    customer_name: parsed.name,
                    customer_phone: parsed.phone,
                    destination: parsed.destination,
                    departure_date: '',
                    status: '확인필요',
                    summary: parsed.inquiryDetails,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'visitor_id' });

            if (dbError) {
                console.error('[Telegram Webhook] Supabase upsert error:', dbError);
            } else {
                dbSuccess = true;
                console.log('[Telegram Webhook] Supabase upsert success');
            }
        }

        // 7. 텔레그램 답장(확인 통지) 전송
        const responseCard = `📲 <b>퇴근 후 전화 문의 등록 완료</b>

• <b>고객성함:</b> ${parsed.name}
• <b>연락처:</b> ${parsed.phone}
• <b>유입경로:</b> ${parsed.inflowChannel}
• <b>목적지:</b> ${parsed.destination || '미지정'}
• <b>상세내용:</b> ${parsed.inquiryDetails}

📢 <i>상태가 <b>[확인필요]</b>로 정상 등록되었습니다. 구글 시트 기입 완료 및 다음날 아침 출근 시 웹 사이트 상담 목록 화면에서 배너 알림으로 확인해 보실 수 있습니다.</i>`;

        await sendTelegramMessage(responseCard, chatId);

        return NextResponse.json({
            success: true,
            data: {
                visitorId,
                parsed,
                sheetSuccess,
                dbSuccess
            }
        });

    } catch (error: any) {
        console.error('[Telegram Webhook] Fatal Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

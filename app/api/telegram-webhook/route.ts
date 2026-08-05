import { NextRequest, NextResponse } from 'next/server';
import { parseTelegramInquiry } from '@/lib/ai-engine';
import { appendConsultationToSheet, getAllConsultations } from '@/lib/google-sheets';
import { sendTelegramMessage, getTelegramWelcomeGuide } from '@/lib/telegram';
import { supabase } from '@/lib/supabase';
import { ConsultationData } from '@/types';
import { crawlTravelProduct } from '@/lib/url-crawler';
import { resolveTenantByTelegramChatId, resolveTenantByWebhookSecret, TelegramTenantConfig } from '@/lib/tenant-local-store';
import { generateTelegramTemplateText, TEMPLATE_LIST, TemplateType } from '@/lib/telegram-template-generator';
import { getTelegramSession, setTelegramSession, clearTelegramSession } from '@/lib/telegram-user-session';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('[Telegram Webhook] Received update:', JSON.stringify(body, null, 2));

        // 이 웹훅 URL은 모든 테넌트의 봇이 공유하므로 어느 봇/테넌트에서 온 요청인지 구분해야 한다.
        // 1순위: setWebhook에 등록된 봇별 고유 secret_token (같은 사람이 여러 테넌트 봇을
        //        자기 계정으로 테스트해도 정확히 구분됨). 2순위: chat_id 매칭(레거시 fallback).
        const secretHeader = request.headers.get('x-telegram-bot-api-secret-token');
        const resolveTenant = async (chatId: string): Promise<TelegramTenantConfig | null> =>
            (await resolveTenantByWebhookSecret(secretHeader)) || (await resolveTenantByTelegramChatId(chatId));

        // 1. 콜백 쿼리 (인라인 버튼 클릭) 처리
        if (body.callback_query) {
            const callbackQuery = body.callback_query;
            const callbackData = callbackQuery.data || '';
            const chatId = callbackQuery.message?.chat?.id?.toString() || callbackQuery.from?.id?.toString();

            if (!chatId) return NextResponse.json({ success: true });

            const tenantConfig = await resolveTenant(chatId);
            if (!tenantConfig) return NextResponse.json({ success: true });
            const botToken = tenantConfig.botToken;

            // 1-A. 템플릿 유형 선택 클릭 (e.g. tpl_booking, tpl_remind)
            if (callbackData.startsWith('tpl_')) {
                const tplId = callbackData.replace('tpl_', '') as TemplateType;
                const tplItem = TEMPLATE_LIST.find(t => t.id === tplId);
                const tplLabel = tplItem ? `${tplItem.icon} ${tplItem.label}` : tplId;

                const methodKeyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔍 1. 기존 등록 고객명 검색', callback_data: `method_search_${tplId}` }
                        ],
                        [
                            { text: '✍️ 2. 고객명 + URL 직접 입력', callback_data: `method_manual_${tplId}` }
                        ]
                    ]
                };

                const msg = `📋 <b>[멘트 제작 - ${tplLabel}]</b>\n\n고객 정보를 불러오실 방식을 선택해 주세요:\n\n1️⃣ <b>기존 등록 고객명 검색</b>: 구글 시트 / DB에 저장된 고객명으로 검색\n2️⃣ <b>고객명 + URL 직접 입력</b>: 손님 성함과 상품 URL을 직접 입력`;

                await sendTelegramMessage(msg, chatId, botToken, methodKeyboard);
                return NextResponse.json({ success: true, message: 'Template method prompt sent' });
            }

            // 1-B. 검색 방식 선택 클릭 (e.g. method_search_booking)
            if (callbackData.startsWith('method_search_')) {
                const tplId = callbackData.replace('method_search_', '') as TemplateType;
                const tplItem = TEMPLATE_LIST.find(t => t.id === tplId);
                const tplLabel = tplItem ? `${tplItem.icon} ${tplItem.label}` : tplId;

                setTelegramSession(chatId, {
                    step: 'AWAITING_CUSTOMER_SEARCH',
                    templateType: tplId,
                });

                const msg = `🔍 <b>[${tplLabel} - 기존 고객 검색]</b>\n\n검색할 <b>고객 성함</b> 또는 <b>연락처 뒤 4자리</b>를 입력해 주세요!\n\n💡 <b>입력 예시:</b> <i>홍길동</i> 또는 <i>4122</i>`;
                await sendTelegramMessage(msg, chatId, botToken);
                return NextResponse.json({ success: true, message: 'Search query prompt sent' });
            }

            // 1-C. 직접 입력 방식 선택 클릭 (e.g. method_manual_booking)
            if (callbackData.startsWith('method_manual_')) {
                const tplId = callbackData.replace('method_manual_', '') as TemplateType;
                const tplItem = TEMPLATE_LIST.find(t => t.id === tplId);
                const tplLabel = tplItem ? `${tplItem.icon} ${tplItem.label}` : tplId;

                setTelegramSession(chatId, {
                    step: 'AWAITING_MANUAL_INPUT',
                    templateType: tplId,
                });

                const msg = `✍️ <b>[${tplLabel} - 고객명 + URL 직접 입력]</b>\n\n<b>고객 성함</b>과 <b>상품 URL 링크</b>를 한 줄로 적어 전송해 주세요!\n\n💡 <b>입력 예시:</b>\n<code>홍길동 https://www.modetour.com/Package/...</code>`;
                await sendTelegramMessage(msg, chatId, botToken);
                return NextResponse.json({ success: true, message: 'Manual input prompt sent' });
            }

            return NextResponse.json({ success: true });
        }

        // 메시지가 없는 업데이트는 처리 생략
        if (!body.message || !body.message.text) {
            return NextResponse.json({ success: true, message: 'No text message to process' });
        }

        const messageText = body.message.text.trim();
        const chatId = body.message.chat.id.toString();
        const senderName = body.message.from?.first_name || '관리자';

        const tenantConfig = await resolveTenant(chatId);

        if (!tenantConfig) {
            console.warn(`[Telegram Webhook] Unregistered chat. Received: ${chatId}`);
            await sendTelegramMessage(
                `ℹ️ <b>[텔레그램 연동 Chat ID 안내]</b>\n\n현재 고객님의 텔레그램 Chat ID는 <code>${chatId}</code> 입니다.\n\n웹 사이트 <b>[⚙️ 설정 ➔ 텔레그램 Chat ID]</b> 란에 이 번호(<code>${chatId}</code>)를 등록 후 저장해주시면 바로 연동됩니다! ✨`,
                chatId
            );
            return NextResponse.json({ success: true, message: 'Chat ID guidance sent' });
        }

        const tenantId = tenantConfig.tenantId;
        const botToken = tenantConfig.botToken;

        // /start 또는 /help
        if (messageText.startsWith('/start') || messageText.startsWith('/help')) {
            clearTelegramSession(chatId);
            const guide = getTelegramWelcomeGuide(senderName);
            await sendTelegramMessage(guide, chatId, botToken);
            return NextResponse.json({ success: true, message: 'Start guide sent' });
        }

        // 세션 상태 조회
        const session = getTelegramSession(chatId);

        // A. 기존 고객 검색 입력 대기 상태인 경우
        if (session.step === 'AWAITING_CUSTOMER_SEARCH' && session.templateType) {
            console.log(`[Telegram Webhook] Searching customer for query: "${messageText}"`);
            const searchQuery = messageText.toLowerCase();

            // 1) Supabase(테넌트 구분 없는 레거시 캐시 - default_tenant 전용) 및 구글 시트에서 고객 검색
            let matchedCustomer: any = null;

            if (tenantId === 'default_tenant' && process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
                const { data: dbData } = await supabase
                    .from('consultations')
                    .select('*')
                    .or(`customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%`)
                    .limit(1);

                if (dbData && dbData.length > 0) {
                    const c = dbData[0];
                    matchedCustomer = {
                        customerName: c.customer_name,
                        customerPhone: c.customer_phone,
                        destination: c.destination,
                        productName: c.product_name,
                        productUrl: c.url,
                        departureDate: c.departure_date,
                    };
                }
            }

            if (!matchedCustomer) {
                try {
                    const allConsultations = await getAllConsultations(false, tenantId);
                    const found = allConsultations.find(c =>
                        (c.customer.name && c.customer.name.toLowerCase().includes(searchQuery)) ||
                        (c.customer.phone && c.customer.phone.includes(searchQuery))
                    );
                    if (found) {
                        matchedCustomer = {
                            customerName: found.customer.name,
                            customerPhone: found.customer.phone,
                            destination: found.trip.destination,
                            productName: found.trip.product_name,
                            productUrl: found.trip.url,
                            departureDate: found.trip.departure_date,
                        };
                    }
                } catch (e) {
                    console.error('Google Sheets customer search error:', e);
                }
            }

            const tplType = session.templateType as TemplateType;
            clearTelegramSession(chatId);

            if (matchedCustomer) {
                // 크롤링 URL이 있으면 추가 데이터 보강 시도
                if (matchedCustomer.productUrl) {
                    try {
                        const crawled = await crawlTravelProduct(matchedCustomer.productUrl);
                        if (crawled) {
                            matchedCustomer.price = crawled.price || crawled.priceAdult;
                            matchedCustomer.airline = crawled.airline;
                            matchedCustomer.duration = crawled.duration;
                        }
                    } catch (e) {}
                }

                const generatedMessage = await generateTelegramTemplateText(tplType, matchedCustomer, tenantId);
                const headerCard = `✨ <b>[검색된 고객 (${matchedCustomer.customerName} 님) 멘트 제작 완료]</b>\n──────────────────\n\n`;
                await sendTelegramMessage(headerCard + generatedMessage, chatId, botToken);
                return NextResponse.json({ success: true, message: 'Template text generated from DB' });
            } else {
                // 고객을 찾지 못한 경우 직접 입력 데이터로 간주하여 처리
                const fallbackMessage = await generateTelegramTemplateText(tplType, { customerName: messageText }, tenantId);
                const headerCard = `⚠️ <b>[검색결과 없음 ➔ '${messageText}' 님 기본 멘트 제작]</b>\n──────────────────\n\n`;
                await sendTelegramMessage(headerCard + fallbackMessage, chatId, botToken);
                return NextResponse.json({ success: true, message: 'Fallback template sent' });
            }
        }

        // B. 고객명 + URL 직접 입력 대기 상태인 경우
        if (session.step === 'AWAITING_MANUAL_INPUT' && session.templateType) {
            console.log(`[Telegram Webhook] Manual input received: "${messageText}"`);
            const urlRegex = /(https?:\/\/[^\s]+)/gi;
            const matchedUrls = messageText.match(urlRegex);
            const extractedUrl = matchedUrls ? matchedUrls[0] : '';

            // URL 제외 텍스트에서 고객명 추출
            const extractedName = messageText.replace(urlRegex, '').trim() || '고객';
            const tplType = session.templateType as TemplateType;

            clearTelegramSession(chatId);

            let productData: any = {};
            if (extractedUrl) {
                try {
                    const crawled = await crawlTravelProduct(extractedUrl);
                    if (crawled) {
                        productData = {
                            productName: crawled.productName,
                            price: crawled.price || crawled.priceAdult,
                            destination: crawled.destination,
                            airline: crawled.airline,
                            duration: crawled.duration,
                            departureDate: crawled.departureDate,
                        };
                    }
                } catch (e) {}
            }

            const generatedMessage = await generateTelegramTemplateText(tplType, {
                customerName: extractedName,
                productUrl: extractedUrl,
                ...productData
            }, tenantId);

            const headerCard = `✨ <b>[${extractedName} 님 멘트 제작 완료]</b>\n──────────────────\n\n`;
            await sendTelegramMessage(headerCard + generatedMessage, chatId, botToken);
            return NextResponse.json({ success: true, message: 'Template text generated from manual input' });
        }

        // 2.5 텔레그램 메인 버튼 클릭 처리 ("📝 상담 등록", "🔍 URL 분석", "💬 멘트 등록" / "💬 멘트 제작", "📅 오늘 일정")
        if (messageText.includes('멘트') && (messageText.includes('등록') || messageText.includes('제작'))) {
            clearTelegramSession(chatId);

            // 10가지 멘트 유형 인라인 키보드 구성
            const templateKeyboard = {
                inline_keyboard: [
                    [
                        { text: '⏰ 1. 리마인드', callback_data: 'tpl_remind' },
                        { text: '✅ 2. 예약 및 결제', callback_data: 'tpl_booking' }
                    ],
                    [
                        { text: '🌐 3. 닷컴안내', callback_data: 'tpl_dotcom' },
                        { text: '💰 4. 잔금 안내', callback_data: 'tpl_balance' }
                    ],
                    [
                        { text: '🎫 5. 항공권 발권', callback_data: 'tpl_ticket' },
                        { text: '📖 6. 확정서 안내', callback_data: 'tpl_confirmation' }
                    ],
                    [
                        { text: '📅 7. 출발전 체크', callback_data: 'tpl_pre_4w' },
                        { text: '✈️ 8. 출발 안내', callback_data: 'tpl_departure' }
                    ],
                    [
                        { text: '📞 9. 해피콜', callback_data: 'tpl_happy_call' },
                        { text: '📱 10. 중국 바코드', callback_data: 'tpl_china_barcode' }
                    ]
                ]
            };

            const promptMsg = `💬 <b>[상담 멘트 제작 - 템플릿 유형 선택]</b>\n\n제작할 멘트의 유형을 아래 버튼에서 선택해 주세요! 👇`;
            await sendTelegramMessage(promptMsg, chatId, botToken, templateKeyboard);
            return NextResponse.json({ success: true, message: 'Template type menu sent' });
        }

        if (messageText.includes('상담 등록') || messageText.includes('상담등록')) {
            clearTelegramSession(chatId);
            const replyMsg = `📝 <b>[신규 상담 / 전화 문의 등록 방법]</b>\n\n이 대화창에 접수된 전화 문의 내용을 아래 예시처럼 자유롭게 적어 보내주세요!\n\n💡 <b>입력 예시:</b>\n• <i>"홍길동 010-1234-5678 블로그 보고 전화옴 다낭 9월 4인 가족여행 문의"</i>\n• <i>"이영희 010-9876-5432 도쿄 3박4일 패키지 문의"</i>\n\n✨ 보내주신 내용은 AI가 <b>고객명, 연락처, 유입경로, 목적지</b>를 자동 추출하여 <b>구글 시트 및 대시보드</b>에 '상담중'으로 자동 등록해 드립니다.`;
            await sendTelegramMessage(replyMsg, chatId, botToken);
            return NextResponse.json({ success: true, message: 'Consultation guide sent' });
        }

        if (messageText.includes('URL 분석') || messageText.includes('URL분석')) {
            clearTelegramSession(chatId);
            const replyMsg = `🔍 <b>[여행 상품 URL 분석 방법]</b>\n\n분석할 여행 상품(하나투어, 모두투어, 노랑풍선, 롯데투어, 한진관광 등)의 <b>웹페이지 URL 링크</b>를 이 대화창에 보내보세요!\n\n💡 <b>입력 예시:</b>\n• <code>https://www.modetour.com/Package/Item.aspx?idx=...</code>\n\n✨ AI와 크롤러가 <b>상품명, 가격, 목적지, 일정, 호텔, 핵심 셀링포인트</b>를 즉시 추출해 드립니다!`;
            await sendTelegramMessage(replyMsg, chatId, botToken);
            return NextResponse.json({ success: true, message: 'URL guide sent' });
        }

        if (messageText.includes('오늘 일정') || messageText.includes('오늘일정')) {
            clearTelegramSession(chatId);
            const { getTodayNotificationMessage } = await import('@/lib/notifications-logic');
            const todayMsg = await getTodayNotificationMessage(tenantId);
            const replyMsg = todayMsg || `🎉 <b>[오늘의 일정]</b>\n\n오늘 처리해야 할 예정된 스케줄 및 업무가 없습니다. 편안한 하루 되세요! ✨`;
            await sendTelegramMessage(replyMsg, chatId, botToken);
            return NextResponse.json({ success: true, message: 'Today schedule sent' });
        }

        // 3. 메시지 내 URL 추출 및 여행 상품 크롤링 분석
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const matchedUrls = messageText.match(urlRegex);
        let analyzedProduct: any = null;
        let targetUrl: string = '';

        if (matchedUrls && matchedUrls.length > 0) {
            targetUrl = matchedUrls[0];
            console.log(`[Telegram Webhook] Extracting & Analyzing URL: ${targetUrl}`);
            try {
                analyzedProduct = await crawlTravelProduct(targetUrl);
            } catch (e: any) {
                console.error('[Telegram Webhook] URL analysis failed:', e.message);
            }
        }

        // 4. 단순 URL만 전송한 경우
        const cleanTextWithoutUrl = messageText.replace(urlRegex, '').trim();
        const isUrlOnly = (matchedUrls && matchedUrls.length > 0) && (cleanTextWithoutUrl.length < 5 && !cleanTextWithoutUrl.match(/[0-9]{3,}/));

        if (isUrlOnly && analyzedProduct) {
            const priceDisplay = analyzedProduct.price
                ? (typeof analyzedProduct.price === 'number' ? `${analyzedProduct.price.toLocaleString()}원` : analyzedProduct.price)
                : (analyzedProduct.priceAdult ? `${analyzedProduct.priceAdult.toLocaleString()}원` : '가격 문의');

            const keyPointsList = (analyzedProduct.keyPoints || [])
                .slice(0, 5)
                .map((pt: string) => `• ${pt}`)
                .join('\n');

            const urlCard = `🔍 <b>[스마트 트래블 파일럿] 텔레그램 URL 상품 분석 결과</b>

✈️ <b>상품명:</b> ${analyzedProduct.productName || '상품명 분석 완료'}
💰 <b>상품가격:</b> ${priceDisplay}
📍 <b>목적지:</b> ${analyzedProduct.destination || '미지정'}
🗓️ <b>일정/항공:</b> ${analyzedProduct.schedule || ''} ${analyzedProduct.flight ? `(${analyzedProduct.flight})` : ''}
🏨 <b>숙소정보:</b> ${analyzedProduct.hotel || '상세 정보 참조'}

${keyPointsList ? `🌟 <b>핵심 셀링포인트:</b>\n${keyPointsList}\n` : ''}
🔗 <b>상품링크:</b> <a href="${targetUrl}">상품 바로가기</a>

💡 <i>고객 성함/연락처 문의글과 함께 URL을 적어 보내주시면 구글 시트에 상품 정보가 자동 기입됩니다!</i>`;

            await sendTelegramMessage(urlCard, chatId, botToken);
            return NextResponse.json({ success: true, message: 'URL Analysis sent' });
        }

        // 5. 일반 고객 문의 AI 분석 (자연어 + URL 결합)
        console.log(`[Telegram Webhook] Parsing natural language: "${messageText}"`);
        const parsed = await parseTelegramInquiry(messageText);

        const finalProductName = analyzedProduct?.productName || parsed.productName || '';
        const finalDestination = analyzedProduct?.destination || parsed.destination || '';

        const sanitizedPhone = parsed.phone.replace(/[^0-9]/g, '');
        const visitorId = sanitizedPhone && sanitizedPhone !== '010'
            ? `TG-${sanitizedPhone}`
            : `TG-${Date.now()}`;

        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        const nextFollowupStr = nextDay.toISOString().split('T')[0];

        const sheetData: ConsultationData = {
            visitor_id: visitorId,
            customer: {
                name: parsed.name,
                phone: parsed.phone,
            },
            trip: {
                destination: finalDestination,
                product_name: finalProductName,
                departure_date: '',
                url: targetUrl,
            },
            automation: {
                status: '상담중',
                inquirySource: parsed.inflowChannel,
                recurringCustomer: '신규고객',
                balance_due_date: '미정',
                notice_date: '미정',
                next_followup: nextFollowupStr,
            },
            source: '텔레그램',
            summary: parsed.inquiryDetails,
        };

        const sheetSuccess = await appendConsultationToSheet(sheetData, tenantId);

        let dbSuccess = false;
        if (tenantId === 'default_tenant' && process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
            const { error: dbError } = await supabase
                .from('consultations')
                .upsert({
                    visitor_id: visitorId,
                    customer_name: parsed.name,
                    customer_phone: parsed.phone,
                    destination: finalDestination,
                    product_name: finalProductName,
                    url: targetUrl,
                    departure_date: '',
                    status: '상담중',
                    summary: parsed.inquiryDetails,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'visitor_id' });

            if (!dbError) dbSuccess = true;
        }

        const responseCard = `📲 <b>퇴근 후 전화 문의 등록 완료</b>

• <b>고객성함:</b> ${parsed.name}
• <b>연락처:</b> ${parsed.phone}
• <b>유입경로:</b> ${parsed.inflowChannel}
• <b>목적지:</b> ${finalDestination || '미지정'}
${finalProductName ? `• <b>분석된 상품명:</b> ${finalProductName}\n` : ''}${targetUrl ? `• <b>상품 URL:</b> <a href="${targetUrl}">링크 이동</a>\n` : ''}• <b>상세내용:</b> ${parsed.inquiryDetails}

📢 <i>상태가 <b>[상담중]</b>으로 정상 등록되었습니다. ${analyzedProduct ? '상품 URL 정보도 자동 크롤링 분석되어 구글 시트 및 대시보드에 기입되었습니다.' : '구글 시트 기입 완료 및 출근 시 웹 사이트 상담 목록 화면에서 배너 알림으로 확인 가능합니다.'}</i>`;

        await sendTelegramMessage(responseCard, chatId, botToken);

        return NextResponse.json({
            success: true,
            data: { visitorId, parsed, analyzedProduct, sheetSuccess, dbSuccess }
        });

    } catch (error: any) {
        console.error('[Telegram Webhook] Fatal Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

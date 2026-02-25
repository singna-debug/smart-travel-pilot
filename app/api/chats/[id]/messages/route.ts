import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { messageStore } from '@/lib/message-store';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: visitorId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content) {
        return NextResponse.json({ success: false, error: 'Content is required' }, { status: 400 });
    }

    try {
        // 1. 메시지 로그 저장 (Supabase & Google Sheets)
        if (supabase) {
            await supabase.from('message_logs').insert({
                visitor_id: visitorId,
                role: 'assistant',
                content: content
            });
        }

        try {
            const { appendMessageToSheet } = await import('@/lib/google-sheets');
            await appendMessageToSheet(visitorId, 'assistant', content);
        } catch (e) {
            console.error('Sheet Logging Failed:', e);
        }

        // 2. AI 자동 분석 및 시트 동기화 (백그라운드)
        try {
            const { syncConsultationWithAI } = await import('@/lib/consultation-manager');
            syncConsultationWithAI(visitorId).catch(e => console.error(`[Auto Sync Error] ${e}`));
        } catch (e) { }

        // 3. 인메모리 스토어 업데이트 (실시간 UI 반영용)
        try {
            messageStore.addMessage(visitorId, 'assistant', content);
        } catch (e) {
            // 세션이 메모리에 없을 수도 있음 (무시)
        }

        // 3. 카카오톡으로 메시지 전송 (Callback URL 활용)
        if (supabase) {
            const { data, error } = await supabase
                .from('consultations')
                .select('last_callback_url, updated_at')
                .eq('visitor_id', visitorId)
                .single();

            if (!error && data?.last_callback_url) {
                // 10분 유효성 체크 추가 가능 (생략 또는 구현)
                const lastUpdate = new Date(data.updated_at).getTime();
                const now = new Date().getTime();

                // 10분(600,000ms) 이내인 경우만 전송 시도
                if (now - lastUpdate < 600000) {
                    const kakaoResponse = await fetch(data.last_callback_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            version: "2.0",
                            template: {
                                outputs: [{
                                    simpleText: { text: content }
                                }]
                            }
                        })
                    });

                    if (!kakaoResponse.ok) {
                        const errText = await kakaoResponse.text();
                        console.error('Kakao Callback Failed:', errText);
                    }
                } else {
                    console.warn('Callback URL expired (>10min)');
                    // 만료된 경우라도 DB에는 저장되었으므로 사용자는 나중에 확인할 수 있음
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Send Message Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

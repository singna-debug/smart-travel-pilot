import { NextRequest, NextResponse } from 'next/server';
import { messageStore } from '@/lib/message-store';
import { getMessagesByVisitorId, getAllConsultations } from '@/lib/google-sheets';
import { supabase } from '@/lib/supabase';

// 특정 상담 상세 조회
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: visitorId } = await params;

    // 1. 메모리에서 세션 조회 (실시간 대화용)
    let session = messageStore.getSession(visitorId);
    let messages = session ? session.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
    })) : [];

    // 2. Supabase에서 전체 대화 내역 조회 시도
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
        const { data: dbMessages, error } = await supabase
            .from('message_logs')
            .select('*')
            .eq('visitor_id', visitorId)
            .order('created_at', { ascending: true });

        if (!error && dbMessages && dbMessages.length > 0) {
            messages = dbMessages.map(m => ({
                id: `db-${m.id}`,
                role: m.role,
                content: m.content,
                timestamp: m.created_at,
            }));
        }
    }

    // 3. Supabase 데이터가 없으면 구글 시트에서 조회
    if (messages.length === 0) {
        const sheetMessages = await getMessagesByVisitorId(visitorId);
        if (sheetMessages.length > 0) {
            messages = sheetMessages.map((m, i) => ({
                id: `sheet-${visitorId}-${i}`,
                role: m.role,
                content: m.content,
                timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
            }));
        }
    }

    // 4. 세션 상세 정보 가져오기 (Supabase -> Sheets -> Memory 순)
    let consultationInfo: any = null;

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && supabase) {
        const { data: dbData } = await supabase
            .from('consultations')
            .select('*')
            .eq('visitor_id', visitorId)
            .single();

        if (dbData) {
            consultationInfo = {
                visitorName: dbData.customer_name,
                visitorPhone: dbData.customer_phone,
                destination: dbData.destination,
                productName: dbData.product_name,
                departureDate: dbData.departure_date,
                productUrl: dbData.url,
                status: dbData.status,
                automationDates: {
                    balanceDueDate: dbData.balance_due_date,
                    noticeDate: dbData.notice_date,
                    nextFollowup: dbData.next_followup,
                },
            };
        }
    }

    if (!consultationInfo) {
        const allConsultations = await getAllConsultations();
        const sheetData = allConsultations.find(c =>
            c.visitor_id === visitorId ||
            `sheet-${c.customer.phone}-${c.timestamp}` === visitorId
        );
        if (sheetData) {
            consultationInfo = {
                visitorName: sheetData.customer.name,
                visitorPhone: sheetData.customer.phone,
                destination: sheetData.trip.destination,
                productName: sheetData.trip.product_name,
                departureDate: sheetData.trip.departure_date,
                productUrl: sheetData.trip.url,
                status: sheetData.automation.status,
                automationDates: {
                    balanceDueDate: sheetData.automation.balance_due_date,
                    noticeDate: sheetData.automation.notice_date,
                    nextFollowup: sheetData.automation.next_followup,
                },
                summary: sheetData.summary,
            };
        }
    }

    if (!consultationInfo && messages.length === 0) {
        return NextResponse.json(
            { success: false, error: '상담을 찾을 수 없습니다.' },
            { status: 404 }
        );
    }

    return NextResponse.json({
        success: true,
        data: {
            id: visitorId,
            ...(consultationInfo || {}),
            messages,
            lastMessageAt: messages[messages.length - 1]?.timestamp || new Date().toISOString(),
        },
    });
}

// 상담 상태 업데이트
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();

    const session = messageStore.getSession(id);
    if (!session) {
        return NextResponse.json(
            { success: false, error: '상담을 찾을 수 없습니다.' },
            { status: 404 }
        );
    }

    // 업데이트
    const updatedSession = messageStore.upsertSession(id, {
        status: body.status,
        visitorName: body.visitorName,
        visitorPhone: body.visitorPhone,
    });

    return NextResponse.json({
        success: true,
        data: updatedSession,
    });
}

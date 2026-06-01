import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { extractConsultationData } from '@/lib/ai-engine';
import { upsertConsultationToSheet } from '@/lib/google-sheets';
import { ConsultationData } from '@/types';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: visitorId } = await params;

    try {
        const { syncConsultationWithAI } = await import('@/lib/consultation-manager');
        const success = await syncConsultationWithAI(visitorId);

        if (!success) {
            throw new Error('데이터 동기화에 실패했습니다.');
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Summarize API Error]:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

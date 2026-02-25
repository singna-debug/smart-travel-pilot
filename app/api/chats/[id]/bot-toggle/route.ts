import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: visitorId } = await params;
    const body = await request.json();
    const { enabled } = body;

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const { error } = await supabase
        .from('consultations')
        .upsert({
            visitor_id: visitorId,
            is_bot_enabled: enabled,
            updated_at: new Date().toISOString()
        }, { onConflict: 'visitor_id' });

    if (error) {
        console.error('Bot Toggle Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, enabled });
}

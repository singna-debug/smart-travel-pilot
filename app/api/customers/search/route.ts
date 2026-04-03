import { NextRequest, NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';
        
        // Fetch all consultations (it uses internal caching in google-sheets.ts)
        const consultations = await getAllConsultations(false);
        
        if (!query) {
            // Return top 20 recent customers if no query
            return NextResponse.json({ 
                success: true, 
                data: consultations.slice(0, 20) 
            });
        }

        const lowerQuery = query.toLowerCase();
        const filtered = consultations.filter(c => {
            const name = (c.customer?.name || '').toLowerCase();
            const phone = (c.customer?.phone || '').replace(/[^0-9]/g, '');
            const cleanQuery = query.replace(/[^0-9]/g, '');
            
            return name.includes(lowerQuery) || (cleanQuery && phone.includes(cleanQuery));
        }).slice(0, 10);

        return NextResponse.json({ success: true, data: filtered });
    } catch (error: any) {
        console.error('[Customer Search API] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

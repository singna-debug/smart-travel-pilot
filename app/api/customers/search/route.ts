import { NextRequest, NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q') || '';
        const tenantId = request.headers.get('x-tenant-id') || 'default_tenant';
        
        // Fetch all consultations from this tenant's sheet
        const consultations = await getAllConsultations(false, tenantId);

        // 중복 제거 (이름 + 전화번호 기준, 가장 최근 행만 유지)
        const uniqueConsultations: any[] = [];
        const seen = new Set<string>();
        for (const c of consultations) {
            const phone = (c.customer?.phone || '').replace(/[^0-9]/g, '');
            const key = `${c.customer?.name || ''}-${phone}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueConsultations.push(c);
            }
        }
        
        if (!query) {
            // Return top 20 recent unique customers if no query
            return NextResponse.json({ 
                success: true, 
                data: uniqueConsultations.slice(0, 20) 
            });
        }

        const lowerQuery = query.toLowerCase();
        const filtered = uniqueConsultations.filter(c => {
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

import { NextRequest, NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';
import { confirmationStore } from '@/lib/confirmation-store';
import type { ConfirmationDocument } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/confirmation
 * 확정서 목록 조회 또는 고객 검색
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        // 고객 검색
        if (action === 'search-customers') {
            const query = searchParams.get('q') || '';
            if (!query || query.length < 1) {
                return NextResponse.json({ success: true, data: [] });
            }

            const consultations = await getAllConsultations(false);
            const filtered = consultations.filter(c => {
                const name = c.customer?.name || '';
                const phone = c.customer?.phone || '';
                return name.includes(query) || phone.includes(query);
            }).slice(0, 10);

            return NextResponse.json({ success: true, data: filtered });
        }

        // 확정서 목록
        const list = confirmationStore.list()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ success: true, data: list });
    } catch (error: any) {
        console.error('[Confirmation API] GET Error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * POST /api/confirmation
 * 새 확정서 생성
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const id = `CF-${Date.now().toString(36).toUpperCase()}`;
        const now = new Date().toISOString();

        const doc: ConfirmationDocument = {
            id,
            createdAt: now,
            updatedAt: now,
            reservationNumber: body.reservationNumber || id,
            status: body.status || '예약확정',
            customer: body.customer || { name: '', phone: '' },
            trip: body.trip || {
                productName: '', productUrl: '', destination: '',
                departureDate: '', returnDate: '', duration: '',
                travelers: [], adultCount: 1, childCount: 0, infantCount: 0,
            },
            flight: body.flight || {
                airline: '', departureAirport: '',
                departureTime: '', arrivalTime: '',
                returnDepartureTime: '', returnArrivalTime: '',
            },
            hotel: body.hotel || {
                name: '', address: '', checkIn: '', checkOut: '',
            },
            itinerary: body.itinerary || [],
            inclusions: body.inclusions || [],
            exclusions: body.exclusions || [],
            notices: body.notices || '',
            checklist: body.checklist || '',
            cancellationPolicy: body.cancellationPolicy || '',
            files: body.files || [],
            productData: body.productData,
        };

        confirmationStore.set(id, doc);

        console.log(`[Confirmation] Created: ${id}`);
        return NextResponse.json({ success: true, data: doc });
    } catch (error: any) {
        console.error('[Confirmation API] POST Error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

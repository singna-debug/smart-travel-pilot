import { NextRequest, NextResponse } from 'next/server';
import { confirmationStore } from '@/lib/confirmation-store';
import type { ConfirmationDocument } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        // Customer search inside Confirmation Creator
        if (action === 'search-customers') {
            const query = searchParams.get('q') || '';
            const { mockConsultations } = await import('@/lib/dummy-data');
            
            if (!query || query.length < 1) {
                return NextResponse.json({ success: true, data: mockConsultations });
            }

            // Return mock customers from our dummy data
            const filtered = mockConsultations.filter(c => {
                const name = c.customer?.name || '';
                const phone = c.customer?.phone || '';
                return name.includes(query) || phone.includes(query);
            });

            return NextResponse.json({ success: true, data: filtered });
        }

        // List dummy confirmations
        const list = await confirmationStore.list();
        const dummyList = list.filter(doc => doc.id.startsWith('dummy_'));
        const sortedList = [...dummyList].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ success: true, data: sortedList });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const reservationNumber = body.reservationNumber || 'DUMMY_RES';

        const generateRandomId = (length: number) => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };

        const randomId = generateRandomId(8);
        
        // Prefix with 'dummy_' so it can be identified and isolated
        const id = 'dummy_' + randomId;
        const now = new Date().toISOString();

        const doc: ConfirmationDocument = {
            id,
            createdAt: now,
            updatedAt: now,
            reservationNumber: reservationNumber === '미정' || !reservationNumber.trim() ? id : reservationNumber.trim(),
            status: body.status || '예약확정',
            customer: body.customer || { name: '더미고객', phone: '010-0000-0000' },
            trip: body.trip || {
                productName: '', productUrl: '', destination: '',
                departureDate: '', returnDate: '', duration: '',
                travelers: [], adultCount: 1, childCount: 0, infantCount: 0,
            },
            flight: body.flight || {
                airline: '', departureAirport: '',
                departureTime: '', arrivalTime: '', departureDuration: '',
                returnDepartureTime: '', returnArrivalTime: '', returnDuration: '',
                departureSegments: [], returnSegments: [],
            },
            hotels: body.hotels || [],
            itinerary: body.itinerary || [],
            inclusions: body.inclusions || [],
            exclusions: body.exclusions || [],
            notices: body.notices || '',
            checklist: body.checklist || '',
            cancellationPolicy: body.cancellationPolicy || '',
            files: body.files || [],
            meetingInfo: body.meetingInfo || [],
            productData: body.productData,
            secondaryResearch: body.secondaryResearch,
        };

        // Save to Supabase (so mobile device viewer can fetch it)
        const saved = await confirmationStore.set(id, doc);

        if (!saved) {
            return NextResponse.json(
                { success: false, error: '더미 확정서 저장 실패' },
                { status: 500 }
            );
        }

        console.log(`[Dummy Confirmation] Created: ${id}`);

        // We explicitly DO NOT write to Google Sheets for dummy confirmations!

        return NextResponse.json({ success: true, data: doc });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

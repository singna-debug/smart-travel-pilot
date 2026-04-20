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
        const list = await confirmationStore.list();
        const sortedList = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ success: true, data: sortedList });
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
        const visitorId = body.customer?.visitorId || body.visitorId;
        const reservationNumber = body.reservationNumber;
        
        // 예약번호가 없거나 '미정'인 경우 랜덤 알파벳/숫자 조합 생성
        const generateRandomId = (length: number) => {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 O, 0, I, 1 제외
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        };

        const randomId = generateRandomId(8);
        
        // ID는 예약번호가 있으면 사용, 없으면 랜덤 생성 (visitorId는 더 이상 ID로 쓰지 않음)
        const id = (reservationNumber && reservationNumber !== '미정' && reservationNumber.trim() !== '') 
            ? reservationNumber.trim() 
            : randomId;
            
        const now = new Date().toISOString();

        const doc: ConfirmationDocument = {
            id,
            createdAt: now,
            updatedAt: now,
            reservationNumber: (reservationNumber && reservationNumber !== '미정' && reservationNumber.trim() !== '') 
                ? reservationNumber.trim() 
                : id, // 명시적 예약번호 없으면 생성된 ID를 예약번호로 사용
            status: body.status || '예약확정',
            customer: body.customer || { name: '', phone: '' },
            trip: body.trip || {
                productName: '', productUrl: '', destination: '',
                departureDate: '', returnDate: '', duration: '',
                travelers: [], adultCount: 1, childCount: 0, infantCount: 0,
            },
            flight: body.flight || {
                airline: '', departureAirport: '',
                departureTime: '', arrivalTime: '', departureDuration: '',
                returnDepartureTime: '', returnArrivalTime: '', returnDuration: '',
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

        const saved = await confirmationStore.set(id, doc);

        if (!saved) {
            console.error(`[Confirmation] Save FAILED for id: ${id}`);
            return NextResponse.json(
                { success: false, error: '확정서 저장에 실패했습니다. Supabase 연결을 확인하세요.' },
                { status: 500 }
            );
        }

        console.log(`[Confirmation] Created: ${id} (visitorId: ${visitorId}, reservationNumber: ${reservationNumber})`);
        return NextResponse.json({ success: true, data: doc });
    } catch (error: any) {
        console.error('[Confirmation API] POST Error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

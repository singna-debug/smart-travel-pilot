import { NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';

export async function GET() {
    try {
        const consultations = await getAllConsultations();

        // 고객 목록으로 변환 (중복 제거, 최신 정보 우선)
        const customers = consultations.map((c) => ({
            name: c.customer.name,
            phone: c.customer.phone,
            destination: c.trip.destination,
            departureDate: c.trip.departure_date,
            returnDate: c.trip.return_date || '',
            duration: c.trip.duration || '',
            productName: c.trip.product_name,
            url: c.trip.url,
            status: c.automation.status,
            balanceDueDate: c.automation.balance_due_date,
            timestamp: c.timestamp,
        }));

        return NextResponse.json({ success: true, customers });
    } catch (error: any) {
        console.error('[Messages API] Error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

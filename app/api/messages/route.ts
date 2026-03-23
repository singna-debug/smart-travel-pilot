import { NextResponse } from 'next/server';
import { getAllConsultations } from '@/lib/google-sheets';

export async function GET() {
    try {
        const consultations = await getAllConsultations();

        // 고객 목록으로 변환 및 중복 제거 (전화번호 기준, 최신 정보 우선)
        const normalizePhone = (p: string) => (p || '').replace(/[^0-9]/g, '');
        const customerMap = new Map<string, any>();

        consultations.forEach((c) => {
            const phone = normalizePhone(c.customer.phone);
            const name = c.customer.name;
            const key = phone && phone !== '미정' ? phone : `name-${name}`;
            
            const existing = customerMap.get(key);
            const currentTimestamp = new Date(c.timestamp || 0).getTime();
            const existingTimestamp = existing ? new Date(existing.timestamp || 0).getTime() : 0;

            if (!existing || currentTimestamp > existingTimestamp) {
                customerMap.set(key, {
                    name: c.customer.name,
                    phone: c.customer.phone,
                    destination: c.trip.destination,
                    departureDate: c.trip.departure_date,
                    returnDate: c.trip.return_date || '',
                    duration: c.trip.duration || '',
                    productName: c.trip.product_name,
                    url: c.trip.url,
                    status: c.automation.status,
                    balanceDueDate: c.automation.balance_due_date || '',
                    travelersCount: c.trip.travelers_count || '',
                    timestamp: c.timestamp,
                });
            }
        });

        const customers = Array.from(customerMap.values());
        // 최신순 정렬
        customers.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

        return NextResponse.json({ success: true, customers });
    } catch (error: any) {
        console.error('[Messages API] Error:', error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

import { NextResponse } from 'next/server';
import { mockConsultations } from '@/lib/dummy-data';

export async function GET() {
    try {
        const normalizePhone = (p: string) => (p || '').replace(/[^0-9]/g, '');
        const customerMap = new Map<string, any>();

        mockConsultations.forEach((c) => {
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
                    balanceDueDate: '',
                    travelersCount: c.trip.travelers_count || '',
                    visitorId: c.visitor_id || '',
                    reservationNumber: c.reservation_number || '',
                    confirmationLink: '',
                    timestamp: c.timestamp,
                });
            }
        });

        const customers = Array.from(customerMap.values());
        customers.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

        return NextResponse.json({ success: true, customers });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

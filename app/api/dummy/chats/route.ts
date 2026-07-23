import { NextRequest, NextResponse } from 'next/server';
import { mockConsultations } from '@/lib/dummy-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');

        let list = mockConsultations.map(c => ({
            id: c.visitor_id || `dummy-${c.customer.name}`,
            visitorName: c.customer.name,
            visitorPhone: c.customer.phone,
            travelersCount: c.trip.travelers_count || '',
            recurringCustomer: c.automation.recurringCustomer || '',
            inquirySource: c.automation.inquirySource || '',
            destination: c.trip.destination,
            departureDate: c.trip.departure_date,
            returnDate: c.trip.return_date || '',
            duration: c.trip.duration || '',
            productName: c.trip.product_name,
            productUrl: c.trip.url || '',
            summary: c.summary || '',
            status: c.automation.status,
            source: c.source || '카카오톡',
            nextFollowup: c.automation.next_followup || '',
            confirmedProduct: c.automation.confirmed_product || '',
            confirmedDate: c.automation.confirmed_date || '',
            prepaidDate: c.automation.prepaid_date || '',
            noticeDate: c.automation.notice_date || '',
            balanceDate: c.automation.balance_date || '',
            confirmationSent: c.automation.confirmation_sent || '',
            departureNotice: c.automation.departure_notice || '',
            phoneNotice: c.automation.phone_notice || '',
            happyCall: c.automation.happy_call || '',
            lastMessage: c.summary || '상담 데이터',
            lastMessageAt: c.timestamp || new Date().toISOString(),
            messageCount: 1,
            sheetRowIndex: c.sheetRowIndex,
            sheetName: c.sheetName,
            sheetGid: c.sheetGid,
            specific_reminder_date: c.specific_reminder_date || '',
            previousInquiries: []
        }));

        if (status) {
            list = list.filter(c => c.status === status);
        }

        if (search) {
            const lower = search.toLowerCase();
            list = list.filter(c =>
                c.visitorName.toLowerCase().includes(lower) ||
                (c.destination || '').toLowerCase().includes(lower) ||
                (c.productName || '').toLowerCase().includes(lower)
            );
        }

        return NextResponse.json({
            success: true,
            data: list,
            total: list.length
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch dummy chats' }, { status: 500 });
    }
}

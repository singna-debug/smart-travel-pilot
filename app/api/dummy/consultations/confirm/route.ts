import { NextResponse } from 'next/server';

const getRelativeDateStr = (daysOffset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const reservationNumber = body.reservationNumber || 'DUMMY123';
        
        return NextResponse.json({
            success: true,
            data: {
                confirmedProductUrl: body.confirmedProductUrl || 'https://www.modetour.com/product/fukuoka-3d',
                confirmedDate: getRelativeDateStr(0),
                departureDate: getRelativeDateStr(10),
                returnDate: getRelativeDateStr(12),
                destination: '후쿠오카',
                productName: '[품격] 후쿠오카/온천 2박3일 실속 패키지 (힐튼호텔 2박)',
                prepaidDate: getRelativeDateStr(1) + ' (완료)',
                noticeDate: getRelativeDateStr(3),
                balanceDate: getRelativeDateStr(5),
                confirmationSent: getRelativeDateStr(7),
                departureNotice: getRelativeDateStr(8),
                phoneNotice: getRelativeDateStr(9),
                happyCall: getRelativeDateStr(13),
                reservationNumber: reservationNumber
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to confirm dummy reservation' }, { status: 500 });
    }
}

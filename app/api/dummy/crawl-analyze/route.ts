import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url } = body;
        return NextResponse.json({
            success: true,
            data: {
                destination: '후쿠오카',
                departureDate: '2026-07-15',
                returnDate: '2026-07-18',
                duration: '3일',
                title: '후쿠오카 힐튼호텔 3일 자유여행 패키지'
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to analyze dummy booking url' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    // Return some mock history for any customer
    return NextResponse.json({
        success: true,
        data: [
            {
                sheetName: '상담기록',
                consultationDate: '2026-05-01 10:00:00',
                productName: '[품격] 후쿠오카/온천 2박3일 실속 패키지 (힐튼호텔 2박)',
                productUrl: 'https://www.modetour.com/product/fukuoka-3d',
                status: '예약확정',
                departureDate: '2026-06-21'
            },
            {
                sheetName: '상담기록',
                consultationDate: '2025-11-10 14:30:00',
                productName: '[에어텔] 오사카 3일 자유여행',
                productUrl: 'https://www.modetour.com/product/osaka-3d',
                status: '상담완료',
                departureDate: '2025-12-15'
            }
        ]
    });
}

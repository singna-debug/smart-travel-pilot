import { NextResponse } from 'next/server';
import { mockProductInfo } from '@/lib/dummy-data';

export async function POST(request: Request) {
    try {
        // Return Fukuoka 3D package analysis immediately
        return NextResponse.json({
            success: true,
            data: {
                raw: mockProductInfo,
                formatted: "분석된 상품 정보입니다.",
                recommendation: "후쿠오카 힐튼호텔 숙박 패키지 상품을 추천합니다."
            }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to analyze dummy URL' }, { status: 500 });
    }
}

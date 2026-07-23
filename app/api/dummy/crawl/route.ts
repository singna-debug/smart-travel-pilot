import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url } = body;
        return NextResponse.json({
            title: '오키나와 3박 4일 에어텔 패키지 상품',
            description: '[포함사항]\n왕복 항공료, 힐튼 오키나와 차탄 리조트 3박, 조식 포함, 여행자보험\n\n[불포함사항]\n가이드 경비 및 렌터카 비용\n\n[일정]\n1일차: 인천 출발 -> 오키나와 나하 공항 도착\n2일차: 츄라우미 수족관 및 만좌모 관광\n3일차: 국제거리 자유 시간 및 쇼핑\n4일차: 귀국',
            price: '699,000원',
            url: url || 'https://www.modetour.com/product/okinawa-4d',
            keywords: ['오키나와', '에어텔', '휴양지'],
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to crawl dummy product' }, { status: 500 });
    }
}

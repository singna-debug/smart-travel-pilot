import { NextRequest, NextResponse } from 'next/server';
import { getConsultationHistory } from '@/lib/google-sheets';

/**
 * GET /api/consultations/history?phone=01012345678
 * 재방문 고객의 이전 상담 이력을 조회합니다.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const phone = searchParams.get('phone');

        if (!phone) {
            return NextResponse.json(
                { success: false, error: 'phone 파라미터가 필요합니다.' },
                { status: 400 }
            );
        }

        const history = await getConsultationHistory(phone);

        // UI에서 기대하는 형식으로 변환 (ConsultationData -> Chat 인터페이스 호환)
        const mappedHistory = history.map(h => ({
            consultationDate: h.timestamp,
            visitorName: h.customer.name,
            visitorPhone: h.customer.phone,
            destination: h.trip.destination,
            departureDate: h.trip.departure_date,
            productName: h.trip.product_name,
            productUrl: h.trip.url,
            status: h.automation.status,
            sheetName: h.sheetName,
            timestamp: h.timestamp
        }));

        return NextResponse.json({
            success: true,
            data: mappedHistory,
            total: mappedHistory.length,
        });
    } catch (error: any) {
        console.error('[History API] Error:', error.message);
        return NextResponse.json(
            { success: false, error: '이력 조회 중 오류가 발생했습니다.' },
            { status: 500 }
        );
    }
}

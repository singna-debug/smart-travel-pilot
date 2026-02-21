import { NextRequest, NextResponse } from 'next/server';
import type { ConfirmationDocument } from '@/types';

export const dynamic = 'force-dynamic';

// 같은 메모리 저장소 공유를 위해, 실 프로덕션에서는 DB를 사용해야 합니다.
// 현재는 프로토타입이므로 route.ts에서 export한 map을 직접 참조하지 못합니다.
// 대신 별도 모듈로 분리합니다.
import { confirmationStore } from '@/lib/confirmation-store';

/**
 * GET /api/confirmation/[id]
 * 특정 확정서 조회
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const doc = confirmationStore.get(id);

        if (!doc) {
            return NextResponse.json(
                { success: false, error: '확정서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: doc });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

/**
 * PUT /api/confirmation/[id]
 * 확정서 수정
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const existing = confirmationStore.get(id);

        if (!existing) {
            return NextResponse.json(
                { success: false, error: '확정서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const updated: ConfirmationDocument = {
            ...existing,
            ...body,
            id, // ID는 변경 불가
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
        };

        confirmationStore.set(id, updated);

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

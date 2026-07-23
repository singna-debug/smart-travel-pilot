import { NextRequest, NextResponse } from 'next/server';
import { confirmationStore } from '@/lib/confirmation-store';
import type { ConfirmationDocument } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const doc = await confirmationStore.get(id);

        if (!doc) {
            return NextResponse.json(
                { success: false, error: '더미 확정서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: doc });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const existing = await confirmationStore.get(id);

        if (!existing) {
            return NextResponse.json(
                { success: false, error: '더미 확정서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        const body = await request.json();
        const updated: ConfirmationDocument = {
            ...existing,
            ...body,
            id,
            createdAt: existing.createdAt,
            updatedAt: new Date().toISOString(),
        };

        await confirmationStore.set(id, updated);

        return NextResponse.json({ success: true, data: updated });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { mockSecondaryResearch } from '@/lib/dummy-data';

export async function POST(request: Request) {
    try {
        // Return mock secondary research data immediately
        return NextResponse.json({
            success: true,
            data: mockSecondaryResearch
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Failed to fetch dummy secondary research' }, { status: 500 });
    }
}

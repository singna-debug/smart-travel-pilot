import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
    return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
    return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
    return NextResponse.json({ success: true });
}

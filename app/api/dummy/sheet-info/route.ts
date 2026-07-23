import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        success: true,
        url: 'https://docs.google.com/spreadsheets/d/dummy-sheet-id/edit'
    });
}

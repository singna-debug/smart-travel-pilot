
import { NextResponse } from 'next/server';
import { getMonthSheetGid } from '@/lib/google-sheets';

export async function GET() {
    try {
        const sheetId = process.env.GOOGLE_SHEET_ID?.trim();
        const gid = await getMonthSheetGid();

        const url = gid
            ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid}`
            : `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

        return NextResponse.json({ success: true, url, sheetId, gid });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

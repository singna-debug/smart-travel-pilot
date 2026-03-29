import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

// This is a one-time migration script exposed as an API
export async function GET() {
    try {
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        if (!spreadsheetId) {
            return NextResponse.json({ success: false, error: 'GOOGLE_SHEET_ID not set' }, { status: 500 });
        }

        // Initialize auth
        let auth;
        const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
        if (fs.existsSync(credentialsPath)) {
            const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        }

        if (!auth) {
            return NextResponse.json({ success: false, error: 'Auth failed' }, { status: 500 });
        }

        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetList = response.data.sheets || [];

        const consultationHeaders = [
            '상담일시', '고객성함', '연락처', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', '상담단계', '팔로업일',
            '확정상품', '예약확정일', '잔금기한', '출발전안내(4주)', '잔금일', '확정서 발송', '출발안내', '전화 안내', '해피콜', '유입경로', 'visitor_id'
        ];

        const updatedSheets = [];

        for (const sheet of sheetList) {
            const title = sheet.properties.title;
            const gid = sheet.properties.sheetId;

            // Update monthly sheets (e.g., 2026-03) and main ones
            if (/^\d{4}-\d{2}$/.test(title) || title === 'Sheet1' || title === '시트1' || title === 'Consultations') {
                console.log(`Updating headers for sheet: ${title}`);
                
                // 1. Update Headers
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${title}!A1:W1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [consultationHeaders] },
                });

                // 2. Apply Dropdown Validation (Status column K = index 10)
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                setDataValidation: {
                                    range: {
                                        sheetId: gid,
                                        startRowIndex: 1,
                                        startColumnIndex: 10,
                                        endColumnIndex: 11,
                                    },
                                    rule: {
                                        condition: {
                                            type: 'ONE_OF_LIST',
                                            values: [
                                                { userEnteredValue: '상담중' },
                                                { userEnteredValue: '예약확정' },
                                                { userEnteredValue: '선금완료' },
                                                { userEnteredValue: '잔금완료' },
                                                { userEnteredValue: '여행완료' },
                                                { userEnteredValue: '취소/보류' },
                                                { userEnteredValue: '상담완료' }
                                            ]
                                        },
                                        showCustomUi: true,
                                        strict: false
                                    }
                                }
                            }
                        ]
                    }
                });

                updatedSheets.push(title);
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Migration completed', 
            updatedSheets,
            columnCount: consultationHeaders.length 
        });

    } catch (error: any) {
        console.error('Migration Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function ultimateMigration() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), 'google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = spreadsheet.data.sheets || [];
    const monthlySheets = sheetList
        .filter(s => /^\d{4}-\d{2}$/.test(s.properties.title))
        .map(s => ({ title: s.properties.title, gid: s.properties.sheetId }));

    const headers = [
        '상담일시', '고객성함', '연락처', '총인원', '재방문여부', '유입경로', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약',
        '상담단계', '등록방식', '팔로업일', '확정상품', '예약확정일', '선금일', '출발전안내(4주)', '잔금일', '확정서 발송', '출발안내', '전화 안내', '해피콜', 'visitor_id'
    ];

    for (const sheetInfo of monthlySheets) {
        process.stdout.write(`Processing ${sheetInfo.title}... `);
        
        const resp = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetInfo.title}!A:Z`,
        });

        const rows = resp.data.values || [];
        if (rows.length === 0) {
            console.log('Empty.');
            continue;
        }

        const newRows = [headers];

        for (let i = 1; i < rows.length; i++) {
            const oldRow = rows[i];
            const newRow = new Array(26).fill('');

            // Detect structure based on content
            // If row[3] is something like '신규고객' or '재방문', it's likely the 25-column structure (where index 3 was Recurring)
            const is25Col = oldRow[3] === '신규고객' || oldRow[3] === '재방문' || (oldRow.length <= 25 && oldRow[24]);

            if (is25Col) {
                // Shift from 25 to 26
                newRow[0] = oldRow[0] || ''; // Timestamp
                newRow[1] = oldRow[1] || ''; // Name
                newRow[2] = oldRow[2] || ''; // Phone
                newRow[3] = ''; // TOTAL PASSENGERS (New!)
                for (let j = 3; j < 25; j++) {
                    newRow[j + 1] = oldRow[j] || '';
                }
            } else if (oldRow.length >= 26 && oldRow[3] !== '신규고객') {
                // Already 26 correctly?
                for (let j = 0; j < 26; j++) newRow[j] = oldRow[j] || '';
            } else {
                // Might be old 23 or other?
                // Default fallback: copy based on most likely positions
                for (let j = 0; j < Math.min(oldRow.length, 26); j++) newRow[j] = oldRow[j] || '';
            }

            // Fix 'Registration Method' (index 14 in 26-col)
            // If visitor_id (index 25) is present, it's likely '카카오톡'
            // If not, it's probably '수동등록'
            const visitorId = (newRow[25] || '').trim();
            if (visitorId && !newRow[14]) {
                newRow[14] = '카카오톡';
            } else if (!visitorId && (newRow[14] === '카카오톡' || !newRow[14])) {
                newRow[14] = '수동등록';
            }

            newRows.push(newRow);
        }

        // Update values
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetInfo.title}!A1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: newRows },
        });

        // Auto-resize columns
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        autoResizeDimensions: {
                            dimensions: {
                                sheetId: sheetInfo.gid,
                                dimension: 'COLUMNS',
                                startIndex: 0,
                                endIndex: 26,
                            }
                        }
                    }
                ]
            }
        });

        console.log('Done.');
    }

    console.log('All sheets migrated and optimized!');
}

ultimateMigration().catch(console.error);

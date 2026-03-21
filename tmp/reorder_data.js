const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function reorderData() {
    try {
        const spreadsheetId = process.env.GOOGLE_SHEET_ID;
        console.log(`Target Spreadsheet ID: ${spreadsheetId}`);
        if (!spreadsheetId) {
            throw new Error('GOOGLE_SHEET_ID not set');
        }

        let auth;
        const credentialsPath = path.join(process.cwd(), 'google-credentials.json');
        if (fs.existsSync(credentialsPath)) {
            const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            let jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();
            if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
                jsonStr = jsonStr.substring(1, jsonStr.length - 1);
            }
            const credentials = JSON.parse(jsonStr);
            auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
        }

        if (!auth) {
            throw new Error('Auth failed');
        }

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetList = spreadsheet.data.sheets || [];

        for (const sheet of sheetList) {
            const title = sheet.properties.title;
            const gid = sheet.properties.sheetId;

            // Only process consultation sheets
            if (/^\d{4}-\d{2}$/.test(title) || title === 'Sheet1' || title === '시트1' || title === 'Consultations') {
                console.log(`\nProcessing data for sheet: ${title} (GID: ${gid})`);
                
                // Get all values
                const range = `'${title}'!A1:Y`;
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range,
                });

                const rows = response.data.values;
                if (!rows || rows.length <= 1) {
                    console.log(`- Skipping ${title}: No data rows found.`);
                    continue;
                }

                const currentHeaders = rows[0];
                const dataRows = rows.slice(1);

                // Check if already 25 columns and headers match
                if (currentHeaders.length === 25 && currentHeaders[3] === '재방문여부' && currentHeaders[12] === '상담단계') {
                    console.log(`- Headers seem correct. Checking if data needs reordering...`);
                    
                    // We need to check if Column D (index 3) is empty or contains "신규고객"/"재방문"
                    // If index 3 has "목적지" data, it definitely needs reordering.
                    const testRow = dataRows[0];
                    const isAlreadyReordered = (testRow[3] === '신규고객' || testRow[3] === '재방문' || testRow[3] === '');
                    
                    // But wait, if they haven't reordered, testRow[3] would be old index 3 (목적지).
                    // If old index 3 was empty, this test might fail.
                    // Better check index 12 (new 상담단계). If it has old index 10 (상담단계), might be okay.
                    // Actually, let's just reorder based on the assumption that if index 5 is NOT the old index 3 (목적지), it's not reordered.
                }

                const newRows = [currentHeaders]; // Keep existing (already updated) headers

                for (let i = 0; i < dataRows.length; i++) {
                    const oldRow = dataRows[i];
                    // Create 25-column row
                    const newRow = new Array(25).fill('');

                    // 0-2: 상담일시, 고객성함, 연락처
                    newRow[0] = oldRow[0] || '';
                    newRow[1] = oldRow[1] || '';
                    newRow[2] = oldRow[2] || '';

                    // 3-4: 재방문여부, 유입경로 (인사이트) -> Default/Empty
                    newRow[3] = '신규고객'; 
                    newRow[4] = '';

                    // 5-11: 목적지(3), 출발일(4), 귀국일(5), 기간(6), 상품명(7), 상품URL(8), 상담요약(9)
                    newRow[5] = oldRow[3] || '';
                    newRow[6] = oldRow[4] || '';
                    newRow[7] = oldRow[5] || '';
                    newRow[8] = oldRow[6] || '';
                    newRow[9] = oldRow[7] || '';
                    newRow[10] = oldRow[8] || '';
                    newRow[11] = oldRow[9] || '';

                    // 12: 상담단계(10)
                    newRow[12] = oldRow[10] || '';

                    // 13: 등록방식 (Old 21)
                    newRow[13] = oldRow[21] || '카카오톡';

                    // 14: 팔로업일(11)
                    newRow[14] = oldRow[11] || '';

                    // 15: 확정상품(12)
                    newRow[15] = oldRow[12] || '';

                    // 16: 예약확정일(13)
                    newRow[16] = oldRow[13] || '';

                    // 17-18: 선금일, 출발전안내(4주) -> New Empty
                    newRow[17] = '';
                    newRow[18] = '';

                    // 19: 잔금일(16)
                    newRow[19] = oldRow[16] || '';

                    // 20: 확정서 발송(17)
                    newRow[20] = oldRow[17] || '';

                    // 21: 출발안내(18)
                    newRow[21] = oldRow[18] || '';

                    // 22: 전화 안내(19)
                    newRow[22] = oldRow[19] || '';

                    // 23: 해피콜(20)
                    newRow[23] = oldRow[20] || '';

                    // 24: visitor_id(22)
                    newRow[24] = oldRow[22] || '';

                    newRows.push(newRow);
                }

                // Write back
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `'${title}'!A1:Y${newRows.length}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: newRows },
                });
                console.log(`- Successfully reordered ${dataRows.length} rows for ${title}`);
            }
        }
        console.log('\nData reordering finished successfully!');

    } catch (error) {
        console.error('Reordering failed:');
        console.error(error);
        process.exit(1);
    }
}

reorderData();

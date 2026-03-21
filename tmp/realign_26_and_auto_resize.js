const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function realignAndResize() {
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

        const consultationHeaders = [
            '상담일시', '고객성함', '연락처', '총인원', '재방문여부', '유입경로', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약',
            '상담단계', '등록방식', '팔로업일', '확정상품', '예약확정일', '선금일', '출발전안내(4주)', '잔금일', '확정서 발송', '출발안내', '전화 안내', '해피콜', 'visitor_id'
        ];

        for (const sheet of sheetList) {
            const title = sheet.properties.title;
            const gid = sheet.properties.sheetId;

            if (/^\d{4}-\d{2}$/.test(title) || title === 'Sheet1' || title === '시트1' || title === 'Consultations') {
                console.log(`\nRealigning data for sheet: ${title} (GID: ${gid})`);
                
                // 1. Ensure 26 columns
                const currentColumnCount = sheet.properties.gridProperties.columnCount;
                if (currentColumnCount < 26) {
                    await sheets.spreadsheets.batchUpdate({
                        spreadsheetId,
                        requestBody: {
                            requests: [{
                                appendDimension: {
                                    sheetId: gid,
                                    dimension: 'COLUMNS',
                                    length: 26 - currentColumnCount
                                }
                            }]
                        }
                    });
                }

                // 2. Clear headers
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `'${title}'!A1:Z1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [consultationHeaders] },
                });

                // 3. Re-map data
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId,
                    range: `'${title}'!A2:Y`, // Read current 25nd columns rows
                });

                const rows = response.data.values;
                if (rows && rows.length > 0) {
                    const newRows = rows.map(oldRow => {
                        const newRow = new Array(26).fill('');
                        // 0-2 (상담일시, 성함, 연락처)
                        newRow[0] = oldRow[0] || '';
                        newRow[1] = oldRow[1] || '';
                        newRow[2] = oldRow[2] || '';
                        
                        // 3 (총인원) - NEW Empty
                        newRow[3] = '';

                        // 4-5 (재방문여부, 유입경로인사이트) - Was 3, 4
                        newRow[4] = oldRow[3] || '신규고객';
                        newRow[5] = oldRow[4] || '';

                        // 6-12 (목적지(5), 출발일(6), 귀국일(7), 기간(8), 상품명(9), 상품URL(10), 상담요약(11))
                        newRow[6] = oldRow[5] || '';
                        newRow[7] = oldRow[6] || '';
                        newRow[8] = oldRow[7] || '';
                        newRow[9] = oldRow[8] || '';
                        newRow[10] = oldRow[9] || '';
                        newRow[11] = oldRow[10] || '';
                        newRow[12] = oldRow[11] || '';

                        // 13 (상담단계) - Was 12
                        newRow[13] = oldRow[12] || '';

                        // 14 (등록방식) - Was 13. 
                        // Note: If oldRow[13] is '카카오톡', we keep it, but if it was ruined, we might try to guess.
                        newRow[14] = oldRow[13] || '카카오톡';

                        // 15-18 (팔로업(14), 확정상품(15), 예약확정일(16), 선금일(17), 안내(18))
                        // Wait, previous 25 structure had:
                        // 14: 팔로업일
                        // 15: 확정상품
                        // 16: 예약확정일
                        // 17: 선금일
                        // 18: 출발전안내(4주)
                        newRow[15] = oldRow[14] || '';
                        newRow[16] = oldRow[15] || '';
                        newRow[17] = oldRow[16] || '';
                        newRow[18] = oldRow[17] || '';
                        newRow[19] = oldRow[18] || '';

                        // 20-24 (잔금일(19), 확정서(20), 출발안내(21), 전화(22), 해피콜(23))
                        newRow[20] = oldRow[19] || '';
                        newRow[21] = oldRow[20] || '';
                        newRow[22] = oldRow[21] || '';
                        newRow[23] = oldRow[22] || '';
                        newRow[24] = oldRow[23] || '';

                        // 25 (visitor_id) - Was 24
                        newRow[25] = oldRow[24] || '';

                        return newRow;
                    });

                    await sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `'${title}'!A2:Z${newRows.length + 1}`,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: newRows },
                    });
                    console.log(`- Realigned ${newRows.length} rows for ${title}`);
                }

                // 4. Auto-Resize Columns & Apply Validations
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            // Auto-resize all columns
                            {
                                autoResizeDimensions: {
                                    dimensions: {
                                        sheetId: gid,
                                        dimension: 'COLUMNS',
                                        startIndex: 0,
                                        endIndex: 26
                                    }
                                }
                            },
                            // Validations
                            {
                                setDataValidation: {
                                    range: { sheetId: gid, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
                                    rule: { condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: '신규고객' }, { userEnteredValue: '재방문' }] }, showCustomUi: true }
                                }
                            },
                            {
                                setDataValidation: {
                                    range: { sheetId: gid, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 },
                                    rule: { condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: '블로그' }, { userEnteredValue: '지인소개' }, { userEnteredValue: '카카오톡채널' }, { userEnteredValue: '인스타그램' }, { userEnteredValue: '매장방문' }] }, showCustomUi: true }
                                }
                            },
                            {
                                setDataValidation: {
                                    range: { sheetId: gid, startRowIndex: 1, startColumnIndex: 13, endColumnIndex: 14 },
                                    rule: { condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: '상담중' }, { userEnteredValue: '예약확정' }, { userEnteredValue: '선금완료' }, { userEnteredValue: '잔금완료' }, { userEnteredValue: '여행완료' }, { userEnteredValue: '취소/보류' }] }, showCustomUi: true }
                                }
                            }
                        ]
                    }
                });
                console.log(`- Optimized column widths and validations for ${title}`);
            }
        }
        console.log('\nMigration and optimization finished successfully!');

    } catch (error) {
        console.error('Migration failed:');
        console.error(error);
        process.exit(1);
    }
}

realignAndResize();

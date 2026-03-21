const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function migrate() {
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
        const response = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetList = response.data.sheets || [];

        const consultationHeaders = [
            '상담일시', '고객성함', '연락처', '재방문여부', '유입경로', '목적지', '출발일', '귀국일', '기간', '상품명', '상품URL', '상담요약', 
            '상담단계', '등록방식', '팔로업일', '확정상품', '예약확정일', '선금일', '출발전안내(4주)', '잔금일', '확정서 발송', '출발안내', '전화 안내', '해피콜', 'visitor_id'
        ];

        for (const sheet of sheetList) {
            const title = sheet.properties.title;
            const gid = sheet.properties.sheetId;

            if (/^\d{4}-\d{2}$/.test(title) || title === 'Sheet1' || title === '시트1' || title === 'Consultations') {
                console.log(`Updating headers for sheet: ${title} (GID: ${gid})`);
                
                // 0. Ensure enough columns (25 columns = Y)
                const currentColumnCount = sheet.properties.gridProperties.columnCount;
                if (currentColumnCount < 25) {
                    await sheets.spreadsheets.batchUpdate({
                        spreadsheetId,
                        requestBody: {
                            requests: [{
                                appendDimension: {
                                    sheetId: gid,
                                    dimension: 'COLUMNS',
                                    length: 25 - currentColumnCount
                                }
                            }]
                        }
                    });
                }

                // 1. Update Headers
                try {
                    await sheets.spreadsheets.values.update({
                        spreadsheetId,
                        range: `'${title}'!A1:Y1`,
                        valueInputOption: 'USER_ENTERED',
                        requestBody: { values: [consultationHeaders] },
                    });
                    console.log(`Updated headers for ${title}`);
                } catch (hErr) {
                    console.error(`Failed to update headers for ${title}:`, hErr.message);
                }

                // 2. Apply Dropdown Validations
                try {
                    await sheets.spreadsheets.batchUpdate({
                        spreadsheetId,
                        requestBody: {
                            requests: [
                                // 재방문여부 (D=index 3)
                                {
                                    setDataValidation: {
                                        range: { sheetId: gid, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 },
                                        rule: {
                                            condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: '신규고객' }, { userEnteredValue: '재방문' }] },
                                            showCustomUi: true, strict: false
                                        }
                                    }
                                },
                                // 유입경로 (E=index 4)
                                {
                                    setDataValidation: {
                                        range: { sheetId: gid, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
                                        rule: {
                                            condition: { type: 'ONE_OF_LIST', values: [
                                                { userEnteredValue: '블로그' }, { userEnteredValue: '지인소개' }, 
                                                { userEnteredValue: '카카오톡채널' }, { userEnteredValue: '인스타그램' }, 
                                                { userEnteredValue: '매장방문' }
                                            ] },
                                            showCustomUi: true, strict: false
                                        }
                                    }
                                },
                                // 상담단계 (M=index 12)
                                {
                                    setDataValidation: {
                                        range: { sheetId: gid, startRowIndex: 1, startColumnIndex: 12, endColumnIndex: 13 },
                                        rule: {
                                            condition: { type: 'ONE_OF_LIST', values: [
                                                { userEnteredValue: '상담중' }, { userEnteredValue: '예약확정' }, 
                                                { userEnteredValue: '선금완료' }, { userEnteredValue: '잔금완료' }, 
                                                { userEnteredValue: '여행완료' }, { userEnteredValue: '취소/보류' }
                                            ] },
                                            showCustomUi: true, strict: false
                                        }
                                    }
                                }
                            ]
                        }
                    });
                    console.log(`Applied validation for ${title}`);
                } catch (vErr) {
                    console.error(`Skipping validation for ${title}: ${vErr.message}`);
                }
                console.log(`Finished processing ${title}`);
            }
        }
        console.log('Migration finished successfully!');

    } catch (error) {
        console.error('Migration failed:');
        const errorData = error.response && error.response.data ? error.response.data : error;
        fs.writeFileSync(path.join(process.cwd(), 'tmp/migrate_error.json'), JSON.stringify(errorData, null, 2));
        console.error('Full error written to tmp/migrate_error.json');
        process.exit(1);
    }
}

migrate();

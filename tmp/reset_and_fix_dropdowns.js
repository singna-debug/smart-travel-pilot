const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function resetAndFixDropdowns() {
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

    const requests = [];

    for (const sheetInfo of monthlySheets) {
        // 1. Clear ALL validations for columns A-Z (Index 0-25)
        requests.push({
            setDataValidation: {
                range: {
                    sheetId: sheetInfo.gid,
                    startRowIndex: 1, // Start from row 2
                    startColumnIndex: 0,
                    endColumnIndex: 26,
                },
                // Omitting 'rule' clears the validation
            }
        });

        // 2. Re-apply correct ones
        requests.push(
            // 재방문여부 (E열, index 4)
            {
                setDataValidation: {
                    range: {
                        sheetId: sheetInfo.gid,
                        startRowIndex: 1,
                        startColumnIndex: 4,
                        endColumnIndex: 5,
                    },
                    rule: {
                        condition: {
                            type: 'ONE_OF_LIST',
                            values: [
                                { userEnteredValue: '신규고객' },
                                { userEnteredValue: '재방문' }
                            ]
                        },
                        showCustomUi: true,
                        strict: false
                    }
                }
            },
            // 유입경로 (F열, index 5)
            {
                setDataValidation: {
                    range: {
                        sheetId: sheetInfo.gid,
                        startRowIndex: 1,
                        startColumnIndex: 5,
                        endColumnIndex: 6,
                    },
                    rule: {
                        condition: {
                            type: 'ONE_OF_LIST',
                            values: [
                                { userEnteredValue: '블로그' },
                                { userEnteredValue: '지인소개' },
                                { userEnteredValue: '카카오톡채널' },
                                { userEnteredValue: '인스타그램' },
                                { userEnteredValue: '매장방문' }
                            ]
                        },
                        showCustomUi: true,
                        strict: false
                    }
                }
            },
            // 상담단계 (N열, index 13)
            {
                setDataValidation: {
                    range: {
                        sheetId: sheetInfo.gid,
                        startRowIndex: 1,
                        startColumnIndex: 13,
                        endColumnIndex: 14,
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
                                { userEnteredValue: '취소/보류' }
                            ]
                        },
                        showCustomUi: true,
                        strict: false
                    }
                }
            }
        );
    }

    if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests }
        });
        console.log(`Successfully reset and re-applied dropdowns for ${monthlySheets.length} sheets.`);
    }
}

resetAndFixDropdowns().catch(console.error);

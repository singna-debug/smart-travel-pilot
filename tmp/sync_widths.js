const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function syncColumnWidths() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), 'google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // The gold standard widths from 2026-03
    const standardWidths = [
        125,  // A: 상담일시
        94,   // B: 고객성함
        96,   // C: 연락처
        71,   // D: 총인원
        95,   // E: 재방문여부
        121,  // F: 유입경로
        120,  // G: 목적지
        129,  // H: 출발일
        131,  // I: 귀국일
        90,   // J: 기간
        112,  // K: 상품명
        140,  // L: 상품URL
        112,  // M: 상담요약
        106,  // N: 상담단계
        117,  // O: 등록방식
        104,  // P: 팔로업일
        110,  // Q: 확정상품
        114,  // R: 예약확정일
        106,  // S: 선금일
        119,  // T: 출발전안내(4주)
        84,   // U: 잔금일
        112,  // V: 확정서 발송
        112,  // W: 출발안내
        112,  // X: 전화 안내
        112,  // Y: 해피콜
        112   // Z: visitor_id
    ];

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = spreadsheet.data.sheets || [];
    const monthlySheets = sheetList
        .filter(s => /^\d{4}-\d{2}$/.test(s.properties.title))
        .map(s => ({ title: s.properties.title, gid: s.properties.sheetId }));

    const requests = [];

    for (const sheetInfo of monthlySheets) {
        if (sheetInfo.title === '2026-03') continue;

        standardWidths.forEach((width, index) => {
            requests.push({
                updateDimensionProperties: {
                    range: {
                        sheetId: sheetInfo.gid,
                        dimension: 'COLUMNS',
                        startIndex: index,
                        endIndex: index + 1
                    },
                    properties: {
                        pixelSize: width
                    },
                    fields: 'pixelSize'
                }
            });
        });
    }

    if (requests.length > 0) {
        // Splitting into chunks to avoid potential request size limits
        const chunkSize = 200;
        for (let i = 0; i < requests.length; i += chunkSize) {
            const chunk = requests.slice(i, i + chunkSize);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: chunk }
            });
            process.stdout.write(`Applied ${i + chunk.length} width updates... `);
        }
        console.log('\nAll sheets synchronized!');
    } else {
        console.log('No other sheets found.');
    }
}

syncColumnWidths().catch(console.error);

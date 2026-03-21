const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function syncAllColumnWidths() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(process.cwd(), 'google-credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // The gold standard widths from 2026-03
    const standardWidths = [125,94,96,71,95,121,120,129,131,90,112,140,112,106,117,104,110,114,106,119,84,112,112,112,112,112];

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = spreadsheet.data.sheets || [];

    const requests = [];

    for (const sheet of sheetList) {
        const title = sheet.properties.title;
        const gid = sheet.properties.sheetId;

        // Skip the source sheet itself
        if (title === '2026-03') continue;
        // Skip Messages sheet as it only has 4 columns
        if (title === 'Messages') continue;

        standardWidths.forEach((width, index) => {
            requests.push({
                updateDimensionProperties: {
                    range: {
                        sheetId: gid,
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
        const chunkSize = 200;
        for (let i = 0; i < requests.length; i += chunkSize) {
            const chunk = requests.slice(i, i + chunkSize);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: { requests: chunk }
            });
        }
        console.log(`Successfully synced widths for ${sheetList.length - 2} sheets.`);
    }
}

syncAllColumnWidths().catch(console.error);

const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Import local libs using relative path
const { getGoogleSheetsClient, getSheetTitles } = require('../lib/google-sheets');

async function testConnection() {
    console.log('Testing Google Sheets Connection...');
    const sheetId = process.env.GOOGLE_SHEET_ID;
    console.log(`Sheet ID: ${sheetId}`);

    if (!sheetId) {
        console.error('ERROR: GOOGLE_SHEET_ID is missing.');
        return;
    }

    try {
        const sheets = getGoogleSheetsClient();
        console.log('Client initialized.');

        const titles = await getSheetTitles(sheets, sheetId);
        console.log('Success! Found sheets:', titles);

        // Try to fetch rows from 'consultations'
        const range = `${titles.consultationsSheet}!A1:E5`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: range,
        });

        console.log('Data sample:', response.data.values);

    } catch (error: any) {
        console.error('Connection Failed:', error.message);
        console.error('Stack:', error.stack);
        if (error.response) {
            console.error('Error Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testConnection();

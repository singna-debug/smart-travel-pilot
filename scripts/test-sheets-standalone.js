const { google } = require('googleapis');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env.local') });

function getGoogleSheetsClient() {
    try {
        console.log('Initializing GoogleAuth (v5)...');

        let credentials;
        if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            console.log('Using GOOGLE_SERVICE_ACCOUNT_JSON');
            let jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON.trim();

            if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
                console.log('Stripping quotes');
                jsonStr = jsonStr.substring(1, jsonStr.length - 1);
            }

            // Unescape \n and \"
            console.log('Unescaping sequences');
            const originalStr = jsonStr;
            jsonStr = jsonStr.replace(/\\n/g, '\n').replace(/\\"/g, '"');

            try {
                credentials = JSON.parse(jsonStr);
                console.log('Parsed JSON successfully');
            } catch (e) {
                console.error('JSON Parse Error:', e.message);
                // Log where it failed
                const pos = parseInt(e.message.match(/position (\d+)/)?.[1] || '0');
                if (pos > 0) {
                    console.log('Error around position:', jsonStr.substring(pos - 10, pos + 20));
                }
                throw e;
            }
        }

        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        return google.sheets({ version: 'v4', auth });
    } catch (e) {
        console.error('Error in getGoogleSheetsClient:', e);
        throw e;
    }
}

async function testConnection() {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    try {
        const sheets = getGoogleSheetsClient();
        console.log('Client initialized.');

        const response = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
        console.log('Success! Connected to sheet:', response.data.properties.title);
        console.log('TEST PASSED');
        process.exit(0);
    } catch (error) {
        console.error('TEST FAILED:', error.message);
        process.exit(1);
    }
}

testConnection();
